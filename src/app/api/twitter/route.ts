// src/app/api/twitter/route.ts — Herald agent: generate tweets + queue for browser posting
//
// Cron runs 3x daily, generating one tweet each time (capped at 3 queued).
// Assigns a content pillar based on day of week.
// Posting happens via /api/twitter/queue → browser automation in Claude Code sessions.

import { prisma } from '@/lib/prisma/client';
import { generateWithLLM, formatPageContext } from '@/lib/moltbook';
import { json, cronRoute } from '@/lib/api';
import { getRecentPostSlugs } from '@/lib/scoring';
import { BASE_URL, getContentSnippet } from '@/lib/utils';
import { readFileSync } from 'fs';
import { join } from 'path';

const TWEET_SYSTEM_PROMPT = `You are @RadixWiki, a knowledgeable Twitter account for the Radix DLT ecosystem wiki. Write a tweet about the wiki page below.

Rules:
- Factual, link-heavy — drive readers to the wiki page
- Knowledgeable but approachable ("helpful librarian" tone)
- Under 240 characters (leave room for the URL to be appended)
- No emojis, no "NEW:" or "BREAKING:" openers
- Vary format: sometimes a question, sometimes a fact, sometimes a hook
- End naturally — the URL will be appended after your text`;
const MAX_QUEUED = 5;

// Sun=0 .. Sat=6 → content pillar for the day
const PILLARS = ['review', 'ecosystem', 'dev', 'roadmap', 'protocol', 'community', 'ecosystem'] as const;

export const maxDuration = 60;

export const GET = cronRoute(async () => {
    // Back-pressure: don't queue if posting hasn't kept up
    const queueDepth = await prisma.tweet.count({ where: { type: 'twitter', status: 'queued' } });
    if (queueDepth >= MAX_QUEUED) return json({ status: 'skipped', reason: `queue full (${queueDepth} pending)` });

    const pages = await prisma.page.findMany({
      where: { tagPath: { not: '' } },
      select: { title: true, tagPath: true, slug: true, content: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const alreadyTweeted = await getRecentPostSlugs(['twitter', 'moltbook'], 7);
    const eligible = pages.filter(p =>
      p.tagPath && p.slug && !alreadyTweeted.has(`${p.tagPath}/${p.slug}`),
    );

    if (eligible.length === 0) return json({ status: 'skipped', reason: 'no fresh pages' });

    const page = eligible[Math.floor(Math.random() * Math.min(eligible.length, 10))]!;
    const url = `${BASE_URL}/${page.tagPath}/${page.slug}`;
    const snippet = getContentSnippet(page.content);

    // DMAIC Loop 2: read tweet engagement feedback to bias toward high-performing topics
    let feedbackHint = '';
    try {
      const raw = readFileSync(join(process.cwd(), 'data', 'tweet-feedback.json'), 'utf-8');
      const feedback = JSON.parse(raw) as { topPillars?: string[]; bottomPillars?: string[] };
      const parts: string[] = [];
      if (feedback.topPillars?.length) parts.push(`Recent high-engagement topics: ${feedback.topPillars.join(', ')}.`);
      if (feedback.bottomPillars?.length) parts.push(`Lower-engagement topics to avoid: ${feedback.bottomPillars.join(', ')}.`);
      if (parts.length) feedbackHint = '\n' + parts.join(' ');
    } catch { /* no feedback file yet — that's fine */ }

    const systemPrompt = TWEET_SYSTEM_PROMPT + feedbackHint;
    const text = await generateWithLLM(systemPrompt, formatPageContext({ ...page, snippet }, url), 100, url)
      ?? `${page.title}: ${snippet || 'Read more on the Radix wiki.'} ${url}`;
    const pillar = PILLARS[new Date().getUTCDay()]!;

    await prisma.tweet.create({
      data: { type: 'twitter', pillar, pageSlug: page.slug, pageTagPath: page.tagPath, text, status: 'queued' },
    });

    return json({ status: 'queued', pillar, title: page.title, text, queueDepth: queueDepth + 1 });
}, 'Herald: failed to generate tweet');
