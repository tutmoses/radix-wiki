// src/app/api/moltbook/route.ts — Post wiki content to Moltbook

import { prisma } from '@/lib/prisma/client';
import { moltbook } from '@/lib/moltbook';
import { json, errors, handleRoute } from '@/lib/api';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';
const SUBMOLTS = ['radix', 'crypto'];

const TEMPLATES = {
  newPage: (title: string, excerpt: string, url: string) =>
    `New on RADIX.wiki: ${title}. ${excerpt} Read more: ${url}`,
  roadmap: (title: string, excerpt: string, url: string) =>
    `Roadmap update — ${title}. ${excerpt} Xi'an is bringing cheap transactions and linear scalability to Radix. Full breakdown: ${url}`,
  dev: (title: string, excerpt: string, url: string) =>
    `${title}: ${excerpt} Scrypto makes reentrancy exploits impossible by design — assets are native primitives, not contract state. Start building: ${url}`,
  opportunity: (title: string, excerpt: string, url: string) =>
    `${title}. ${excerpt} XRD at all-time low while Xi'an development accelerates. You missed Solana at $1.50 — don't miss Radix. ${url}`,
};

type Template = keyof typeof TEMPLATES;

function pickTemplate(tagPath: string): Template {
  if (tagPath.includes('research') || tagPath.includes('core-protocols') || tagPath.includes('releases')) return 'roadmap';
  if (tagPath.startsWith('developers')) return 'dev';
  return 'newPage';
}

/**
 * POST /api/moltbook — Post recent wiki pages to Moltbook
 * Body: { slugs?: string[], template?: Template } or empty for auto-pick
 * Requires MOLTBOOK_API_KEY env var and a secret header for auth.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const secret = request.headers.get('authorization')?.replace('Bearer ', '') || request.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) return errors.unauthorized();

    if (!process.env.MOLTBOOK_API_KEY) return errors.badRequest('MOLTBOOK_API_KEY not configured');

    const body = await request.json().catch(() => ({}));
    const { template: forceTemplate, limit = 3 } = body as { template?: Template; limit?: number };

    // Get recently updated pages not yet posted
    const pages = await prisma.page.findMany({
      select: { title: true, tagPath: true, slug: true, excerpt: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    // Deduplicate: skip pages posted in the last 7 days
    const recentPosts = await prisma.tweet.findMany({
      where: { type: 'moltbook', createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { pageSlug: true, pageTagPath: true },
    });
    const alreadyPosted = new Set(recentPosts.map(p => `${p.pageTagPath}/${p.pageSlug}`));

    const results = [];

    for (const page of pages) {
      if (!page.tagPath || !page.slug || !page.excerpt) continue;
      if (alreadyPosted.has(`${page.tagPath}/${page.slug}`)) {
        results.push({ submolt: '-', title: page.title, status: 'skipped' });
        continue;
      }

      const url = `${BASE_URL}/${page.tagPath}/${page.slug}`;
      const template = forceTemplate || pickTemplate(page.tagPath);
      const text = TEMPLATES[template](page.title, page.excerpt, url);

      for (const submolt of SUBMOLTS) {
        try {
          await moltbook.post(submolt, page.title, text);
          results.push({ submolt, title: page.title, status: 'posted' });
        } catch (e) {
          results.push({ submolt, title: page.title, status: 'failed', error: (e as Error).message });
        }
      }

      await prisma.tweet.create({
        data: { type: 'moltbook', pageSlug: page.slug, pageTagPath: page.tagPath, text, status: 'sent' },
      });
    }

    return json({ posted: results.filter(r => r.status === 'posted').length, results });
  }, 'Failed to post to Moltbook');
}
