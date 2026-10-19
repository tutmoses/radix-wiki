// src/app/[[...path]]/page.tsx

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { parsePath } from '@/lib/path';
import { getHomepage, getPage, getCategoryHub, getCategoryPages, getSubtreeRefs, getPageRef, isIdeasPath, getIdeasPages, getPageHistory, resolveBlockData, getPageByAsset } from '@/lib/wiki';
import { getMaintenanceQueues } from '@/lib/maintenance';
import { getSession } from '@/lib/auth';
import { rankRelated, taxonomy } from '@/lib/taxonomy';
import { categoryView } from 'wiki-formant/category';
import { findTagByPath, getMainArticle, getSortOrder, tagLabel, tagPaths, TAG_TREE, type SortOrder } from '@/lib/tags';
import { highlightBlocks } from '@/lib/highlight';
import { processBlocks } from '@/lib/html';
import { sanitizePage } from '@/lib/sanitize';
import { NowProvider } from '@/lib/now';
// Payloads carry wallet-authored titles and excerpts, so they go out through
// `wiki-formant/react-server`'s JsonLd, which escapes an authored `</script>`.
import { JsonLd } from 'wiki-formant/react-server';
import { chartsHeadline } from '@/lib/radix/headline';
import { articleLd, citationsFromReferences, collectionLd, describe, documentTitle, faqPageLd, questionPairs } from 'wiki-formant/metadata';
import { hasCodeBlocksInContent } from '@/lib/block-utils';
import { STATIC_PAGES } from '@/lib/static-pages';
import { prisma } from '@/lib/prisma/client';
import { PageView, HomepageView, CategoryView, PageSkeleton, HistoryView, type RelatedPages } from './PageContent';
import dynamic from 'next/dynamic';

const IdeasView = dynamic(() => import('./IdeasView'), { loading: () => <PageSkeleton /> });
const LeaderboardView = dynamic(() => import('@/components/LeaderboardView'), { loading: () => <PageSkeleton /> });
const SettingsView = dynamic(() => import('@/components/SettingsView'), { loading: () => <PageSkeleton /> });
const SearchView = dynamic(() => import('@/components/SearchView'), { loading: () => <PageSkeleton /> });
const MaintenanceView = dynamic(() => import('@/components/MaintenanceView'), { loading: () => <PageSkeleton /> });
const SiteStats = dynamic(() => import('@/components/SiteStats'), { loading: () => <PageSkeleton /> });
import ChartsOverview from '@/components/charts/ChartsOverview';
import ValidatorsView from '@/components/charts/ValidatorsView';
import TokensView from '@/components/charts/TokensView';
import TokenDetailView from '@/components/charts/TokenDetailView';
import { pageDescription, pageUrl } from '@/lib/utils';
import { slugifyHeading } from 'wiki-formant/headings';
import { SITE_DESCRIPTION, SITE_NAME, SITE_REFS, SITE_URL, WIKI_LICENSE } from '@/lib/site';
import { ogMetadata, ogImageUrl } from '@/lib/og';
import { articleType, aboutEntity, articleLearningProps } from '@/lib/entity-ld';
import { getTokenDetail } from '@/lib/radix/tokens';
import { getEditorScores, publicScore } from '@/lib/scoring';
import type { Block } from '@/types/blocks';
import type { WikiPage } from '@/types';
import { BLOCK_SHAPE, leafBlocks } from '@/lib/block-shape';
import { someBlock } from 'wiki-formant/blocks';

export async function generateStaticParams() {
  const pages = await prisma.wikiPage.findMany({ select: { tagPath: true, slug: true } });
  // Hidden paths included: they are prebuilt like any other, just unlisted.
  const categories = tagPaths().map(t => t.path).filter(Boolean);

  return [
    { path: [] },
    ...categories.map(p => ({ path: p.split('/') })),
    ...pages.filter(p => p.tagPath && p.slug).map(p => ({ path: [...p.tagPath.split('/'), p.slug] })),
  ];
}

/** How many article links a section card carries before it defers to its own page. */

export const dynamicParams = true;
// A day, not a minute: every API write that changes what a page renders busts the
// `wiki` tag (`revalidateTag` in the wiki, comments and auth routes), so an edit
// shows at once and the timer only backstops. At 60s every article was re-rendered
// and rewritten to ISR each minute. `CACHE_OPTS` in lib/wiki.ts must match, or its
// shorter revalidate pins the page back down.
export const revalidate = 86400;

