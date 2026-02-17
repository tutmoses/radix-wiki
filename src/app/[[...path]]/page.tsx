// src/app/[[...path]]/page.tsx

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { parsePath, getHomepage, getPage, getCategoryPages, getForumThreads, isForumPath, getPageHistory, getAdjacentPages } from '@/lib/wiki';
import { getSortOrder, type SortOrder } from '@/lib/tags';
import { PageView, HomepageView, CategoryView, ForumView, PageSkeleton, StatusCard, HistoryView, type HistoryData } from './PageContent';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

type Props = { params: Promise<{ path?: string[] }>; searchParams: Promise<{ sort?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  const parsed = parsePath(path);

  let page = null;
  if (parsed.type === 'homepage') page = await getHomepage();
  else if (parsed.type === 'page' || parsed.type === 'edit') page = await getPage(parsed.tagPath, parsed.slug);

  const title = page?.title || 'RADIX Wiki';
  const description = page?.excerpt || 'A decentralized wiki powered by Radix DLT';
  const ogImage = page?.bannerImage || `${BASE_URL}/og-default.png`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  };
}

const VALID_SORTS = new Set<string>(['title', 'newest', 'oldest', 'recent']);

export default async function DynamicPage({ params, searchParams }: Props) {
  const { path } = await params;
  const { sort: sortParam } = await searchParams;
  const parsed = parsePath(path);

  if (parsed.type === 'invalid') return <StatusCard status="invalidPath" backHref="/" />;

  if (parsed.type === 'homepage') {
    const page = await getHomepage();
    return <Suspense fallback={<PageSkeleton />}><HomepageView page={page} isEditing={false} /></Suspense>;
  }

  if (parsed.type === 'edit' && !parsed.tagPath && !parsed.slug) {
    const page = await getHomepage();
    return <Suspense fallback={<PageSkeleton />}><HomepageView page={page} isEditing={true} /></Suspense>;
  }

  if (parsed.type === 'history' && !parsed.tagPath && !parsed.slug) {
    const data = await getPageHistory('', '') as HistoryData;
    return <Suspense fallback={<PageSkeleton />}><HistoryView data={data} tagPath="" slug="" isHomepage /></Suspense>;
  }

  if (parsed.type === 'category') {
    const defaultSort = getSortOrder(parsed.tagPath.split('/'));
    const sort = (sortParam && VALID_SORTS.has(sortParam) ? sortParam : defaultSort) as SortOrder;
    if (isForumPath(parsed.tagPath)) {
      const threads = await getForumThreads(parsed.tagPath, sort);
      return <Suspense fallback={<PageSkeleton />}><ForumView tagPath={parsed.tagPath.split('/')} threads={threads} sort={sort} /></Suspense>;
    }
    const pages = await getCategoryPages(parsed.tagPath, sort);
    return <Suspense fallback={<PageSkeleton />}><CategoryView tagPath={parsed.tagPath.split('/')} pages={pages} sort={sort} /></Suspense>;
  }

  if (parsed.type === 'history') {
    const data = await getPageHistory(parsed.tagPath, parsed.slug) as HistoryData;
    return <Suspense fallback={<PageSkeleton />}><HistoryView data={data} tagPath={parsed.tagPath} slug={parsed.slug} /></Suspense>;
  }

  const page = await getPage(parsed.tagPath, parsed.slug);
  const adjacent = page ? await getAdjacentPages(parsed.tagPath, page.title, page.createdAt, page.updatedAt) : { prev: null, next: null };
  return <Suspense fallback={<PageSkeleton />}><PageView page={page} tagPath={parsed.tagPath} slug={parsed.slug} isEditMode={parsed.suffix === 'edit'} adjacent={adjacent} /></Suspense>;
}