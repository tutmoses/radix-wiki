// src/lib/og.ts — single source for the social card of every URL on the wiki.
//
// The canonical, markdown-twin, Open Graph and Twitter objects are `pageMetadata`
// from `wiki-formant/metadata`, shared with the other wikis. What stays here is
// this wiki's identity — its name, locale and handle — and its generated card.

import type { Metadata } from 'next';
import { pageMetadata, type PageMetadataOptions } from 'wiki-formant/metadata';
import { SITE_URL } from '@/lib/site';

export const SITE_NAME = 'RADIX Wiki';

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
  return query ? `${SITE_URL}/og?${query}` : `${SITE_URL}/og`;
}

/**
 * Canonical + Open Graph + Twitter for one URL. Next *replaces* rather than merges
 * these objects, so anything the root layout declares (siteName, locale, the handles)
 * is lost the moment a page defines its own — every branch has to restate them, and
 * only this helper does.
 */
export function ogMetadata({ imageTitle, tagPath, banner, ...page }: Omit<PageMetadataOptions, 'image' | 'imageAlt' | 'siteName' | 'locale' | 'handle'> & {
  /** Card headline, when it should differ from the document title (the homepage's is keyword-length). */
  imageTitle?: string;
  tagPath?: string | null;
  banner?: string | null;
}): Pick<Metadata, 'alternates' | 'openGraph' | 'twitter'> {
  return pageMetadata({
    ...page,
    siteName: SITE_NAME,
    locale: 'en_US',
    handle: '@RadixWiki',
    image: ogImageUrl({ title: imageTitle ?? page.title, description: page.description, tagPath, banner }),
  });
}
