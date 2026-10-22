// src/app/api/wiki/[[...path]]/route.ts

import { NextRequest, NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { pageUrl, pagePath } from '@/lib/utils';
import { slugifyHeading } from 'wiki-formant/headings';
import { SITE_URL, WIKI_LICENSE } from '@/lib/site';
import { findTagByPath, tagLabel, isValidTagPath, isAuthorOnlyPath, isLockedPage, isSharedPath, canEditAuthorOnlyPage, getMetadataKeys } from '@/lib/tags';
import { requireBalance } from '@/lib/radix/balance';
import { parsePagination, paginatedResponse } from 'wiki-formant/pagination';
import { requireAuth, cachedJson, tagged, CACHE, type RouteContext } from '@/lib/api';
import { toListing } from 'wiki-formant/store';
import { isReservedSlug, parsePath } from '@/lib/path';
import { store, toWikiPage, authorsOf, deletePage, searchPages, resolveBlockData, loadPageHistory, getCategoryPages, revalidatePage, pageTag, routeTags, CORPUS_TAG } from '@/lib/wiki';
import { blockIssues, validateBlocks } from '@/lib/block-utils';
import { describeBlockIssues, MAX_BLOCK_ROWS } from 'wiki-formant/validation';
import { blocksToMdx } from '@/lib/mdx';
import { pageToMarkdown } from '@/lib/markdown';
import { markdownDocument } from 'wiki-formant/markdown';
import type { WikiPage, WikiPageInput, PageMetadata } from '@/types';
import type { Block } from '@/types/blocks';
import { deliverWebhooks } from '@/lib/webhooks';
import { trackSearch } from '@/lib/track';
import { VARY_ACCEPT, corpusEtag, markdownHeaders, notModified, teachingNotFound, wantsMarkdown, json, errors, handleRoute } from 'wiki-formant/http';

type PathParams = { path?: string[] };

/**
 * A listing or search answer. The CDN holds a route handler by its `s-maxage`
 * alone, so each response here carries the tag of what it reads, which the
 * save that changes it expires (`revalidatePage`); a listing reads the corpus.
 */
const LISTING = { ...CACHE.short, ...routeTags(CORPUS_TAG) };

/** A stored page with its author, as every write answers. */
async function withAuthor(row: Parameters<typeof toWikiPage>[0]): Promise<WikiPage> {
  return toWikiPage(row, await authorsOf([row.authorId]));
}

/**
 * Metadata as a write stores it. The banner travels as its own field and the
 * co-editor list is the author's alone to set, so neither can be written
 * through the free-form metadata a client sends.
 */
function storedMetadata(
  sent: PageMetadata | undefined,
  stored: Record<string, unknown>,
  { banner, editors }: { banner?: string | null; editors?: string[] },
): Record<string, unknown> | undefined {
  if (sent === undefined && banner === undefined && editors === undefined) return undefined;
  const { banner: _b, editors: _e, ...rest } = (sent ?? stored) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...rest };
  const bannerValue = banner === undefined ? stored.banner : banner;
  const editorsValue = editors === undefined ? stored.editors : editors;
  if (typeof bannerValue === 'string' && bannerValue) next.banner = bannerValue;
  if (Array.isArray(editorsValue) && editorsValue.length) next.editors = editorsValue;
  if (typeof stored.backupTx === 'string') next.backupTx = stored.backupTx;
  return next;
}

/** The required-metadata gate, identical on create and on update. */
function metadataError(tagPath: string, metadata: PageMetadata | undefined) {
  const missing = getMetadataKeys(tagPath.split('/')).filter(k => k.required && !metadata?.[k.key]?.trim());
  return missing.length ? errors.badRequest(`Missing required metadata: ${missing.map(k => k.label).join(', ')}`) : null;
}

