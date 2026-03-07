// src/lib/scout.ts — Shared scout triage logic

import { prisma } from '@/lib/prisma/client';
import { generateWithLLM } from '@/lib/moltbook';

export interface IntelItem {
  source: string;
  title: string;
  url: string;
  summary: string;
  date: string;
}

const TRIAGE_PROMPT = `You are a research scout for radix.wiki. Given intel items from Radix ecosystem sources and a list of existing wiki pages, identify items that:
1. Are NOT already covered by existing wiki pages
2. Are significant enough to warrant a new wiki article

For each relevant item, output a JSON array: [{ "title": "...", "url": "...", "reason": "...", "suggestedSlug": "...", "suggestedTagPath": "contents/tech/..." }]

Only include genuinely newsworthy items (major releases, new features, architectural changes). Skip minor patches, routine updates, and already-covered topics.
Respond with ONLY the JSON array. If nothing is noteworthy, respond with [].`;

/** Shared pipeline: deduplicate, store, triage, and flag intel items. */
export async function triageIntel(allIntel: IntelItem[]): Promise<{ newCount: number; flagged: Array<{ url?: string }> }> {
  // Deduplicate against intel gathered in the last 7 days
  const recentIntel = await prisma.tweet.findMany({
    where: { type: 'scout_intel', createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    select: { inReplyTo: true },
  });
  const recentUrls = new Set(recentIntel.map(r => r.inReplyTo).filter(Boolean));
  const newIntel = allIntel.filter(i => !recentUrls.has(i.url));

  if (newIntel.length === 0) return { newCount: 0, flagged: [] };

  // Store all new intel
  for (const item of newIntel) {
    await prisma.tweet.create({
      data: { type: 'scout_intel', text: JSON.stringify(item), status: 'new', inReplyTo: item.url },
    });
  }

  // LLM triage: which items deserve wiki pages?
  const existingPages = await prisma.page.findMany({ select: { title: true, slug: true, tagPath: true } });
  const pageList = existingPages.map(p => `${p.tagPath}/${p.slug}: ${p.title}`).join('\n');
  const triageInput = `Intel items:\n${JSON.stringify(newIntel, null, 2)}\n\nExisting wiki pages:\n${pageList}`;
  const triageResult = await generateWithLLM(TRIAGE_PROMPT, triageInput, 500);

  let flagged: Array<{ url?: string }> = [];
  if (triageResult) {
    try {
      const match = triageResult.match(/\[[\s\S]*\]/);
      flagged = match ? JSON.parse(match[0]) : [];
    } catch { flagged = []; }
  }

  // Mark flagged items
  for (const item of flagged) {
    if (item.url) {
      await prisma.tweet.updateMany({
        where: { type: 'scout_intel', inReplyTo: item.url },
        data: { status: 'flagged' },
      });
    }
  }

  return { newCount: newIntel.length, flagged };
}
