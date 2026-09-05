// src/app/api/wiki/[[...path]]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma/client';
import { Prisma } from '@prisma/client';
import { slugify, pageUrl } from '@/lib/utils';
import { isValidTagPath, isAuthorOnlyPath, isLockedPage, isSharedPath, canEditAuthorOnlyPage, getMetadataKeys } from '@/lib/tags';
import { requireBalance } from '@/lib/radix/balance';
import { json, errors, handleRoute, requireAuth, parsePagination, paginatedResponse, cachedJson, CACHE, type RouteContext } from '@/lib/api';
import { computeRevisionDiff, formatVersion, parseVersion, incrementVersion, type BlockChange } from '@/lib/versioning';
import { parsePath, orderByIds, searchPageIds, summarizePage, resolveBlockData, loadPageHistory, AUTHOR_SELECT, PAGE_INCLUDE, PAGE_LIST_SELECT, SUMMARY_SELECT } from '@/lib/wiki';
import { validateBlocks } from '@/lib/block-utils';
import { blocksToMdx } from '@/lib/mdx';
import { pageToMarkdown } from '@/lib/markdown';
import type { WikiPageInput, PageMetadata } from '@/types';
import type { Block } from '@/types/blocks';
import { deliverWebhooks } from '@/lib/webhooks';
import { corpusEtag, markdownHeaders, notModified } from 'wiki-formant/http';

type PathParams = { path?: string[] };

const INITIAL_VERSION = '1.0.0';

/** A page and its first revision, in one transaction — POST for an article, PUT
 *  for the homepage row when it does not exist yet. */
type NewPage = Pick<Prisma.PageUncheckedCreateInput, 'tagPath' | 'slug' | 'bannerImage' | 'metadata'>
  & { title: string; content: Prisma.InputJsonValue };

