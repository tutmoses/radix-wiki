// src/app/[[...path]]/page.tsx

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { parsePath, getHomepage, getPage, getCategoryHub, getCategoryPages, getDescendantPages, getTagCounts, getPageRef, isIdeasPath, getIdeasPages, getPageHistory, resolveBlockData, getEcosystemPageByAsset } from '@/lib/wiki';
import { getMaintenanceQueues } from '@/lib/maintenance';
import { getSession } from '@/lib/auth';
import type { RelatedPages, SubcategorySummary } from './PageContent';
import { alphaIndex, buildFacets, facetFilters, filterPages, rankRelated, ALPHA_INDEX_MIN_PAGES } from '@/lib/taxonomy';
import { findTagByPath, getMainArticle, getSortOrder, TAG_HIERARCHY, type TagNode, type SortOrder } from '@/lib/tags';
import { highlightBlocks } from '@/lib/highlight';
import { processBlocks } from '@/lib/html';
import { hasCodeBlocksInContent } from '@/lib/block-utils';
import { prisma } from '@/lib/prisma/client';
import { PageView, HomepageView, CategoryView, PageSkeleton, HistoryView, type HistoryData } from './PageContent';
import dynamic from 'next/dynamic';

const IdeasView = dynamic(() => import('./IdeasView'), { loading: () => <PageSkeleton /> });
const LeaderboardView = dynamic(() => import('@/components/LeaderboardView'), { loading: () => <PageSkeleton /> });
const WelcomeView = dynamic(() => import('@/components/WelcomeView'), { loading: () => <PageSkeleton /> });
const RewardsView = dynamic(() => import('@/components/RewardsView'), { loading: () => <PageSkeleton /> });
const SearchView = dynamic(() => import('@/components/SearchView'), { loading: () => <PageSkeleton /> });
const MaintenanceView = dynamic(() => import('@/components/MaintenanceView'), { loading: () => <PageSkeleton /> });
import ChartsOverview from '@/components/charts/ChartsOverview';
import ValidatorsView from '@/components/charts/ValidatorsView';
import TokensView from '@/components/charts/TokensView';
import TokenDetailView from '@/components/charts/TokenDetailView';
import { BASE_URL, getContentSnippet } from '@/lib/utils';
import { ogMetadata, ogImageUrl } from '@/lib/og';
import { articleType, aboutEntity, articleLearningProps } from '@/lib/entity-ld';
import { getTokenDetail } from '@/lib/radix/tokens';
import type { Block } from '@/types/blocks';
import type { WikiPage } from '@/types';

function collectTagPaths(nodes: TagNode[], parent = ''): string[] {
  return nodes.flatMap(n => {
    const p = parent ? `${parent}/${n.slug}` : n.slug;
    return [p, ...(n.children ? collectTagPaths(n.children, p) : [])];
  });
}

export async function generateStaticParams() {
  const pages = await prisma.page.findMany({ select: { tagPath: true, slug: true } });
  const categories = collectTagPaths(TAG_HIERARCHY).filter(Boolean);

  return [
    { path: [] },
    ...categories.map(p => ({ path: p.split('/') })),
    ...pages.filter(p => p.tagPath && p.slug).map(p => ({ path: [...p.tagPath.split('/'), p.slug] })),
  ];
}