// Facet keys are open-ended — a tag path's `select` metadata keys decide them.
type Props = { params: Promise<{ path?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const NOINDEX_ROBOTS = { index: false, follow: true, googleBot: { index: false, follow: true } } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  const parsed = parsePath(path);

  // Token detail — derive unique metadata from on-chain data
  if (parsed.type === 'token-detail' && parsed.tokenAddress) {
    const token = await getTokenDetail(parsed.tokenAddress);
    if (!token) notFound();
    const canonical = `${SITE_URL}/charts/tokens/${parsed.tokenAddress}`;
    const label = token.symbol || token.name || 'Token';
    const fullName = token.name && token.symbol && token.name !== token.symbol ? `${token.name} (${token.symbol})` : (token.name || token.symbol || 'Token');
    const title = `${label} — Token on Radix`;
    const baseDesc = `${fullName}. Live price, supply, holders, and trading volume on the Radix network.`;
    const extraDesc = token.description ? ` ${token.description.replace(/\s+/g, ' ').trim()}` : '';
    const description = (baseDesc + extraDesc).slice(0, 160);
    return { title, description, ...ogMetadata({ title, description, url: canonical, type: 'article' }) };
  }

  // The non-article routes — homepage included — read their metadata off the
  // one table that also drives the sitemap and llms.txt.
  const staticPage = STATIC_PAGES[parsed.type];
  if (staticPage) {
    const { path: staticPath, title, description, noindex, absoluteTitle, imageTitle } = staticPage;
    const url = staticPath ? `${SITE_URL}/${staticPath}` : SITE_URL;
    // /charts unfurls with its numbers; the meta description stays the fixed one search indexes.
    const live = parsed.type === 'charts' ? await chartsHeadline() : null;
    const og = ogMetadata({ title, description: live ?? description, url, imageTitle });
    return {
      title: absoluteTitle ? { absolute: title } : title,
      description,
      ...(noindex
        ? { robots: NOINDEX_ROBOTS, alternates: { canonical: url } }
        : parsed.type === 'homepage'
          // `markdownTwin` would advertise `${url}.md`, which on a bare origin is
          // another host; the homepage's twin is /index.md.
          ? { ...og, alternates: { ...og.alternates, types: { 'text/markdown': `${SITE_URL}/index.md` } } }
          : og),
    };
  }

  // Category pages — unique title + description from the hub article if there is
  // one, else from the tag hierarchy.
  if (parsed.type === 'category') {
    const tagSegments = parsed.tagPath.split('/');
    const tag = findTagByPath(tagSegments);
    const hub = await getCategoryHub(parsed.tagPath);
    const categoryName = tagLabel(tagSegments);
    const parentPath = tagSegments.slice(0, -1).join(' › ');
    const hubExcerpt = (hub?.metadata as Record<string, string> | null)?.excerpt;
    const title = hub?.title || categoryName;
    const description = hubExcerpt || tag?.description
      || `${categoryName} on RADIX Wiki${parentPath ? ` (${parentPath})` : ''} — browse community-maintained pages covering ${categoryName.toLowerCase()} in the Radix DLT ecosystem.`;
    return {
      title, description,
      ...ogMetadata({
        title, description,
        url: `${SITE_URL}/${parsed.tagPath}`, tagPath: parsed.tagPath,
        banner: hub?.bannerImage,
        // Every category has a twin: its hub article, or else its listing.
        markdownTwin: true,
      }),
    };
  }

  // Edit, history, and mdx variants shouldn't be indexed (they produce near-duplicate content)
  if (parsed.type === 'edit' || parsed.type === 'history' || parsed.type === 'mdx') {
    const label = parsed.type === 'edit' ? 'Edit' : parsed.type === 'history' ? 'Revision history' : 'MDX export';
    return {
      // The layout's template adds the site name; carrying it here doubled it.
      title: label,
      description: `${label} view on RADIX Wiki.`,
      robots: NOINDEX_ROBOTS,
      alternates: { canonical: `${SITE_URL}/${parsed.tagPath}/${parsed.slug}`.replace(/\/+$/, '') || SITE_URL },
    };
  }

  let page = null;
  if (parsed.type === 'page') page = await getPage(parsed.tagPath, parsed.slug);

  // Missing page: 404 for unauthenticated visitors (incl. crawlers); for logged-in users render the
  // page-creation editor with noindex metadata so the URL still becomes a real 404 in GSC.
  if (parsed.type === 'page' && !page) {
    const session = await getSession();
    if (!session) notFound();
    return {
      title: 'New page',
      description: 'Create a new page on RADIX Wiki.',
      robots: NOINDEX_ROBOTS,
      alternates: { canonical: `${SITE_URL}/${parsed.tagPath}/${parsed.slug}` },
    };
  }

  const title = page?.title || SITE_NAME;
  // The short form for the tab and the SERP, where the template spends 13 of the
  // budget on " | RADIX Wiki"; the rule and its reasoning are in the package.
  // Social cards are not length-constrained the same way and keep `title`.
  const seoTitle = documentTitle(title, page?.metadata);
  const snippet = pageDescription(page);
  const sectionName = sectionOf(page?.tagPath);
  // The page's own excerpt where it has one, else its opening block, so the
  // description never goes stale against the article
  const description = snippet
    || (page
      ? `${title}${sectionName ? ` — a ${sectionName} article` : ''} on RADIX Wiki, the community-maintained knowledge base for the Radix DLT ecosystem.`
      : SITE_DESCRIPTION);
  const segments = path?.length ? path.join('/') : '';
  const canonical = segments ? `${SITE_URL}/${segments}` : SITE_URL;

  return {
    title: seoTitle,
    description,
    ...ogMetadata({
      title, description, url: canonical, type: 'article',
      tagPath: page?.tagPath, banner: page?.bannerImage,
      article: {
        ...(page?.createdAt && { publishedTime: new Date(page.createdAt).toISOString() }),
        ...(page?.updatedAt && { modifiedTime: new Date(page.updatedAt).toISOString() }),
        ...(sectionName && { section: sectionName }),
        ...(page?.tagPath && { tags: page.tagPath.split('/') }),
      },
      // Wiki pages advertise their markdown twin so agents landing on the HTML
      // find the clean-text variant without having read llms.txt first.
      markdownTwin: !!page,
    }),
  };
}

/** Keys that generator scripts park in `metadata` and nothing in the app ever reads.
 *  `state` is the wiki-maintenance-log sweep's own store — backlog, run history,
 *  per-source records — and it had grown past half a megabyte. Every prop of a client
 *  component is serialized into the page's RSC payload, so a reader was downloading
 *  the entire run history in order to look at the ten rows the page renders.
 *  Stripped on the display path only; the edit path keeps the raw row, so a save
 *  round-trips the state intact. */
const NON_RENDER_METADATA = ['state'];

async function withProcessedContent<T extends { title: string; content: unknown; metadata?: unknown }>(stored: T | null): Promise<T | null> {
  if (!stored || !Array.isArray(stored.content)) return stored;
  // Sanitise first, then decorate. Highlighting re-serialises the whole block
  // through rehype, which would carry an `onerror` straight through, and the
  // heading anchors and link rewrites below are our own markup.
  const page = sanitizePage(stored);
  let content = page.content as Block[];
  content = await resolveBlockData(content);
  if (hasCodeBlocksInContent(content)) content = await highlightBlocks(content);
  // Normalise HTML server-side so SSR output has demoted h1s, alt attrs, and correct link attributes.
  // The title's id is reserved: PageView renders it as the page's <h1 id>.
  content = processBlocks(content, [slugifyHeading(page.title)]);
  const metadata = page.metadata && typeof page.metadata === 'object'
    ? Object.fromEntries(Object.entries(page.metadata as Record<string, unknown>).filter(([k]) => !NON_RENDER_METADATA.includes(k)))
    : page.metadata;
  return { ...page, content, metadata };
}

function countWords(blocks: unknown): number {
  if (!Array.isArray(blocks)) return 0;
  const text = leafBlocks(blocks as Block[])
    .map(b => (b.type === 'content' ? (b.text || '').replace(/<[^>]+>/g, '') : ''))
    .join(' ');
  return text.split(/\s+/).filter(Boolean).length;
}

/** The top-level section a page files under: `article:section` and `articleSection` both. */
function sectionOf(tagPath: string | null | undefined): string | undefined {
  const top = tagPath?.split('/')[0];
  return top ? tagLabel([top]) : undefined;
}

/**
 * The page as an Article. The envelope and the citations are
 * `wiki-formant/metadata`; `extra` carries what only this wiki states.
 */
function pageLd(page: WikiPage, url: string) {
  const section = sectionOf(page.tagPath);
  const description = pageDescription(page);
  // Google recommends an image on every article; pages without a banner get the
  // same generated card the OG tags already use, rather than no image at all.
  const image = page.bannerImage || ogImageUrl({ title: page.title, tagPath: page.tagPath });
  const about = aboutEntity(page.tagPath, page.title, page.metadata, { description, image });
  // References blocks are usually top-level, but infobox/columns can nest them.
  const references = Array.isArray(page.content)
    ? leafBlocks(page.content as unknown as Block[]).flatMap(b => (b.type === 'references' ? b.items ?? [] : []))
    : [];
  return articleLd({
    type: articleType(page.tagPath),
    headline: page.title,
    url,
    description,
    image,
    published: page.createdAt,
    modified: page.updatedAt,
    // Name only — the wiki doesn't publish the displayName↔wallet mapping, so no
    // address identifier or explorer URL in structured data.
    author: { '@type': 'Person', name: page.author?.displayName || 'Anonymous' },
    publisher: SITE_REFS.organization,
    isPartOf: SITE_REFS.website,
    license: WIKI_LICENSE.url,
    citation: citationsFromReferences(references),
    extra: {
      wordCount: countWords(page.content),
      ...(section && { articleSection: section }),
      ...(page.version && { version: page.version }),
      ...(about && { about }),
      ...articleLearningProps(page.tagPath, page.metadata),
    },
  });
}

/**
 * The page as an FAQPage, when its content blocks ask two or more questions in
 * their own h2/h3 headings; null otherwise. Columns nest content blocks, so the
 * walk is over leaves.
 */
function pageFaqLd(page: WikiPage, url: string) {
  if (!Array.isArray(page.content)) return null;
  const html = leafBlocks(page.content as unknown as Block[])
    .map(b => (b.type === 'content' ? b.text || '' : ''))
    .join('\n');
  return faqPageLd(questionPairs(html), url);
}

/** `items` are the category's pages, or — for a container that holds none — its sections. */
function categoryLd(name: string, url: string, items: ({ title: string; tagPath: string; slug: string } | { name: string; href: string })[], description?: string) {
  return collectionLd({
    name, url, description, isPartOf: SITE_REFS.website, max: 50,
    items: items.map(item => ('href' in item
      ? { name: item.name, url: `${SITE_URL}${item.href}` }
      : { name: item.title, url: pageUrl(item.tagPath, item.slug) })),
  });
}

/**
 * Whether a page's blocks contain a link to exactly `href`. Matched against the
 * block texts rather than `JSON.stringify(content)`: the serialised form escapes
 * the quotes this depends on, so the closing quote never matches and every path
 * looks linked.
 */
function linksTo(content: unknown, href: string): boolean {
  const needle = `href="${href}"`;
  return Array.isArray(content) && someBlock(
    content as Block[],
    b => 'text' in b && typeof b.text === 'string' && b.text.includes(needle),
    BLOCK_SHAPE.containers,
  );
}

const VALID_SORTS = new Set<string>(['title', 'recent']);

// Read the clock once, here on the server, and hand it to the views: as a prop
// where a view needs it to decide something (the freshness banner), and through
// `NowProvider` to everything that renders a relative time. Read inside a 'use
// client' render instead, the clock is one value in the cached HTML and a later
// one at hydration, and the text disagrees.
export default async function DynamicPage(props: Props) {
  const nowMs = Date.now();
  return <NowProvider now={nowMs}>{await renderRoute(props, nowMs)}</NowProvider>;
}

async function renderRoute({ params, searchParams }: Props, nowMs: number) {
  const { path } = await params;
  const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
  const parsed = parsePath(path);

  // `searchParams` is deliberately NOT awaited here. It is a dynamic API, and
  // touching it anywhere in this render marks the whole route dynamic — which
  // it was: every article re-rendered from the database on every request while
  // `generateStaticParams` prebuilt a manifest nothing ever read and
  // `revalidate` governed a cache nothing ever wrote. Three branches out of a
  // dozen actually read a query string, so each awaits it for itself and the
  // rest prerender. Any new `await searchParams` above a branch undoes this for
  // the whole wiki; check `next build` still reports this route as SSG.

  if (parsed.type === 'invalid') notFound();

  // The page-level /mdx URL is an export, not a page — send it to the API route
  // instead of rendering a duplicate article at a noindex URL.
  if (parsed.type === 'mdx') redirect(parsed.slug ? `/api/wiki/${parsed.tagPath}/${parsed.slug}/mdx` : '/api/wiki/mdx');

  if (parsed.type === 'search') return <SearchView query={str((await searchParams).q) ?? ''} />;
  if (parsed.type === 'maintenance') return <MaintenanceView queues={await getMaintenanceQueues()} />;
  if (parsed.type === 'stats') {
    const query = await searchParams;
    return <SiteStats query={query} invite={str(query.invite)} />;
  }
  if (parsed.type === 'leaderboard') return <LeaderboardView entries={(await getEditorScores()).map(publicScore)} />;
  // `?watch=` names the page or section a Telegram subscription is offered for:
  // Tools → Watch sends a reader here to connect Telegram first.
  if (parsed.type === 'settings') return <SettingsView watch={str((await searchParams).watch)} />;
  if (parsed.type === 'charts') return <ChartsOverview />;
  if (parsed.type === 'charts-validators') return <ValidatorsView />;
  if (parsed.type === 'charts-tokens') return <TokensView />;
  if (parsed.type === 'token-detail' && parsed.tokenAddress) {
    const wikiPage = await getPageByAsset(parsed.tokenAddress);
    return <TokenDetailView address={parsed.tokenAddress} wikiPage={wikiPage} />;
  }

  if (parsed.type === 'homepage') {
    const page = await withProcessedContent(await getHomepage());
    return <HomepageView page={page} isEditing={false} />;
  }

  // Every editor gets the stored row, cleaned but undecorated, as an article's
  // does below. The processed row carries heading anchors, resolved page lists
  // and highlighted code, and the homepage editor saved all three back.
  if (parsed.type === 'edit' && !parsed.tagPath && !parsed.slug) {
    const page = await getHomepage();
    return <HomepageView page={page && sanitizePage(page)} isEditing={true} />;
  }

  if (parsed.type === 'category') {
    const tagSegments = parsed.tagPath.split('/');
    const tag = findTagByPath(tagSegments);
    const categoryName = tagLabel(tagSegments);
    const categoryUrl = `${SITE_URL}/${parsed.tagPath}`;

    // `/<category>/edit` edits the hub article where one exists; categories
    // without a hub keep falling through to the listing.
    if (parsed.suffix === 'edit') {
      const hub = await getCategoryHub(parsed.tagPath);
      if (hub) return <PageView page={sanitizePage(hub)} tagPath={parsed.tagPath} slug="" isEditMode nowMs={nowMs} />;
    }

    // The facet bar, the sort control and the A-Z index all live on this
    // branch, so this is where the query string is read. See the note at the
    // top of the render.
    const query = await searchParams;
    const sortParam = str(query.sort);

    // `?new` is New Page: the editor for a page in this category, slug from its title.
    if (query.new !== undefined && await getSession()) {
      return <PageView page={null} tagPath={parsed.tagPath} slug="" isEditMode={false} nowMs={nowMs} />;
    }

    if (isIdeasPath(parsed.tagPath)) {
      const defaultSort = getSortOrder(tagSegments);
      const ideasSort = (sortParam && VALID_SORTS.has(sortParam) ? sortParam : defaultSort) as SortOrder;
      const pages = await getIdeasPages(parsed.tagPath);
      return (
        <>
          <JsonLd data={categoryLd(categoryName, categoryUrl, pages, tag?.description)} />
          <Suspense fallback={<PageSkeleton />}><IdeasView tagPath={tagSegments} pages={pages} sort={ideasSort} /></Suspense>
        </>
      );
    }
    // Pages filed directly here, and only those: the section cards list what
    // each subcategory holds, so a container no longer flattens its subtree into
    // a second grid beneath them. Count, sort, facets, letter and cards are
    // `wiki-formant/category`, the view miow's wikis draw too.
    const { sort, total, pages, filters, letter, facets, letters, clearHref, sections: allSubcategories } = await categoryView(
      { tree: TAG_TREE, taxonomy, pages: { list: (t, { sort, limit }) => getCategoryPages(t, sort, limit), subtree: getSubtreeRefs } },
      parsed.tagPath, query,
    );
    const visibleChildren = (tag?.children ?? []).filter(c => !c.hidden);
    // A hub article heads its own category, so the pointer to a main article
    // elsewhere is only for the categories that don't have one.
    const hub = await withProcessedContent(await getCategoryHub(parsed.tagPath));
    const mainArticle = !hub && tag?.mainArticle ? await getPageRef(tag.mainArticle) : null;

    // An article that links every one of its own subsections is already the
    // index, and the card grid under it is the same navigation twice — which is
    // what /developers looked like once its lead grew a stepper. The rail
    // carries the tree either way. A hub that routes to only some of its
    // sections keeps the grid, so navigation is never silently lost.
    const routedByHub = !!hub && visibleChildren.length > 0
      && visibleChildren.every(c => linksTo(hub.content, `/${parsed.tagPath}/${c.slug}`));
    const subcategories = routedByHub ? [] : allSubcategories;

    return (
      <>
        {hub && <JsonLd data={pageLd(hub, categoryUrl)} />}
        <JsonLd data={categoryLd(categoryName, categoryUrl, pages.length ? pages : allSubcategories, tag?.description)} />
        <CategoryView
          tagPath={tagSegments} pages={pages} sort={sort} total={total}
          facetGroups={facets} filters={filters}
          letters={letters} letter={letter} clearHref={clearHref} subcategories={subcategories} mainArticle={mainArticle}
          hub={hub} nowMs={nowMs}
        />
      </>
    );
  }

  if (parsed.type === 'history') {
    const data = await getPageHistory(parsed.tagPath, parsed.slug);
    // No page, no history. The empty view answered 200 for any slug at all, and
    // Search Console filed the revision views of deleted pages as soft 404s.
    if (!data) notFound();
    // The homepage's own history is `''`/`''` — the same call, told to head itself
    // "Homepage History" and to reach the root API route.
    return <Suspense fallback={<PageSkeleton />}><HistoryView data={data} tagPath={parsed.tagPath} slug={parsed.slug} isHomepage={!parsed.tagPath && !parsed.slug} /></Suspense>;
  }

  const rawPage = await getPage(parsed.tagPath, parsed.slug);
  if (!rawPage) {
    const session = await getSession();
    if (!session) notFound();
    // Authenticated visitors fall through to PageView, which renders the create-page editor.
  }
  // The editor gets the stored HTML cleaned but undecorated: its iframe node
  // mounts a stored `src` as-is, and metadata fields are set via innerHTML.
  const page = parsed.suffix === 'edit' ? rawPage && sanitizePage(rawPage) : await withProcessedContent(rawPage);
  let related: RelatedPages = { pages: [], sharedFacet: null };
  if (page && parsed.suffix !== 'edit') {
    // No prev/next beside it: no section stores an order, so "next" was the next
    // title or date in a set, and See also already walks that set by relevance
    // (STRUCTURE.md S12, one home per lateral move).
    const siblings = (await getCategoryPages(parsed.tagPath)).filter(p => p.slug !== parsed.slug);
    const ranked = rankRelated(page, siblings, parsed.tagPath);
    related = {
      pages: ranked.pages.map(p => ({ id: p.id, title: p.title, slug: p.slug, tagPath: p.tagPath, snippet: describe(p.snippet, 100) })),
      sharedFacet: ranked.sharedFacet,
    };
  }
  // The topic this page is part of, unless this page *is* it.
  const mainArticle = getMainArticle(parsed.tagPath);
  const series = mainArticle && mainArticle !== `${parsed.tagPath}/${parsed.slug}` ? await getPageRef(mainArticle) : null;
  const pathSegments = [...parsed.tagPath.split('/'), parsed.slug];
  const pageUrl = `${SITE_URL}/${pathSegments.join('/')}`;
  const faq = page && pageFaqLd(page, pageUrl);
  return (
    <>
      {page && <JsonLd data={pageLd(page, pageUrl)} />}
      {faq && <JsonLd data={faq} />}
      <PageView page={page} tagPath={parsed.tagPath} slug={parsed.slug} isEditMode={parsed.suffix === 'edit'} related={related} series={series} nowMs={nowMs} />
    </>
  );
}