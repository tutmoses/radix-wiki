// src/app/week-in-review.xml/route.ts — the Radix Week in Review series feed.
//
// A reader who wants the weekly recap should not have to take the whole blog,
// and a syndicator carrying the series should not have to filter it. This feed
// is recaps only, full text, numbered, with the scored prediction record in the
// channel description so the one number the series owns travels with every copy.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { BASE_URL, getContentSnippet, pageUrl } from '@/lib/utils';
import { ogImageUrl } from '@/lib/og';
import { blocksToFeedHtml, clampWords, publishedAt, renderFeed, FEED_HEADERS } from '@/lib/feed';
import { RECAP_PREFIX, SERIES_SLUG, issueLabel, scoreline, type LedgerState } from '@/lib/week-in-review';
import { licenseNote } from 'wiki-formant/license';
import { WIKI_LICENSE } from '@/lib/markdown';

export const dynamic = 'force-dynamic';

const FEED_LIMIT = 30;

export async function GET() {
  const [recaps, index] = await Promise.all([
    prisma.page.findMany({
      where: { tagPath: 'blog', slug: { startsWith: RECAP_PREFIX } },
      select: { slug: true, title: true, content: true, metadata: true, bannerImage: true, createdAt: true },
    }),
    prisma.page.findFirst({ where: { tagPath: 'blog', slug: SERIES_SLUG }, select: { metadata: true } }),
  ]);

  // Issue numbers are the chronological rank of a recap among its siblings, so
  // #1 is the oldest. scripts/week-in-review.mjs derives them the same way.
  const ordered = recaps
    .map(p => ({ ...p, date: publishedAt(p.metadata, p.createdAt) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const items = ordered
    .map((p, i) => ({ ...p, issue: i + 1 }))
    .reverse()
    .slice(0, FEED_LIMIT)
    .map(p => {
      const url = pageUrl('blog', p.slug);
      const description = clampWords((p.metadata as Record<string, string> | null)?.excerpt || getContentSnippet(p.content));
      return {
        title: `${issueLabel(p.issue)}: ${p.title.replace(/^Radix Week in Review:\s*/, '')}`,
        url,
        description,
        date: p.date,
        categories: ['Radix Week in Review'],
        image: ogImageUrl({ title: p.title, description, tagPath: 'blog', banner: p.bannerImage }),
        html: blocksToFeedHtml(p.content),
      };
    });

  const state = (index?.metadata as { state?: LedgerState } | null)?.state;

  return new NextResponse(renderFeed({
    title: 'Radix Week in Review',
    link: `${BASE_URL}/blog/${SERIES_SLUG}`,
    description: `The week in the Radix ecosystem, read against the ledger. ${scoreline(state)}`,
    copyright: licenseNote(WIKI_LICENSE),
    self: `${BASE_URL}/week-in-review.xml`,
  }, items), { headers: FEED_HEADERS });
}