export async function GET(request: NextRequest, context: RouteContext<PathParams>) {
  const { path: rawPath } = await context.params;
  // A trailing `.md` on the last segment is the markdown request — that is
  // what the public `/:path*.md` rewrite forwards (Next drops a query string
  // written into a rewrite destination, so the extension carries the intent).
  const last = rawPath?.[rawPath.length - 1];
  const mdSuffix = Boolean(last?.endsWith('.md'));
  // The homepage's twin is /index.md: the `${url}.md` rule every other page
  // follows names no path on a bare origin.
  const path = mdSuffix && rawPath
    ? (rawPath.length === 1 && last === 'index.md' ? [] : [...rawPath.slice(0, -1), last!.slice(0, -3)])
    : rawPath;
  const parsed = parsePath(path, 'api');

  return handleRoute(async () => {
    const { searchParams } = new URL(request.url);

    // MDX export
    if (parsed.type === 'mdx') {
      const row = await store.get(parsed.tagPath, parsed.slug);
      if (!row) return errors.notFound('Page not found');
      const page = await withAuthor(row);

      return new NextResponse(blocksToMdx(page), {
        headers: {
          'Content-Type': 'text/mdx; charset=utf-8',
          'Content-Disposition': `attachment; filename="${page.slug || 'homepage'}.mdx"`,
          // A twin of the HTML page, like the markdown ones: not for the index.
          'X-Robots-Tag': 'noindex',
        },
      });
    }

    // List mode
    if (!path?.length && (searchParams.has('page') || searchParams.has('pageSize') || searchParams.has('q') || searchParams.has('tagPath') || searchParams.has('sort') || searchParams.has('ids') || searchParams.has('refs'))) {
      // Every page as a list block's picker offers it: its id, its title, and
      // where it lives.
      if (searchParams.has('refs')) {
        const rows = await prisma.wikiPage.findMany({ where: { siteId: '' }, select: { id: true, title: true, tagPath: true }, orderBy: { title: 'asc' } });
        return cachedJson(rows.map(r => ({ id: r.id, title: r.title, detail: r.tagPath || 'Homepage' })), LISTING);
      }

      // Batch lookup by id, the shape `/api/users/search?ids=` already uses: it
      // hydrates a list block's picked ids on the client.
      const idsParam = searchParams.get('ids');
      if (idsParam !== null) {
        const ids = idsParam.split(',').filter(Boolean).slice(0, MAX_BLOCK_ROWS);
        if (!ids.length) return json([]);
        // The author's chosen order, not the database's: getPagesByIds already
        // orders its server-resolved twin this way, and a list block that
        // hydrates on the client must not reshuffle itself.
        const rows = await store.byIds(ids);
        const authors = await authorsOf(rows.map(r => r.authorId));
        return json(rows.map(r => toWikiPage(r, authors)));
      }

      const { page, pageSize } = parsePagination(searchParams);
      const q = searchParams.get('q')?.trim() || '';
      const tagPath = searchParams.get('tagPath');
      const sort = searchParams.get('sort') || 'updatedAt';

      // The same rule getRecentPages applies server-side: a listing that names a
      // path gets that path, hidden or not; one that names none is asking what
      // changed on the wiki, and the answer to that is article space. Without
      // it the recent-pages widget re-fetched here on hydration and put the
      // maintenance log back on top of the server-rendered list.
      const where = { siteId: '', tagPath: tagPath ?? { notIn: store.hidden } };

      if (q) {
        // The GET-only twin of MCP search_wiki: identical ranking (titles ahead
        // of body prose) and row-identical results, because both call `searchPages`.
        const { items, total } = await searchPages(q, { tagPath, page, size: pageSize });
        // The only place a reader's own question is countable. `cachedJson`
        // below puts a 30s edge cache in front of this, so a repeated query
        // inside that window fires once — which is the debounce this wants
        // anyway, not a gap in the measurement.
        trackSearch(request.headers, q, total, 'wiki');
        return cachedJson(paginatedResponse(items, total, page, pageSize), LISTING);
      }

      const orderBy = sort === 'title' ? { title: 'asc' as const } : { updatedAt: 'desc' as const };

      const [rows, total] = await Promise.all([
        prisma.wikiPage.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
        prisma.wikiPage.count({ where }),
      ]);
      const authors = await authorsOf(rows.map(r => r.authorId));
      const pages = rows.map(r => toWikiPage({ ...toListing(r), metadata: (r.metadata ?? {}) as Record<string, unknown> }, authors));

      return cachedJson(paginatedResponse(pages, total, page, pageSize), LISTING);
    }

    if (parsed.type === 'invalid') return errors.notFound('Invalid path');

    // The teaching 404: this is the answer an agent that guessed a `.md` URL
    // gets, and `Page not found` gave it nothing to retry from.
    const noPage = (where: string) => teachingNotFound(
      `No page at "${where}".`,
      {
        map: `${SITE_URL}/llms.txt`,
        search: `${SITE_URL}/api/wiki?q=<term>`,
        categories: `${SITE_URL}/api/wiki?tagPath=`,
        note: 'Every page URL takes a ".md" suffix for its markdown twin, and the homepage\'s is /index.md. Paths are tagPath + slug, e.g. "contents/tech/core-concepts/utxo-model".',
      },
      CACHE.short['Cache-Control'],
    );

    // History mode — the uncached read, so a direct-DB script write shows up here
    // the moment it lands rather than after the `wiki` tag next revalidates.
    if (parsed.type === 'history') {
      const history = await loadPageHistory(parsed.tagPath, parsed.slug);
      if (!history) return errors.notFound('Page not found');
      return cachedJson(history, { ...CACHE.short, ...routeTags(pageTag(parsed.tagPath, parsed.slug)) });
    }

    // Only the wiki's own rows answer here. The app routes (charts, leaderboard,
    // settings, a token's detail) parse with the homepage's empty
    // tagPath and slug, and used to fall through to the homepage row below:
    // /charts.md served the homepage's markdown with a 200.
    if (parsed.type !== 'homepage' && parsed.type !== 'category' && parsed.type !== 'page') {
      return noPage(path?.join('/') ?? '');
    }

    // Homepage or specific page
    const row = await store.get(parsed.tagPath, parsed.slug);
    const page = row && await withAuthor(row);

    if (!page && parsed.type === 'homepage') return cachedJson(null, { ...CACHE.short, ...routeTags(CORPUS_TAG) });

    // A category with no hub article is still a page to a reader: the listing
    // the HTML shows. Its twin is that listing, or every section linked from a
    // crawler's copy of the wiki 404s.
    if (!page && parsed.type === 'category' && (mdSuffix || wantsMarkdown(request))) {
      const tag = findTagByPath(parsed.tagPath.split('/'));
      const sections = (tag?.children ?? []).filter(c => !c.hidden);
      const pages = await getCategoryPages(parsed.tagPath);
      // `cached` round-trips through JSON, so updatedAt arrives as a string whatever its type says.
      const updated = pages.reduce<Date | null>((d, p) => {
        const at = new Date(p.updatedAt);
        return !d || at > d ? at : d;
      }, null);
      const lastModified = updated?.toUTCString();
      const etag = corpusEtag([parsed.tagPath, pages.length, updated]);
      const headers = markdownHeaders(lastModified, { etag, noindex: true, extra: { ...CACHE.medium, ...VARY_ACCEPT, ...routeTags(pageTag(parsed.tagPath)) } });
      const unchanged = notModified(request, etag, lastModified ?? null, headers);
      if (unchanged) return unchanged;

      const link = (title: string, url: string) => `- [${title.replace(/[[\]]/g, '\\$&')}](${url})`;
      const body = [
        tag?.description,
        sections.length && `## Sections\n\n${sections.map(c => link(c.name, `${SITE_URL}/${parsed.tagPath}/${c.slug}`)).join('\n')}`,
        pages.length && `## Pages\n\n${pages.map(p => link(p.title, pageUrl(p.tagPath, p.slug))).join('\n')}`,
      ].filter(Boolean).join('\n\n');
      const title = tagLabel(parsed.tagPath.split('/'));
      return new NextResponse(
        markdownDocument({ title, url: `${SITE_URL}/${parsed.tagPath}`, updated, license: WIKI_LICENSE }, body),
        { headers },
      );
    }

    // The one 404 that is worth caching: a missing page is a hot path for crawlers.
    // It carries the page's tag, so the create that fills the address purges it.
    if (!page) return tagged(noPage(pagePath(parsed.tagPath, parsed.slug)), pageTag(parsed.tagPath, parsed.slug));

    // Agent-friendly text format: the `.md` twin, Accept negotiation, or an
    // explicit ?format=text. Real markdown, no component tags — dynamic
    // blocks are resolved so page lists render as link lists. This URL answers
    // two formats by Accept, so both answers carry `Vary: Accept`, or a shared
    // cache hands one client the other's.
    if (mdSuffix || wantsMarkdown(request)) {
      // `wiki-formant/http`, shared with the other twins. The TTL is passed
      // through rather than taken from the helper's default: this wiki caches
      // its twins for 60s where caper and acuiq2 cache theirs for an hour, and
      // reconciling that is a separate decision from removing the third copy of
      // the content type.
      //
      // The validator is the page's own revision, so a recrawl of an unchanged
      // page costs a 304 instead of a block resolve and a markdown render. The
      // twin is the most recrawled URL a page has and it was the one surface
      // here serving no ETag at all — it only ever 304'd where the edge
      // happened to synthesise a Last-Modified for it. The 304 carries the
      // same headers the 200 would, Cache-Control and Vary included, as RFC
      // 9110 requires.
      const lastModified = page.updatedAt.toUTCString();
      const etag = corpusEtag([page.tagPath, page.slug, page.version, page.updatedAt]);
      const headers = markdownHeaders(lastModified, { etag, noindex: true, extra: { ...CACHE.medium, ...VARY_ACCEPT, ...routeTags(pageTag(page.tagPath, page.slug)) } });
      const unchanged = notModified(request, etag, lastModified, headers);
      if (unchanged) return unchanged;
      const md = pageToMarkdown({
        title: page.title,
        url: pageUrl(page.tagPath, page.slug),
        content: await resolveBlockData((page.content as unknown as Block[]) || []),
        version: page.version,
        updatedAt: page.updatedAt,
        lastVerifiedAt: page.lastVerifiedAt,
      });
      return new NextResponse(md, { headers });
    }

    return cachedJson(page, { ...CACHE.short, ...VARY_ACCEPT, ...routeTags(pageTag(page.tagPath, page.slug)), 'Last-Modified': page.updatedAt.toUTCString() });
  }, 'Failed to fetch');
}