export const dynamicParams = true;
export const revalidate = 60;

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
    const canonical = `${BASE_URL}/charts/tokens/${parsed.tokenAddress}`;
    const label = token.symbol || token.name || 'Token';
    const fullName = token.name && token.symbol && token.name !== token.symbol ? `${token.name} (${token.symbol})` : (token.name || token.symbol || 'Token');
    const title = `${label} — Token on Radix`;
    const baseDesc = `${fullName}. Live price, supply, holders, and trading volume on the Radix network.`;
    const extraDesc = token.description ? ` ${token.description.replace(/\s+/g, ' ').trim()}` : '';
    const description = (baseDesc + extraDesc).slice(0, 160);
    return { title, description, ...ogMetadata({ title, description, url: canonical, type: 'article' }) };
  }

  // Search results — noindex (thin, query-dependent)
  if (parsed.type === 'search') {
    return {
      title: 'Search — RADIX Wiki',
      description: 'Search the community-maintained RADIX Wiki.',
      robots: NOINDEX_ROBOTS,
      alternates: { canonical: `${BASE_URL}/search` },
    };
  }

  // Work queues — noindex, the same way Wikipedia hides maintenance categories from readers
  if (parsed.type === 'maintenance') {
    return {
      title: 'Maintenance — RADIX Wiki',
      description: 'Pages flagged as outdated, orphaned, unsourced, or missing required metadata.',
      robots: NOINDEX_ROBOTS,
      alternates: { canonical: `${BASE_URL}/maintenance` },
    };
  }

  // Static pages with fixed metadata. `path` is the URL where the parsed type
  // doesn't spell it (charts-validators lives at /charts/validators).
  const STATIC_META: Record<string, { title: string; description: string; path?: string }> = {
    leaderboard: { title: 'Leaderboard', description: 'Top RADIX.wiki contributors ranked by contribution points.' },
    welcome: { title: 'Welcome', description: 'Get started with RADIX Wiki — connect your Radix wallet and begin contributing to the decentralized knowledge base.' },
    rewards: { title: 'Rewards', description: 'Track contributor rewards and XRD airdrop eligibility on RADIX Wiki.' },
    charts: { title: 'Charts', description: 'Live Radix network statistics, validator directory, and ecosystem token analytics — successor to RadixCharts.' },
    'charts-validators': { title: 'Validators', description: 'Sortable directory of all Radix validators with stake, fee, and ownership data.', path: 'charts/validators' },
    'charts-tokens': { title: 'Tokens', description: 'Top tokens on Radix ranked by total value locked, with price, volume, and 24h change.', path: 'charts/tokens' },
  };

  const staticMeta = STATIC_META[parsed.type];
  if (staticMeta) {
    const { path: staticPath, ...meta } = staticMeta;
    return { ...meta, ...ogMetadata({ ...meta, url: `${BASE_URL}/${staticPath ?? parsed.type}` }) };
  }

  // Category pages — unique title + description from the hub article if there is
  // one, else from the tag hierarchy.
  if (parsed.type === 'category') {
    const tagSegments = parsed.tagPath.split('/');
    const tag = findTagByPath(tagSegments);
    const hub = await getCategoryHub(parsed.tagPath);
    const categoryName = tag?.name?.replace(/^\p{Emoji_Presentation}\s*/u, '') || tagSegments.at(-1)?.replace(/-/g, ' ') || 'Category';
    const parentPath = tagSegments.slice(0, -1).join(' › ');
    const hubExcerpt = (hub?.metadata as Record<string, string> | null)?.excerpt;
    const title = hub?.title || categoryName;
    const description = hubExcerpt || tag?.description
      || `${categoryName} on RADIX Wiki${parentPath ? ` (${parentPath})` : ''} — browse community-maintained pages covering ${categoryName.toLowerCase()} in the Radix DLT ecosystem.`;
    return {
      title, description,
      ...ogMetadata({
        title, description,
        url: `${BASE_URL}/${parsed.tagPath}`, tagPath: parsed.tagPath,
        banner: hub?.bannerImage,
      }),
    };
  }

  // Edit, history, and mdx variants shouldn't be indexed (they produce near-duplicate content)
  if (parsed.type === 'edit' || parsed.type === 'history' || parsed.type === 'mdx') {
    const label = parsed.type === 'edit' ? 'Edit' : parsed.type === 'history' ? 'Revision history' : 'MDX export';
    return {
      title: `${label} — RADIX Wiki`,
      description: `${label} view on RADIX Wiki.`,
      robots: NOINDEX_ROBOTS,
      alternates: { canonical: `${BASE_URL}/${parsed.tagPath}/${parsed.slug}`.replace(/\/+$/, '') || BASE_URL },
    };
  }

  // Homepage — hand-tuned, keyword-rich metadata (title.absolute bypasses the "%s | RADIX Wiki" template)
  if (parsed.type === 'homepage') {
    const title = 'Radix Wiki: XRD, Scrypto & the Radix DLT Crypto Ecosystem';
    const description = 'The community-maintained wiki for Radix DLT – XRD, the Radix Engine, Scrypto smart contracts, Cerberus consensus, validators, staking, and the DeFi ecosystem.';
    return {
      title: { absolute: title },
      description,
      // The card headline stays the brand, not the keyword-length document title.
      ...ogMetadata({ title, description, url: BASE_URL, imageTitle: 'RADIX Wiki' }),
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
      title: 'New page — RADIX Wiki',
      description: 'Create a new page on RADIX Wiki.',
      robots: NOINDEX_ROBOTS,
      alternates: { canonical: `${BASE_URL}/${parsed.tagPath}/${parsed.slug}` },
    };
  }

  const title = page?.title || 'RADIX Wiki';
  const snippet = getContentSnippet(page?.content);
  const tagSegments = page?.tagPath?.split('/').filter(Boolean) || [];
  const sectionName = tagSegments.length
    ? findTagByPath(tagSegments.slice(0, 1))?.name?.replace(/^\p{Emoji_Presentation}\s*/u, '')
    : undefined;
  // Description derived directly from content so it never goes stale
  const description = snippet
    || (page
      ? `${title}${sectionName ? ` — a ${sectionName} article` : ''} on RADIX Wiki, the community-maintained knowledge base for the Radix DLT ecosystem.`
      : 'RADIX Wiki — community-maintained knowledge base for Radix DLT, the layer-1 blockchain with linear scalability and asset-oriented smart contracts.');
  const segments = path?.length ? path.join('/') : '';
  const canonical = segments ? `${BASE_URL}/${segments}` : BASE_URL;

  return {
    title,
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
    }),
    // Wiki pages advertise their markdown twin so agents landing on the HTML
    // find the clean-text variant without having read llms.txt first.
    ...(page && { alternates: { canonical, types: { 'text/markdown': `${canonical}.md` } } }),
  };
}

