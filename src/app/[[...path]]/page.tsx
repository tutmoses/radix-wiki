// src/app/[[...path]]/page.tsx

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { parsePath, getHomepage, getPage, getCategoryPages, getPageHistory, getAdjacentPages } from '@/lib/wiki';
import { PageView, HomepageView, CategoryView, PageSkeleton, StatusCard, HistoryView, type HistoryData } from './PageContent';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

type Props = { params: Promise<{ path?: string[] }> };

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

export default async function DynamicPage({ params }: Props) {
  const { path } = await params;
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
    const pages = await getCategoryPages(parsed.tagPath);
    return <Suspense fallback={<PageSkeleton />}><CategoryView tagPath={parsed.tagPath.split('/')} pages={pages} /></Suspense>;
  }

  if (parsed.type === 'history') {
    const data = await getPageHistory(parsed.tagPath, parsed.slug) as HistoryData;
    return <Suspense fallback={<PageSkeleton />}><HistoryView data={data} tagPath={parsed.tagPath} slug={parsed.slug} /></Suspense>;
  }

  const page = await getPage(parsed.tagPath, parsed.slug);
  const adjacent = page ? await getAdjacentPages(parsed.tagPath, page.title) : { prev: null, next: null };
  return <Suspense fallback={<PageSkeleton />}><PageView page={page} tagPath={parsed.tagPath} slug={parsed.slug} isEditMode={parsed.isEditMode} adjacent={adjacent} /></Suspense>;
}