function createPage(data: NewPage, authorId: string) {
  return prisma.$transaction(async (tx) => {
    const page = await tx.page.create({
      data: { ...data, version: INITIAL_VERSION, authorId },
      include: { author: AUTHOR_SELECT },
    });
    await tx.revision.create({
      data: {
        pageId: page.id, title: data.title, content: data.content,
        version: INITIAL_VERSION, changeType: 'major',
        changes: [] as unknown as Prisma.InputJsonValue,
        authorId, message: 'Initial version',
      },
    });
    return page;
  });
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
  const path = mdSuffix && rawPath ? [...rawPath.slice(0, -1), last!.slice(0, -3)] : rawPath;
  const parsed = parsePath(path, 'api');

  return handleRoute(async () => {
    const { searchParams } = new URL(request.url);

    // MDX export
    if (parsed.type === 'mdx') {
      const page = await prisma.page.findUnique({
        where: { tagPath_slug: { tagPath: parsed.tagPath, slug: parsed.slug } },
        include: { author: AUTHOR_SELECT },
      });
      if (!page) return errors.notFound('Page not found');

      return new NextResponse(blocksToMdx(page), {
        headers: {
          'Content-Type': 'text/mdx; charset=utf-8',
          'Content-Disposition': `attachment; filename="${page.slug || 'homepage'}.mdx"`,
        },
      });
    }

    // List mode
    if (!path?.length && (searchParams.has('page') || searchParams.has('pageSize') || searchParams.has('q') || searchParams.has('tagPath') || searchParams.has('sort') || searchParams.has('ids'))) {
      // Batch lookup by id, the shape `/api/users/search?ids=` already uses: it
      // hydrates a pageList block's stored ids on the client.
      const idsParam = searchParams.get('ids');
      if (idsParam !== null) {
        const ids = idsParam.split(',').filter(Boolean).slice(0, 50);
        if (!ids.length) return json([]);
        const rows = await prisma.page.findMany({ where: { id: { in: ids } }, select: PAGE_LIST_SELECT });
        // The author's chosen order, not the database's: getPagesByIds already
        // orders its server-resolved twin this way, and a pageList block that
        // hydrates on the client must not reshuffle itself.
        return json(orderByIds(rows, ids));
      }

      const { page, pageSize } = parsePagination(searchParams);
      const q = searchParams.get('q')?.trim() || '';
      const tagPath = searchParams.get('tagPath');
      const sort = searchParams.get('sort') || 'updatedAt';

      const where: Prisma.PageWhereInput = {};
      if (tagPath) where.tagPath = tagPath;

      if (q) {
        // The GET-only twin of MCP search_wiki: identical ranking (titles ahead
        // of body prose) and row-identical results via the same summarizer.
        const { ids, total, headlines } = await searchPageIds(q, { tagPath, skip: (page - 1) * pageSize, take: pageSize });
        const matches = ids.length ? await prisma.page.findMany({ where: { id: { in: ids } }, select: { id: true, ...SUMMARY_SELECT } }) : [];
        return cachedJson(paginatedResponse(orderByIds(matches, ids).map(p => summarizePage(p, q, headlines.get(p.id))), total, page, pageSize));
      }

      const orderBy = sort === 'title' ? { title: 'asc' as const } : { updatedAt: 'desc' as const };

      const [pages, total] = await Promise.all([
        prisma.page.findMany({
          where,
          select: PAGE_LIST_SELECT,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.page.count({ where }),
      ]);

      return cachedJson(paginatedResponse(pages, total, page, pageSize));
    }

    if (parsed.type === 'invalid') return errors.notFound('Invalid path');

    // History mode — the uncached read, so a direct-DB script write shows up here
    // the moment it lands rather than after the `wiki` tag next revalidates.
    if (parsed.type === 'history') {
      const history = await loadPageHistory(parsed.tagPath, parsed.slug);
      if (!history) return errors.notFound('Page not found');
      return cachedJson(history);
    }

    // Homepage or specific page
    const page = await prisma.page.findUnique({
      where: { tagPath_slug: { tagPath: parsed.tagPath, slug: parsed.slug } },
      include: PAGE_INCLUDE,
    });

    if (!page && parsed.type === 'homepage') return cachedJson(null);
    // The one 404 that is worth caching: a missing page is a hot path for crawlers.
    if (!page) return cachedJson({ error: 'Page not found' }, CACHE.short, 404);

    // Agent-friendly text format: the `.md` twin, Accept negotiation, or an
    // explicit ?format=text. Real markdown, no component tags — dynamic
    // blocks are resolved so page lists render as link lists.
    const accept = request.headers.get('accept') || '';
    if (mdSuffix || accept.includes('text/markdown') || accept.includes('text/plain') || searchParams.get('format') === 'text') {
      const md = pageToMarkdown({
        title: page.title,
        url: pageUrl(page.tagPath, page.slug),
        content: await resolveBlockData((page.content as unknown as Block[]) || []),
        version: page.version,
        updatedAt: page.updatedAt,
        lastVerifiedAt: page.lastVerifiedAt,
      });
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
      // happened to synthesise a Last-Modified for it.
      const lastModified = page.updatedAt.toUTCString();
      const etag = corpusEtag([page.tagPath, page.slug, page.version, page.updatedAt]);
      return (
        notModified(request, etag, lastModified) ??
        new NextResponse(md, {
          headers: markdownHeaders(lastModified, { etag, extra: CACHE.medium }),
        })
      );
    }

    return cachedJson(page, { ...CACHE.short, 'Last-Modified': page.updatedAt.toUTCString() });
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

      const page = await prisma.page.findUnique({
        where: { tagPath_slug: { tagPath: parsed.tagPath, slug: parsed.slug } },
        select: { id: true, title: true, content: true, bannerImage: true, version: true, authorId: true, editorIds: true, tagPath: true },
      });
      if (!page) return errors.notFound('Page not found');

      if (isAuthorOnlyPath(page.tagPath) && !canEditAuthorOnlyPage(page, auth.session.userId)) {
        return errors.forbidden('You can only restore your own pages in this category');
      }

      if (isLockedPage(page.tagPath, parsed.slug)) {
        return errors.forbidden('This page is locked and cannot be modified');
      }

      const { revisionId } = await request.json();
      if (!revisionId) return errors.badRequest('Revision ID required');

      const revision = await prisma.revision.findFirst({ where: { id: revisionId, pageId: page.id } });
      if (!revision) return errors.notFound('Revision not found');

      const newVersion = incrementVersion(parseVersion(page.version), 'major');
      const content = revision.content as Prisma.InputJsonValue;

      await prisma.$transaction([
        prisma.page.update({
          where: { id: page.id },
          data: { title: revision.title, content, version: formatVersion(newVersion) },
        }),
        prisma.revision.create({
          data: {
            pageId: page.id, title: revision.title, content,
            version: formatVersion(newVersion), changeType: 'major',
            changes: [] as unknown as Prisma.InputJsonValue,
            authorId: auth.session.userId, message: `Restored to v${revision.version}`,
          },
        }),
      ]);

      revalidateTag('wiki', { expire: 0 });
      return json({ success: true, version: formatVersion(newVersion) });
    }

    // Create new page
    const body: WikiPageInput = await request.json();
    const { title, content, bannerImage, tagPath, metadata } = body;

    if (!title || !content) return errors.badRequest('Title and content required');
    if (!validateBlocks(content)) return errors.badRequest('Invalid block structure');
    if (!tagPath || !isValidTagPath(tagPath.split('/'))) {
      return errors.badRequest('Valid tag path required');
    }

    const metaError = metadataError(tagPath, metadata);
    if (metaError) return metaError;

    const auth = await requireAuth(request, { type: 'create', tagPath });
    if ('error' in auth) return auth.error;

    let slug = body.slug || slugify(title);
    const existing = await prisma.page.findUnique({ where: { tagPath_slug: { tagPath, slug } } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const page = await createPage({
      tagPath, slug, title, bannerImage,
      content: content as unknown as Prisma.InputJsonValue,
      metadata: metadata as unknown as Prisma.InputJsonValue,
    }, auth.session.userId);

    const priorRevisions = await prisma.revision.count({ where: { authorId: auth.session.userId } });
    revalidateTag('wiki', { expire: 0 });
    deliverWebhooks('page.created', page, { changeType: 'major', message: 'Initial version', version: INITIAL_VERSION }, { displayName: page.author?.displayName ?? null, radixAddress: auth.session.radixAddress });
    return json({ ...page, isFirstContribution: priorRevisions === 1 }, 201);
  }, 'Failed to create');
}

export async function PUT(request: NextRequest, context: RouteContext<PathParams>) {
  return handleRoute(async () => {
    const { path } = await context.params;
    const parsed = parsePath(path, 'api');

    if (parsed.type === 'invalid' || parsed.type === 'history') return errors.notFound('Invalid path');

    const auth = await requireAuth(request, { type: 'edit', tagPath: parsed.tagPath });
    if ('error' in auth) return auth.error;

    const body: Partial<WikiPageInput> & { revisionMessage?: string; newSlug?: string; editorIds?: string[] } = await request.json();
    const { title, content, bannerImage, metadata, revisionMessage, newSlug, editorIds } = body;

    if (content !== undefined && !validateBlocks(content)) {
      return errors.badRequest('Invalid block structure');
    }

    const existing = await prisma.page.findUnique({ where: { tagPath_slug: { tagPath: parsed.tagPath, slug: parsed.slug } } });

    // Homepage creation if it doesn't exist
    if (!existing && parsed.type === 'homepage') {
      const page = await createPage({
        tagPath: '', slug: '', bannerImage,
        title: title || 'Homepage',
        content: (content as unknown as Prisma.InputJsonValue) || {},
      }, auth.session.userId);

      revalidateTag('wiki', { expire: 0 });
      return json(page, 201);
    }

    if (!existing) return errors.notFound('Page not found');

    const slugUpdate = newSlug && newSlug !== existing.slug ? slugify(newSlug) : undefined;
    if (slugUpdate) {
      const conflict = await prisma.page.findUnique({ where: { tagPath_slug: { tagPath: existing.tagPath, slug: slugUpdate } } });
      if (conflict) return errors.badRequest('A page with that slug already exists in this category');
    }

    if (parsed.type !== 'homepage' && isAuthorOnlyPath(existing.tagPath) && !canEditAuthorOnlyPage(existing, auth.session.userId)) {
      return errors.forbidden('You can only edit your own pages in this category');
    }

    if (isLockedPage(existing.tagPath, existing.slug)) {
      return errors.forbidden('This page is locked and cannot be edited');
    }

    let newVersion = existing.version;
    let changeType: string = 'patch';
    let changes: BlockChange[] = [];

    if (content || title) {
      const oldContent = (existing.content as unknown as Block[]) || [];
      const newContent = (content as unknown as Block[]) || oldContent;

      const diff = computeRevisionDiff(
        existing.version, oldContent, newContent,
        existing.title, title || existing.title,
        existing.bannerImage, bannerImage ?? existing.bannerImage
      );

      newVersion = formatVersion(diff.version);
      changeType = diff.changeType;
      changes = diff.changes;
    }

    if (metadata !== undefined) {
      const metaError = metadataError(existing.tagPath, metadata);
      if (metaError) return metaError;
    }

    const page = await prisma.$transaction(async (tx) => {
      const p = await tx.page.update({
        where: { id: existing.id },
        data: {
          title: title ?? undefined, slug: slugUpdate ?? undefined,
          content: content !== undefined ? (content as unknown as Prisma.InputJsonValue) : undefined,
          bannerImage: bannerImage ?? undefined,
          metadata: metadata !== undefined ? (metadata as unknown as Prisma.InputJsonValue) : undefined,
          version: newVersion,
          ...(editorIds !== undefined && existing.authorId === auth.session.userId ? { editorIds } : {}),
        },
        include: { author: AUTHOR_SELECT },
      });

      if (content || title) {
        await tx.revision.create({
          data: {
            pageId: p.id, title: title || existing.title,
            content: content ? (content as unknown as Prisma.InputJsonValue) : (existing.content as Prisma.InputJsonValue),
            version: newVersion, changeType,
            changes: changes as unknown as Prisma.InputJsonValue,
            authorId: auth.session.userId, message: revisionMessage,
          },
        });
      }

      return p;
    });

    if (existing.authorId !== auth.session.userId) {
      prisma.notification.create({ data: { userId: existing.authorId, actorId: auth.session.userId, type: 'page_edited', pageId: existing.id } }).catch(() => {});
    }
    const totalRevisions = await prisma.revision.count({ where: { authorId: auth.session.userId } });
    revalidateTag('wiki', { expire: 0 });
    if (content || title) {
      deliverWebhooks('page.updated', page, { changeType, message: revisionMessage ?? null, version: newVersion }, { displayName: page.author?.displayName ?? null, radixAddress: auth.session.radixAddress });
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

    const existing = await prisma.page.findUnique({ where: { tagPath_slug: { tagPath: parsed.tagPath, slug: parsed.slug } } });
    if (!existing) return errors.notFound('Page not found');
    if (isLockedPage(existing.tagPath, existing.slug)) return errors.forbidden('This page is locked and cannot be deleted');

    // Authors delete their own pages. On a shared board the card belongs to the
    // board, so anyone who clears the bar to edit it may also delete it.
    if (existing.authorId !== auth.session.userId) {
      if (!isSharedPath(existing.tagPath)) return errors.forbidden();
      const check = await requireBalance(auth.session, { type: 'edit', tagPath: existing.tagPath });
      if (!check.ok) return check.response;
    }

    await prisma.page.delete({ where: { id: existing.id } });
    revalidateTag('wiki', { expire: 0 });
    deliverWebhooks('page.deleted', existing, null, { displayName: null, radixAddress: auth.session.radixAddress });
    return json({ success: true });
  }, 'Failed to delete');
}