async function withProcessedContent<T extends { content: unknown }>(page: T | null): Promise<T | null> {
  if (!page || !Array.isArray(page.content)) return page;
  let content = page.content as Block[];
  content = await resolveBlockData(content);
  if (hasCodeBlocksInContent(content)) content = await highlightBlocks(content);
  // Normalise HTML server-side so SSR output has demoted h1s, alt attrs, and correct link attributes
  content = processBlocks(content);
  return { ...page, content };
}

function countWords(blocks: unknown): number {
  if (!Array.isArray(blocks)) return 0;
  let text = '';
  for (const b of blocks) {
    if (b?.type === 'content' && typeof b.text === 'string') text += ' ' + b.text.replace(/<[^>]+>/g, '');
    if (b?.type === 'infobox' && Array.isArray(b.blocks)) text += ' ' + b.blocks.filter((c: any) => c?.type === 'content').map((c: any) => (c.text || '').replace(/<[^>]+>/g, '')).join(' ');
    if (b?.type === 'columns' && Array.isArray(b.columns)) for (const col of b.columns) if (Array.isArray(col?.blocks)) text += ' ' + col.blocks.filter((c: any) => c?.type === 'content').map((c: any) => (c.text || '').replace(/<[^>]+>/g, '')).join(' ');
  }
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', ...data }) }} />;
}

/**
 * Sources from the page's own `references` blocks, as Article.citation. The
 * block type already stores {id, text, url} per entry, so the citation list is
 * read straight off the content rather than re-parsed out of rendered HTML.
 */
