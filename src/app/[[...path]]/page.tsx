// src/app/[[...path]]/page.tsx

import type { Metadata } from 'next';
import { PageContent } from './PageContent';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

type Props = { params: Promise<{ path?: string[] }> };

async function fetchPageData(path: string[] = []) {
  if (path.length === 0) return null;
  
  const lastSegment = path[path.length - 1];
  const isEditMode = lastSegment === 'edit';
  const isHistoryMode = lastSegment === 'history';
  const pathSegments = (isEditMode || isHistoryMode) ? path.slice(0, -1) : path;
  
  if (pathSegments.length < 2) return null;
  
  const tagPath = pathSegments.slice(0, -1).join('/');
  const slug = pathSegments[pathSegments.length - 1];
  
  try {
    const res = await fetch(`${BASE_URL}/api/wiki/${tagPath}/${slug}`, { 
      next: { revalidate: 60 },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  const page = await fetchPageData(path);
  
  const title = page?.title || 'RADIX Wiki';
  const description = page?.excerpt || 'A decentralized wiki powered by Radix DLT';
  const ogImage = page?.bannerImage || `${BASE_URL}/og-default.png`;
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function DynamicPage({ params }: Props) {
  const { path } = await params;
  return <PageContent path={path} />;
}