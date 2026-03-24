// src/app/api/sentinel/route.ts — Sentinel agent (immune system): link checker + content validator
//
// Scans wiki pages for broken external links and content quality issues.
// Checks a batch per run (round-robin through all pages over time).

import { prisma } from '@/lib/prisma/client';
import { json, cronRoute } from '@/lib/api';

export const maxDuration = 120;

const BATCH_SIZE = 10;

interface Issue {
  page: string;
  type: 'broken_link' | 'missing_excerpt' | 'excerpt_too_long' | 'missing_infobox';
  detail: string;
}

function extractExternalLinks(content: unknown): string[] {
  const text = JSON.stringify(content);
  const links: string[] = [];
  for (const match of text.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    links.push(match[1]!);
  }
  return [...new Set(links)];
}

async function checkLink(url: string): Promise<boolean> {
  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
        headers: { 'User-Agent': 'radix-wiki-sentinel/1.0 (link checker)' },
      });
      return res.ok;
    } catch { if (method === 'GET') return false; }
  }
  return false;
}

export const GET = cronRoute(async () => {
    // Round-robin: skip pages checked in the last 7 days
    const recentChecks = await prisma.tweet.findMany({
      where: { type: 'sentinel_check', createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      select: { pageSlug: true, pageTagPath: true },
    });
    const checkedSet = new Set(recentChecks.map(r => `${r.pageTagPath}/${r.pageSlug}`));

    const allPages = await prisma.page.findMany({
      select: { slug: true, tagPath: true, title: true, content: true, excerpt: true },
      orderBy: { updatedAt: 'desc' },
    });

    const unchecked = allPages.filter(p => !checkedSet.has(`${p.tagPath}/${p.slug}`));
    const batch = (unchecked.length > 0 ? unchecked : allPages).slice(0, BATCH_SIZE);

    const issues: Issue[] = [];
    let linksChecked = 0;

    for (const page of batch) {
      const pageKey = `${page.tagPath}/${page.slug}`;
      const pageIssues: string[] = [];

      // Content quality checks
      if (!page.excerpt) {
        issues.push({ page: pageKey, type: 'missing_excerpt', detail: page.title });
        pageIssues.push('missing_excerpt');
      } else if (page.excerpt.length > 160) {
        issues.push({ page: pageKey, type: 'excerpt_too_long', detail: `${page.excerpt.length} chars` });
        pageIssues.push('excerpt_too_long');
      }

      const contentStr = JSON.stringify(page.content);
      if (!contentStr.includes('"type":"infobox"')) {
        issues.push({ page: pageKey, type: 'missing_infobox', detail: page.title });
        pageIssues.push('missing_infobox');
      }

      // External link checks (batched for speed)
      const links = extractExternalLinks(page.content);
      linksChecked += links.length;
      let brokenCount = 0;
      const CONCURRENCY = 10;
      for (let i = 0; i < links.length; i += CONCURRENCY) {
        const batch = links.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (link) => ({ link, ok: await checkLink(link) })));
        for (const { link, ok } of results) {
          if (!ok) {
            brokenCount++;
            issues.push({ page: pageKey, type: 'broken_link', detail: link });
            pageIssues.push(`broken:${link}`);
          }
        }
      }

      // Store check result
      await prisma.tweet.create({
        data: {
          type: 'sentinel_check',
          pageSlug: page.slug,
          pageTagPath: page.tagPath,
          text: JSON.stringify({ links: links.length, broken: brokenCount, contentIssues: pageIssues }),
          status: pageIssues.length > 0 ? 'issues_found' : 'healthy',
        },
      }).catch(() => {});
    }

    return json({
      status: 'completed',
      pagesChecked: batch.length,
      pagesRemaining: Math.max(0, unchecked.length - BATCH_SIZE),
      linksChecked,
      issueCount: issues.length,
      issues,
    });
}, 'Sentinel: check failed');
