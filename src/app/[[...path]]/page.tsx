// src/app/[[...path]]/page.tsx

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { parsePath, getHomepage, getPage, getCategoryPages, isIdeasPath, getIdeasPages, getPageHistory, getAdjacentPages, resolveBlockData } from '@/lib/wiki';
import { findTagByPath, getSortOrder, TAG_HIERARCHY, type TagNode, type SortOrder } from '@/lib/tags';
import { highlightBlocks } from '@/lib/highlight';
import { hasCodeBlocksInContent } from '@/lib/block-utils';
import { prisma } from '@/lib/prisma/client';
import { PageView, HomepageView, CategoryView, IdeasView, PageSkeleton, StatusCard, HistoryView, type HistoryData } from './PageContent';
import { LeaderboardView } from '@/components/LeaderboardView';
import type { Block } from '@/types/blocks';
import type { WikiPage } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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
    return { title: 'Leaderboard', description: 'Top RADIX.wiki contributors ranked by contribution points.' };
  }

  let page = null;
  if (parsed.type === 'homepage') page = await getHomepage();
  else if (parsed.type === 'page' || parsed.type === 'edit') page = await getPage(parsed.tagPath, parsed.slug);

  const title = page?.title || 'RADIX Wiki';
  const description = page?.excerpt || 'A decentralized wiki powered by Radix DLT';
  const segments = path?.length ? path.join('/') : '';
  const canonical = segments ? `${BASE_URL}/${segments}` : BASE_URL;
  const ogImage = page?.bannerImage;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title, description, type: 'article',
      ...(ogImage && { images: [{ url: ogImage, width: 1200, height: 630 }] }),
    },
    twitter: {
      card: 'summary_large_image', title, description,
      ...(ogImage && { images: [ogImage] }),
    },
  };
}

async function withProcessedContent<T extends { content: unknown }>(page: T | null): Promise<T | null> {
  if (!page || !Array.isArray(page.content)) return page;
  let content = page.content as Block[];
  content = await resolveBlockData(content);
  if (hasCodeBlocksInContent(content)) content = await highlightBlocks(content);
  return { ...page, content };
}

function ArticleJsonLd({ page, url }: { page: WikiPage; url: string }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.title,
    description: page.excerpt || '',
    url,
    datePublished: page.createdAt,
    dateModified: page.updatedAt,
    author: { '@type': 'Person', name: page.author?.displayName || 'Anonymous', identifier: page.author?.radixAddress },
    publisher: { '@type': 'Organization', name: 'RADIX Wiki', url: BASE_URL },
    ...(page.bannerImage && { image: page.bannerImage }),
    isPartOf: { '@type': 'WebSite', name: 'RADIX Wiki', url: BASE_URL },
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

const VALID_SORTS = new Set<string>(['title', 'newest', 'oldest', 'recent']);

export default async function DynamicPage({ params, searchParams }: Props) {
  const { path } = await params;
  const { sort: sortParam } = await searchParams;
  const parsed = parsePath(path);

  if (parsed.type === 'invalid') return <StatusCard status="invalidPath" backHref="/" />;

  if (parsed.type === 'leaderboard') return <LeaderboardView />;

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
    if (isIdeasPath(parsed.tagPath)) {
      const defaultSort = getSortOrder(parsed.tagPath.split('/'));
      const ideasSort = (sortParam && VALID_SORTS.has(sortParam) ? sortParam : defaultSort) as SortOrder;
      const pages = await getIdeasPages(parsed.tagPath);
      return <Suspense fallback={<PageSkeleton />}><IdeasView tagPath={parsed.tagPath.split('/')} pages={pages} sort={ideasSort} /></Suspense>;
    }
    const defaultSort = getSortOrder(parsed.tagPath.split('/'));
    const sort = (sortParam && VALID_SORTS.has(sortParam) ? sortParam : defaultSort) as SortOrder;
    const pages = await getCategoryPages(parsed.tagPath, sort);
    return <Suspense fallback={<PageSkeleton />}><CategoryView tagPath={parsed.tagPath.split('/')} pages={pages} sort={sort} /></Suspense>;
  }

  if (parsed.type === 'history') {
    const data = await getPageHistory(parsed.tagPath, parsed.slug) as HistoryData;
    return <Suspense fallback={<PageSkeleton />}><HistoryView data={data} tagPath={parsed.tagPath} slug={parsed.slug} /></Suspense>;
  }

  const rawPage = await getPage(parsed.tagPath, parsed.slug);
  const page = parsed.suffix === 'edit' ? rawPage : await withProcessedContent(rawPage);
  const adjacent = page ? await getAdjacentPages(parsed.tagPath, page.title, new Date(page.createdAt).toISOString(), new Date(page.updatedAt).toISOString()) : { prev: null, next: null };
  const pathSegments = [...parsed.tagPath.split('/'), parsed.slug];
  const pageUrl = `${BASE_URL}/${pathSegments.join('/')}`;
  return (
    <>
      {page && <ArticleJsonLd page={page} url={pageUrl} />}
      <BreadcrumbJsonLd path={pathSegments} />
      <Suspense fallback={<PageSkeleton />}><PageView page={page} tagPath={parsed.tagPath} slug={parsed.slug} isEditMode={parsed.suffix === 'edit'} adjacent={adjacent} /></Suspense>
    </>
  );
}