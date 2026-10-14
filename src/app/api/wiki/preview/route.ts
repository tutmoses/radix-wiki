// src/app/api/wiki/preview/route.ts — lightweight lead-paragraph + banner for
// hover page previews on internal links. Returns only what the hover card needs.

import { NextRequest } from 'next/server';
import { getPage } from '@/lib/wiki';
import { handleRoute } from 'wiki-formant/http';
import { cachedJson, CACHE } from '@/lib/api';
import { describe } from 'wiki-formant/metadata';
import { openingText } from 'wiki-formant/text';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const path = request.nextUrl.searchParams.get('path') || '';
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 2) return cachedJson({ found: false }, CACHE.medium);
    const slug = segments[segments.length - 1]!;
    const tagPath = segments.slice(0, -1).join('/');
    const page = await getPage(tagPath, slug);
    if (!page) return cachedJson({ found: false }, CACHE.medium);
    return cachedJson(
      { found: true, title: page.title, excerpt: describe(openingText(page.content), 220), bannerImage: page.bannerImage ?? null },
      CACHE.medium,
    );
  });
}
