// src/app/[[...path]]/page.tsx

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { parsePath, getHomepage, getPage, getCategoryPages, isIdeasPath, getIdeasPages, getPageHistory, getAdjacentPages, resolveBlockData } from '@/lib/wiki';
import { findTagByPath, getSortOrder, TAG_HIERARCHY, type TagNode, type SortOrder } from '@/lib/tags';
import { highlightBlocks } from '@/lib/highlight';
import { hasCodeBlocksInContent } from '@/lib/block-utils';
import { prisma } from '@/lib/prisma/client';
import { PageView, HomepageView, CategoryView, PageSkeleton, StatusCard, HistoryView, type HistoryData } from './PageContent';
import dynamic from 'next/dynamic';

const IdeasView = dynamic(() => import('./IdeasView'), { loading: () => <PageSkeleton /> });
const LeaderboardView = dynamic(() => import('@/components/LeaderboardView'), { loading: () => <PageSkeleton /> });
const WelcomeView = dynamic(() => import('@/components/WelcomeView'), { loading: () => <PageSkeleton /> });
import type { Block } from '@/types/blocks';
import type { WikiPage } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';

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

type Props = { params: Promise<{ path?: string[] }>; searchParams: Promise<{ sort?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  const parsed = parsePath(path);

  if (parsed.type === 'leaderboard') {
    const ogUrl = `${BASE_URL}/og?title=${encodeURIComponent('Leaderboard')}&excerpt=${encodeURIComponent('Top RADIX.wiki contributors ranked by contribution points.')}`;
    return {
      title: 'Leaderboard', description: 'Top RADIX.wiki contributors ranked by contribution points.',
      openGraph: { title: 'Leaderboard', description: 'Top RADIX.wiki contributors ranked by contribution points.', type: 'article', images: [{ url: ogUrl, width: 1200, height: 630 }] },
      twitter: { card: 'summary_large_image', title: 'Leaderboard', images: [ogUrl] },
    };
  }

  let page = null;
  if (parsed.type === 'homepage') page = await getHomepage();
  else if (parsed.type === 'page' || parsed.type === 'edit') page = await getPage(parsed.tagPath, parsed.slug);

  const title = page?.title || 'RADIX Wiki';
  const description = page?.excerpt || 'A decentralized wiki powered by Radix DLT';
  const segments = path?.length ? path.join('/') : '';
  const canonical = segments ? `${BASE_URL}/${segments}` : BASE_URL;
  const ogParams = new URLSearchParams({ title, excerpt: description, tagPath: page?.tagPath || '' });
  if (page?.bannerImage) ogParams.set('banner', page.bannerImage);
  const ogUrl = `${BASE_URL}/og?${ogParams}`;

  const tagSegments = page?.tagPath?.split('/').filter(Boolean) || [];
  const section = tagSegments.length ? findTagByPath(tagSegments.slice(0, 1))?.name?.replace(/^\p{Emoji_Presentation}\s*/u, '') : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title, description, type: 'article',
      images: [{ url: ogUrl, width: 1200, height: 630 }],
      ...(page?.createdAt && { publishedTime: new Date(page.createdAt).toISOString() }),
      ...(page?.updatedAt && { modifiedTime: new Date(page.updatedAt).toISOString() }),
      ...(section && { section }),
      ...(page?.tagPath && { tags: page.tagPath.split('/') }),
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogUrl] },
  };
}

async function withProcessedContent<T extends { content: unknown }>(page: T | null): Promise<T | null> {
  if (!page || !Array.isArray(page.content)) return page;
  let content = page.content as Block[];
  content = await resolveBlockData(content);
  if (hasCodeBlocksInContent(content)) content = await highlightBlocks(content);
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

function ArticleJsonLd({ page, url }: { page: WikiPage; url: string }) {
  const tagSegments = page.tagPath?.split('/').filter(Boolean) || [];
  const section = tagSegments.length ? (findTagByPath(tagSegments.slice(0, 1))?.name || tagSegments[0]).replace(/^\p{Emoji_Presentation}\s*/u, '') : undefined;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: page.title,
    description: page.excerpt || '',
    url,
    datePublished: page.createdAt,
    dateModified: page.updatedAt,
    wordCount: countWords(page.content),
    ...(section && { articleSection: section }),
    author: { '@type': 'Person', name: page.author?.displayName || 'Anonymous', identifier: page.author?.radixAddress },
    publisher: { '@type': 'Organization', name: 'RADIX Wiki', url: BASE_URL, logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` } },
    ...(page.bannerImage && { image: page.bannerImage }),
    isPartOf: { '@type': 'WebSite', name: 'RADIX Wiki', url: BASE_URL },
    inLanguage: 'en',
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />;
}

function CollectionJsonLd({ name, description, url, pages }: { name: string; description?: string; url: string; pages: { title: string; tagPath: string; slug: string }[] }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url,
    ...(description && { description }),
    isPartOf: { '@type': 'WebSite', name: 'RADIX Wiki', url: BASE_URL },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: pages.length,
      itemListElement: pages.slice(0, 50).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${BASE_URL}/${p.tagPath}/${p.slug}`,
        name: p.title,
      })),
    },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />;
}