export async function POST(request: NextRequest, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const parsed = parsePath(path, 'api');

    // Restore revision
    if (parsed.type === 'history') {
      const auth = await requireAuth(request, { type: 'edit', tagPath: parsed.tagPath });
      if ('error' in auth) return auth.error;

      const page = await store.get(parsed.tagPath, parsed.slug);
      if (!page) return errors.notFound('Page not found');

      if (isAuthorOnlyPath(page.tagPath) && !canEditAuthorOnlyPage(toWikiPage(page), auth.session.userId)) {
        return errors.forbidden('You can only restore your own pages in this category');
      }

      if (isLockedPage(page.tagPath, parsed.slug)) {
        return errors.forbidden('This page is locked and cannot be modified');
      }

      const { revisionId } = await request.json();
      if (!revisionId) return errors.badRequest('Revision ID required');

      const restored = await store.restore(page.tagPath, page.slug, revisionId, { authorId: auth.session.userId });
      revalidatePage(page.tagPath, page.slug);
      return json({ success: true, version: restored.page.version });
    }

    // Create new page
    const body: WikiPageInput = await request.json();
    const { title, content, bannerImage, tagPath, metadata } = body;

    if (!title || !content) return errors.badRequest('Title and content required');
    if (!validateBlocks(content)) return errors.badRequest(`Invalid block structure: ${describeBlockIssues(blockIssues(content))}`);
    if (!tagPath || !isValidTagPath(tagPath.split('/'))) {
      return errors.badRequest('Valid tag path required');
    }

    const metaError = metadataError(tagPath, metadata);
    if (metaError) return metaError;

    const auth = await requireAuth(request, { type: 'create', tagPath });
    if ('error' in auth) return auth.error;

    let slug = body.slug || slugifyHeading(title);
    // The empty slug is the category's own hub article, which a create never takes.
    if (!slug) return errors.badRequest('The title has no letters or digits to make a slug from: send a slug');
    // A reserved slug is taken the way an existing page's is: a title like
    // "History" would otherwise land on a URL that opens the category's history.
    if (isReservedSlug(tagPath, slug) || await store.get(tagPath, slug)) slug = `${slug}-${Date.now().toString(36)}`;

    const { page: row } = await store.save({
      tagPath, slug, title, content: content as unknown as Block[],
      metadata: storedMetadata(metadata, {}, { banner: bannerImage ?? null }) ?? {},
      authorId: auth.session.userId,
    });
    const page = await withAuthor(row);

    const priorRevisions = await prisma.wikiRevision.count({ where: { authorId: auth.session.userId } });
    revalidatePage(tagPath, slug);
    deliverWebhooks('page.created', page, { changeType: 'major', message: 'Initial version', version: page.version }, { displayName: page.author?.displayName ?? null, radixAddress: auth.session.radixAddress });
    return json({ ...page, isFirstContribution: priorRevisions === 1 }, 201);
  }, 'Failed to create');
}