function citationsFrom(content: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];

  // References blocks are usually top-level, but infobox/columns can nest them,
  // so walk containers the same way processBlocks does.
  const walk = (blocks: unknown) => {
    if (!Array.isArray(blocks)) return;
    for (const block of blocks) {
      if (block?.type === 'infobox') { walk(block.blocks); continue; }
      if (block?.type === 'columns') { (block.columns ?? []).forEach((c: { blocks?: unknown }) => walk(c?.blocks)); continue; }
      if (block?.type !== 'references' || !Array.isArray(block.items)) continue;
      for (const ref of block.items) {
        const text = typeof ref?.text === 'string' ? ref.text.replace(/<[^>]+>/g, '').trim() : '';
        if (!text) continue;
        out.push({
          '@type': 'CreativeWork',
          name: text.slice(0, 250),
          ...(typeof ref.url === 'string' && ref.url && { url: ref.url }),
        });
      }
    }
  };

  walk(content);
  return out.slice(0, 50);
}

function articleLd(page: WikiPage, url: string) {
  const tagSegments = page.tagPath?.split('/').filter(Boolean) || [];
  const section = tagSegments.length ? (findTagByPath(tagSegments.slice(0, 1))?.name ?? tagSegments[0] ?? '').replace(/^\p{Emoji_Presentation}\s*/u, '') : undefined;
  const citations = citationsFrom(page.content);
  const about = aboutEntity(page.tagPath, page.title, page.metadata);
  // Google recommends an image on every article; pages without a banner get the
  // same generated card the OG tags already use, rather than no image at all.
  const image = page.bannerImage || ogImageUrl({ title: page.title, tagPath: page.tagPath });
  return {
    '@type': articleType(page.tagPath),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: page.title,
    description: getContentSnippet(page.content) || '',
    url,
    datePublished: page.createdAt,
    dateModified: page.updatedAt,
    wordCount: countWords(page.content),
    ...(section && { articleSection: section }),
    // Name only — the wiki doesn't publish the displayName↔wallet mapping, so no
    // address identifier or explorer URL in structured data.
    author: {
      '@type': 'Person',
      name: page.author?.displayName || 'Anonymous',
    },
    publisher: { '@type': 'Organization', name: 'RADIX Wiki', url: BASE_URL, logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` } },
    image,
    isPartOf: { '@type': 'WebSite', name: 'RADIX Wiki', url: BASE_URL },
    inLanguage: 'en',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    ...(page.version && { version: page.version }),
    ...(citations.length && { citation: citations }),
    ...(about && { about }),
    ...articleLearningProps(page.tagPath, page.metadata),
  };
}

function collectionLd(name: string, url: string, pages: { title: string; tagPath: string; slug: string }[], description?: string) {
  return {
    '@type': 'CollectionPage',
    name, url,
    ...(description && { description }),
    isPartOf: { '@type': 'WebSite', name: 'RADIX Wiki', url: BASE_URL },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: pages.length,
      itemListElement: pages.slice(0, 50).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE_URL}/${p.tagPath}/${p.slug}`, name: p.title })),
    },
  };
}

/**
 * `leafTitle` names the final crumb. findTagByPath resolves category segments
 * but returns null for a page slug, which left the last crumb showing a
 * de-hyphenated slug ("cerberus consensus") instead of the page title.
 */
function breadcrumbLd(path: string[], leafTitle?: string) {
  const items = [{ '@type': 'ListItem' as const, position: 1, name: 'Home', item: BASE_URL }];
  for (let i = 0; i < path.length; i++) {
    const segments = path.slice(0, i + 1);
    const isLeaf = i === path.length - 1;
    const tag = findTagByPath(segments);
    const name = tag?.name || (isLeaf && leafTitle) || segments[i]!.replace(/-/g, ' ');
    items.push({ '@type': 'ListItem', position: i + 2, name, item: `${BASE_URL}/${segments.join('/')}` });
  }
  return { '@type': 'BreadcrumbList', itemListElement: items };
}

const VALID_SORTS = new Set<string>(['title', 'newest', 'oldest', 'recent']);

