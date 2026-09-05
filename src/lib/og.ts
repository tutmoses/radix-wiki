// src/lib/og.ts — single source for the social card of every URL on the wiki.

import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/utils';

export const SITE_NAME = 'RADIX Wiki';
const SITE_HANDLE = '@RadixWiki';

const CARD = { width: 1200, height: 630 } as const;

/** URL of the generated 1200x630 card. `tagPath` picks the section palette; `banner` overrides the gradient. */
export function ogImageUrl({ title, description, tagPath, banner }: {
  title?: string;
  description?: string;
  tagPath?: string | null;
  banner?: string | null;
}): string {
  const params = new URLSearchParams();
  if (title) params.set('title', title);
  if (description) params.set('description', description);
  if (tagPath) params.set('tagPath', tagPath);
  if (banner) params.set('banner', banner);
  const query = params.toString();
  return query ? `${BASE_URL}/og?${query}` : `${BASE_URL}/og`;
}

interface OgArticle {
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
}

/**
 * Canonical + Open Graph + Twitter for one URL. Next *replaces* rather than merges
 * these objects, so anything the root layout declares (siteName, locale, the handles)
 * is lost the moment a page defines its own — every branch has to restate them, and
 * only this helper does.
 */
export function ogMetadata({ title, description, url, type = 'website', imageTitle, tagPath, banner, article }: {
  title: string;
  description: string;
  url: string;
  type?: 'website' | 'article';
  /** Card headline, when it should differ from the document title (the homepage's is keyword-length). */
  imageTitle?: string;
  tagPath?: string | null;
  banner?: string | null;
  article?: OgArticle;
}): Pick<Metadata, 'alternates' | 'openGraph' | 'twitter'> {
  const image = ogImageUrl({ title: imageTitle ?? title, description, tagPath, banner });
  const shared = {
    title, description, url,
    siteName: SITE_NAME,
    locale: 'en_US',
    images: [{ url: image, alt: title, ...CARD }],
  };
  return {
    alternates: { canonical: url },
    openGraph: type === 'article' ? { ...shared, type, ...article } : { ...shared, type },
    twitter: {
      card: 'summary_large_image',
      site: SITE_HANDLE,
      creator: SITE_HANDLE,
      title, description,
      images: [image],
    },
  };
}
