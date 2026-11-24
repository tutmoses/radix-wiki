// src/lib/og.ts — single source for the social card of every URL on the wiki.
//
// The canonical, markdown-twin, Open Graph and Twitter objects are `pageMetadata`
// from `wiki-formant/metadata`, shared with the other wikis, bound once to this
// wiki's name, handle and card route (`CARD`, `@/lib/site`).

import type { Metadata } from 'next';
import { sitePageMetadata, type PageMetadataOptions } from 'wiki-formant/metadata';
import { CARD, SITE_NAME, X } from '@/lib/site';

const pageMetadata = sitePageMetadata({ siteName: SITE_NAME, handle: X.handle, card: CARD });

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
  return pageMetadata({ ...page, card: { title: imageTitle ?? page.title, description: page.description, tagPath, banner } });
}
