// src/app/api/announce/route.ts — tell the subscribers an issue exists.
//
// Blog pages are seeded by scripts that write `pages` and `revisions` over a raw
// connection, which is the right call for auth and XRD gating but means the
// webhook and Telegram fan-out in lib/webhooks.ts never fires. A published issue
// reached nobody: no webhook, no Telegram, only whoever polled the feed. This is
// the one call a publish script makes afterwards to close that gap.
//
// Shared-secret rather than wallet auth because the caller is a script, not a
// person. With ANNOUNCE_SECRET unset the route does not exist.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { handleRoute, json, errors } from '@/lib/api';
import { deliverWebhooks } from '@/lib/webhooks';
import { broadcast, broadcastChatIds, formatAnnouncement } from '@/lib/webhooks';
import { getContentSnippet, pageUrl } from '@/lib/utils';
import { recapIssues } from '@/lib/feed';
import { RECAP_PREFIX, SERIES_SLUG, issueLabel, scoreline, type LedgerState } from '@/lib/week-in-review';

export const dynamic = 'force-dynamic';

const SECRET = process.env.ANNOUNCE_SECRET || '';

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    if (!SECRET) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (request.headers.get('authorization') !== `Bearer ${SECRET}`) return errors.unauthorized();

    const { tagPath, slug, channels = true } = await request.json() as
      { tagPath?: string; slug?: string; channels?: boolean };
    if (!tagPath || !slug) return errors.badRequest('tagPath and slug are required');

    const page = await prisma.page.findFirst({
      where: { tagPath, slug },
      select: { title: true, slug: true, tagPath: true, version: true, content: true, metadata: true },
    });
    if (!page) return errors.notFound('Page not found');

    const meta = (page.metadata ?? {}) as Record<string, string>;
    const excerpt = meta.excerpt || getContentSnippet(page.content, 240);
    const url = pageUrl(page.tagPath, page.slug);

    // Subscribers and webhooks, through the same path an API write would take.
    deliverWebhooks('page.created', page, null, null, null);

    // A recap carries its issue number and the running record; anything else is
    // announced as itself.
    let kicker: string | undefined;
    let footer: string | undefined;
    if (tagPath === 'blog' && slug.startsWith(RECAP_PREFIX)) {
      const [siblings, index] = await Promise.all([
        prisma.page.findMany({
          where: { tagPath: 'blog', slug: { startsWith: RECAP_PREFIX } },
          select: { slug: true, metadata: true, createdAt: true },
        }),
        prisma.page.findFirst({ where: { tagPath: 'blog', slug: SERIES_SLUG }, select: { metadata: true } }),
      ]);
      const issue = recapIssues(siblings).find(p => p.slug === slug)?.issue;
      if (issue) kicker = `Radix Week in Review, ${issueLabel(issue)}`;
      footer = scoreline((index?.metadata as { state?: LedgerState } | null)?.state);
    }

    const chats = channels ? broadcastChatIds() : [];
    const results = chats.length
      ? await broadcast(chats, formatAnnouncement({ title: page.title, url, excerpt, kicker, footer }))
      : [];

    return json({
      ok: true,
      url,
      subscribersNotified: true,
      broadcast: results,
    });
  }, 'Failed to announce');
}