export default async function DynamicPage({ params, searchParams }: Props) {
  const { path } = await params;
  const query = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
  const sortParam = str(query.sort);
  const q = str(query.q);
  const parsed = parsePath(path);

  if (parsed.type === 'invalid') notFound();

  // The page-level /mdx URL is an export, not a page — send it to the API route
  // instead of rendering a duplicate article at a noindex URL.
  if (parsed.type === 'mdx') redirect(parsed.slug ? `/api/wiki/${parsed.tagPath}/${parsed.slug}/mdx` : '/api/wiki/mdx');

  if (parsed.type === 'search') return <SearchView query={q ?? ''} />;
  if (parsed.type === 'maintenance') return <MaintenanceView queues={await getMaintenanceQueues()} />;
  if (parsed.type === 'leaderboard') return <LeaderboardView />;
  if (parsed.type === 'welcome') return <WelcomeView />;
  if (parsed.type === 'rewards') return <RewardsView />;
  if (parsed.type === 'charts') return <ChartsOverview />;
  if (parsed.type === 'charts-validators') return <ValidatorsView />;
  if (parsed.type === 'charts-tokens') return <TokensView />;
  if (parsed.type === 'token-detail' && parsed.tokenAddress) {
    const wikiPage = await getEcosystemPageByAsset(parsed.tokenAddress);
    return <TokenDetailView address={parsed.tokenAddress} wikiPage={wikiPage} />;
  }

  if (parsed.type === 'homepage') {
    const page = await withProcessedContent(await getHomepage());
    return <HomepageView page={page} isEditing={false} />;
  }

  if (parsed.type === 'edit' && !parsed.tagPath && !parsed.slug) {
    const page = await withProcessedContent(await getHomepage());
    return <HomepageView page={page} isEditing={true} />;
  }

  if (parsed.type === 'history' && !parsed.tagPath && !parsed.slug) {
    const data = await getPageHistory('', '') as HistoryData;
    return <Suspense fallback={<PageSkeleton />}><HistoryView data={data} tagPath="" slug="" isHomepage /></Suspense>;
  }

  if (parsed.type === 'category') {
    const tagSegments = parsed.tagPath.split('/');
    const tag = findTagByPath(tagSegments);
    const categoryName = tag?.name?.replace(/^\p{Emoji_Presentation}\s*/u, '') || tagSegments.at(-1)?.replace(/-/g, ' ') || 'Category';
    const categoryUrl = `${BASE_URL}/${parsed.tagPath}`;

    // `/<category>/edit` edits the hub article where one exists; categories
    // without a hub keep falling through to the listing.
    if (parsed.suffix === 'edit') {
      const hub = await getCategoryHub(parsed.tagPath);
      if (hub) return <PageView page={hub} tagPath={parsed.tagPath} slug="" isEditMode />;
    }

    if (isIdeasPath(parsed.tagPath)) {
      const defaultSort = getSortOrder(tagSegments);
      const ideasSort = (sortParam && VALID_SORTS.has(sortParam) ? sortParam : defaultSort) as SortOrder;
      const pages = await getIdeasPages(parsed.tagPath);
      return (
        <>
          <JsonLd data={collectionLd(categoryName, categoryUrl, pages, tag?.description)} />
          <JsonLd data={breadcrumbLd(tagSegments)} />
          <Suspense fallback={<PageSkeleton />}><IdeasView tagPath={tagSegments} pages={pages} sort={ideasSort} /></Suspense>
        </>
      );
    }
    const defaultSort = getSortOrder(tagSegments);
    const sort = (sortParam && VALID_SORTS.has(sortParam) ? sortParam : defaultSort) as SortOrder;
    let all = await getCategoryPages(parsed.tagPath, sort);
    // A container category (Contents, Tech) holds no pages of its own — list its
    // subtree beneath the subcategory cards so browsing reaches articles in one hop.
    if (!all.length && (tag?.children ?? []).some(c => !c.hidden)) {
      all = await getDescendantPages(parsed.tagPath, sort);
    }

    // The tree gives one axis; `select` metadata gives the cross-cutting one, and
    // the alphabetical index only earns its space once the grid outgrows a screen.
    const filters = facetFilters(parsed.tagPath, query);
    const letters = all.length >= ALPHA_INDEX_MIN_PAGES ? alphaIndex(all, filters) : [];
    const letter = letters.some(l => l.value === str(query.letter)) ? str(query.letter) : undefined;
    const pages = filterPages(all, filters, letter);

    const counts = await getTagCounts();
    const subcategories: SubcategorySummary[] = (tag?.children ?? []).filter(c => !c.hidden).map(child => {
      const childPath = `${parsed.tagPath}/${child.slug}`;
      const descendants = Object.entries(counts).filter(([p]) => p === childPath || p.startsWith(`${childPath}/`));
      return {
        name: child.name,
        href: `/${childPath}`,
        description: child.description,
        pages: descendants.reduce((n, [, c]) => n + c, 0),
        subs: (child.children ?? []).filter(c => !c.hidden).length,
      };
    });
    // A hub article heads its own category, so the pointer to a main article
    // elsewhere is only for the categories that don't have one.
    const hub = await withProcessedContent(await getCategoryHub(parsed.tagPath));
    const mainArticle = !hub && tag?.mainArticle ? await getPageRef(tag.mainArticle) : null;

    return (
      <>
        {hub && <JsonLd data={articleLd(hub, categoryUrl)} />}
        <JsonLd data={collectionLd(categoryName, categoryUrl, pages, tag?.description)} />
        <JsonLd data={breadcrumbLd(tagSegments)} />
        <CategoryView
          tagPath={tagSegments} pages={pages} sort={sort} total={all.length}
          facets={buildFacets(parsed.tagPath, all, filters, letter)} filters={filters}
          letters={letters} letter={letter} subcategories={subcategories} mainArticle={mainArticle}
          hub={hub}
        />
      </>
    );
  }

  if (parsed.type === 'history') {
    const data = await getPageHistory(parsed.tagPath, parsed.slug) as HistoryData;
    return <Suspense fallback={<PageSkeleton />}><HistoryView data={data} tagPath={parsed.tagPath} slug={parsed.slug} /></Suspense>;
  }

  const rawPage = await getPage(parsed.tagPath, parsed.slug);
  if (!rawPage) {
    const session = await getSession();
    if (!session) notFound();
    // Authenticated visitors fall through to PageView, which renders the create-page editor.
  }
  const page = parsed.suffix === 'edit' ? rawPage : await withProcessedContent(rawPage);
  let related: RelatedPages = { pages: [], sharedFacet: null };
  if (page && parsed.suffix !== 'edit') {
    const siblings = (await getCategoryPages(parsed.tagPath)).filter(p => p.slug !== parsed.slug);
    const ranked = rankRelated(page, siblings, parsed.tagPath);
    related = {
      pages: ranked.pages.map(p => ({ id: p.id, title: p.title, slug: p.slug, tagPath: p.tagPath, snippet: getContentSnippet(p.content, 100) })),
      sharedFacet: ranked.sharedFacet,
    };
  }
  // The topic this page is part of, unless this page *is* it.
  const mainArticle = getMainArticle(parsed.tagPath);
  const series = mainArticle && mainArticle !== `${parsed.tagPath}/${parsed.slug}` ? await getPageRef(mainArticle) : null;
  const pathSegments = [...parsed.tagPath.split('/'), parsed.slug];
  const pageUrl = `${BASE_URL}/${pathSegments.join('/')}`;
  return (
    <>
      {page && <JsonLd data={articleLd(page, pageUrl)} />}
      <JsonLd data={breadcrumbLd(pathSegments, page?.title)} />
      <PageView page={page} tagPath={parsed.tagPath} slug={parsed.slug} isEditMode={parsed.suffix === 'edit'} related={related} series={series} />
    </>
  );
}