export async function PUT(request: NextRequest, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const parsed = parsePath(path, 'api');

    // Only the wiki's own rows take a write, as GET answers only them: the app
    // routes (/charts, /settings, …) parse with the homepage's empty tagPath and
    // slug, and a PUT to one of them, or to a page's /mdx, saved that row instead.
    if (parsed.type !== 'homepage' && parsed.type !== 'category' && parsed.type !== 'page') return errors.notFound('Invalid path');

    const auth = await requireAuth(request, { type: 'edit', tagPath: parsed.tagPath });
    if ('error' in auth) return auth.error;

    const body: Partial<WikiPageInput> & { revisionMessage?: string; newSlug?: string; editorIds?: string[]; verified?: boolean; baseVersion?: string } = await request.json();
    const { title, content, bannerImage, metadata, revisionMessage, newSlug, editorIds, verified, baseVersion } = body;

    if (content !== undefined && !validateBlocks(content)) {
      return errors.badRequest(`Invalid block structure: ${describeBlockIssues(blockIssues(content))}`);
    }

    const existing = await store.get(parsed.tagPath, parsed.slug);

    // Homepage creation if it doesn't exist
    if (!existing && parsed.type === 'homepage') {
      const { page } = await store.save({
        tagPath: '', slug: '', title: title || 'Homepage',
        content: (content as unknown as Block[]) || [],
        metadata: storedMetadata(undefined, {}, { banner: bannerImage ?? null }) ?? {},
        authorId: auth.session.userId,
      });
      revalidatePage('', '');
      return json(await withAuthor(page), 201);
    }

    if (!existing) return errors.notFound('Page not found');
    const current = toWikiPage(existing);

    // Only an article moves: the homepage and a hub article are their path's empty slug.
    const slugUpdate = parsed.type === 'page' && newSlug && newSlug !== existing.slug ? slugifyHeading(newSlug) : undefined;
    // A rename has no suffix to fall back on, so a reserved slug is refused outright.
    if (slugUpdate && isReservedSlug(existing.tagPath, slugUpdate)) return errors.badRequest('That slug belongs to a view or a subcategory of this section');

    if (parsed.type !== 'homepage' && isAuthorOnlyPath(existing.tagPath) && !canEditAuthorOnlyPage(current, auth.session.userId)) {
      return errors.forbidden('You can only edit your own pages in this category');
    }

    if (isLockedPage(existing.tagPath, existing.slug)) {
      return errors.forbidden('This page is locked and cannot be edited');
    }

    if (metadata !== undefined) {
      const metaError = metadataError(existing.tagPath, metadata);
      if (metaError) return metaError;
    }

    const isAuthor = existing.authorId === auth.session.userId;
    const result = await store.save({
      tagPath: existing.tagPath, slug: existing.slug, newSlug: slugUpdate,
      title, content: content as unknown as Block[] | undefined,
      metadata: storedMetadata(metadata, existing.metadata, {
        banner: bannerImage,
        editors: isAuthor ? editorIds : undefined,
      }),
      authorId: auth.session.userId, message: revisionMessage,
      // The editor's word that the page's facts were checked against its
      // sources: it retires the freshness banner without an edit.
      verified, baseVersion,
    });
    const page = await withAuthor(result.page);

    if (existing.authorId && !isAuthor) {
      const userId = existing.authorId;
      after(() => prisma.notification.create({ data: { userId, actorId: auth.session.userId, type: 'page_edited', pageId: existing.id } }).catch(() => {}));
    }
    const totalRevisions = await prisma.wikiRevision.count({ where: { authorId: auth.session.userId } });
    // A rename expires the old URL and the new one, which may hold a cached 404.
    revalidatePage(existing.tagPath, existing.slug, page.slug);
    if (result.changeType !== 'none') {
      deliverWebhooks('page.updated', page, { changeType: result.changeType, message: revisionMessage ?? null, version: page.version }, { displayName: page.author?.displayName ?? null, radixAddress: auth.session.radixAddress });
    }
    return json({ ...page, isFirstContribution: totalRevisions === 1 });
  }, 'Failed to update');
}

export async function DELETE(request: NextRequest, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const parsed = parsePath(path, 'api');

    if (parsed.type !== 'page') return errors.notFound('Invalid path');

    const auth = await requireAuth(request);
    if ('error' in auth) return auth.error;

    const existing = await store.get(parsed.tagPath, parsed.slug);
    if (!existing) return errors.notFound('Page not found');
    if (isLockedPage(existing.tagPath, existing.slug)) return errors.forbidden('This page is locked and cannot be deleted');

    // Authors delete their own pages. On a shared board the card belongs to the
    // board, so anyone who clears the bar to edit it may also delete it.
    if (existing.authorId !== auth.session.userId) {
      if (!isSharedPath(existing.tagPath)) return errors.forbidden();
      const check = await requireBalance(auth.session, { type: 'edit', tagPath: existing.tagPath });
      if (!check.ok) return check.response;
    }

    await deletePage(existing);
    revalidatePage(existing.tagPath, existing.slug);
    deliverWebhooks('page.deleted', toWikiPage(existing), null, { displayName: null, radixAddress: auth.session.radixAddress });
    return json({ success: true });
  }, 'Failed to delete');
}
