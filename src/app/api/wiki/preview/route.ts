// src/app/api/wiki/preview/route.ts — the hover card's answer for an internal
// link (`WikiLinkPreview`): the title, lead paragraph and banner, or 404 for an
// address that is no page. Only what the card needs.

import { NextRequest } from 'next/server';
import { getPage, pageTag, routeTags } from '@/lib/wiki';
import { handleRoute } from 'wiki-formant/http';
import { cachedJson, CACHE } from '@/lib/api';
import { describe } from 'wiki-formant/metadata';
import { openingText } from 'wiki-formant/text';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const path = request.nextUrl.searchParams.get('path') || '';
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 2) return cachedJson({ error: 'No page' }, CACHE.medium, 404);
    const slug = segments[segments.length - 1]!;
    const tagPath = segments.slice(0, -1).join('/');
    const page = await getPage(tagPath, slug);
    // The page's tag, so the save that changes it (or the create that fills it) purges this at the CDN.
    const headers = { ...CACHE.medium, ...routeTags(pageTag(tagPath, slug)) };
    if (!page) return cachedJson({ error: 'No page' }, headers, 404);
    return cachedJson(
      { title: page.title, excerpt: describe(openingText(page.content), 220), bannerImage: page.bannerImage ?? null },
      headers,
    );
  });
}