function BreadcrumbJsonLd({ path }: { path: string[] }) {
  const items = [{ '@type': 'ListItem' as const, position: 1, name: 'Home', item: BASE_URL }];
  for (let i = 0; i < path.length; i++) {
    const segments = path.slice(0, i + 1);
    const tag = findTagByPath(segments);
    items.push({
      '@type': 'ListItem',
      position: i + 2,
      name: tag?.name || segments[i].replace(/-/g, ' '),
      item: `${BASE_URL}/${segments.join('/')}`,
    });
  }
  const ld = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />;
}

const FAQ_SKIP = new Set(['external links', 'references', 'see also', 'further reading']);

function extractFaqPairs(blocks: unknown) {
  if (!Array.isArray(blocks)) return [];
  const pairs: { question: string; answer: string }[] = [];
  for (const block of blocks) {
    if (block?.type !== 'content' || typeof block.text !== 'string') continue;
    const sections = block.text.split(/<h2[^>]*>/i);
    for (let i = 1; i < sections.length; i++) {
      const [rawHeading, ...rest] = sections[i].split(/<\/h2>/i);
      const heading = rawHeading.replace(/<[^>]+>/g, '').trim();
      if (!heading || FAQ_SKIP.has(heading.toLowerCase())) continue;
      const answer = rest.join('').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
      if (answer.length < 50) continue;
      pairs.push({ question: heading.endsWith('?') ? heading : `What is ${heading}?`, answer });
    }
  }
  return pairs.slice(0, 10);
}

function FAQPageJsonLd({ pairs }: { pairs: { question: string; answer: string }[] }) {
  if (pairs.length < 2) return null;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map(p => ({
      '@type': 'Question',
      name: p.question,
      acceptedAnswer: { '@type': 'Answer', text: p.answer },
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />;
}

const VALID_SORTS = new Set<string>(['title', 'newest', 'oldest', 'recent']);

export default async function DynamicPage({ params, searchParams }: Props) {
  const { path } = await params;
  const { sort: sortParam } = await searchParams;
  const parsed = parsePath(path);

  if (parsed.type === 'invalid') return <StatusCard status="invalidPath" backHref="/" />;

  if (parsed.type === 'leaderboard') return <LeaderboardView />;
  if (parsed.type === 'welcome') return <WelcomeView />;

  if (parsed.type === 'homepage') {
    const page = await withProcessedContent(await getHomepage());
    return <Suspense fallback={<PageSkeleton />}><HomepageView page={page} isEditing={false} /></Suspense>;
  }

  if (parsed.type === 'edit' && !parsed.tagPath && !parsed.slug) {
    const page = await withProcessedContent(await getHomepage());
    return <Suspense fallback={<PageSkeleton />}><HomepageView page={page} isEditing={true} /></Suspense>;
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

    if (isIdeasPath(parsed.tagPath)) {
      const defaultSort = getSortOrder(tagSegments);
      const ideasSort = (sortParam && VALID_SORTS.has(sortParam) ? sortParam : defaultSort) as SortOrder;
      const pages = await getIdeasPages(parsed.tagPath);
      return (
        <>
          <CollectionJsonLd name={categoryName} description={tag?.description} url={categoryUrl} pages={pages} />
          <BreadcrumbJsonLd path={tagSegments} />
          <Suspense fallback={<PageSkeleton />}><IdeasView tagPath={tagSegments} pages={pages} sort={ideasSort} /></Suspense>
        </>
      );
    }
    const defaultSort = getSortOrder(tagSegments);
    const sort = (sortParam && VALID_SORTS.has(sortParam) ? sortParam : defaultSort) as SortOrder;
    const pages = await getCategoryPages(parsed.tagPath, sort);
    return (
      <>
        <CollectionJsonLd name={categoryName} description={tag?.description} url={categoryUrl} pages={pages} />
        <BreadcrumbJsonLd path={tagSegments} />
        <Suspense fallback={<PageSkeleton />}><CategoryView tagPath={tagSegments} pages={pages} sort={sort} /></Suspense>
      </>
    );
  }

  if (parsed.type === 'history') {
    const data = await getPageHistory(parsed.tagPath, parsed.slug) as HistoryData;
    return <Suspense fallback={<PageSkeleton />}><HistoryView data={data} tagPath={parsed.tagPath} slug={parsed.slug} /></Suspense>;
  }

  const rawPage = await getPage(parsed.tagPath, parsed.slug);
  const faqPairs = rawPage ? extractFaqPairs(rawPage.content) : [];
  const page = parsed.suffix === 'edit' ? rawPage : await withProcessedContent(rawPage);
  const adjacent = page ? await getAdjacentPages(parsed.tagPath, page.title, new Date(page.createdAt).toISOString(), new Date(page.updatedAt).toISOString()) : { prev: null, next: null };
  const pathSegments = [...parsed.tagPath.split('/'), parsed.slug];
  const pageUrl = `${BASE_URL}/${pathSegments.join('/')}`;
  return (
    <>
      {page && <ArticleJsonLd page={page} url={pageUrl} />}
      <FAQPageJsonLd pairs={faqPairs} />
      <BreadcrumbJsonLd path={pathSegments} />
      <Suspense fallback={<PageSkeleton />}><PageView page={page} tagPath={parsed.tagPath} slug={parsed.slug} isEditMode={parsed.suffix === 'edit'} adjacent={adjacent} /></Suspense>
    </>
  );
}