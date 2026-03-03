// src/app/api/mend/route.ts — Mender agent (regeneration): auto-fixes content quality issues
//
// Reads Sentinel findings and auto-generates missing excerpts, condenses long excerpts,
// and creates infobox blocks for pages that lack them. Broken links are logged only.

import { prisma } from '@/lib/prisma/client';
import { Prisma } from '@prisma/client';
import { json, handleRoute, requireCron } from '@/lib/api';
import { generateWithLLM } from '@/lib/moltbook';
import { parseVersion, incrementVersion, formatVersion } from '@/lib/versioning';
import { randomUUID } from 'crypto';
import type { Block } from '@/types/blocks';

export const maxDuration = 120;

const BATCH_SIZE = 5;
const HYDRATE_ID = 'cmk5t48vx0000005zc5se4dqz';

const EXCERPT_PROMPT = `Write a single-sentence excerpt for this wiki page. Requirements:
- Maximum 160 characters
- Direct and factual — no hype, no markdown, no quotes
- Answers the question "what is this page about?" for an AI agent or search engine
- Do NOT start with "This page..." or "This article..."

Respond with ONLY the excerpt text. Nothing else.`;

const INFOBOX_PROMPT = `Generate an HTML table for a wiki infobox summarizing this page's key metadata. Requirements:
- Use a <table> element with <tr> rows, each containing a <th> label and <td> value
- First row: single <td colspan="2"> with a bold category/type header
- Include relevant metadata: type/category, status, key dates, key people/entities, related links
- Maximum 8 rows
- No inline styles — use semantic HTML only
- External links: <a href="..." target="_blank" rel="noopener">
- Internal wiki links: <a href="/path" rel="noopener">
- Keep values concise (1-2 sentences max per cell)

Respond with ONLY the <table>...</table> HTML. Nothing else.`;

type FixResult = { page: string; fix: string; status: 'fixed' | 'failed'; detail?: string };

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pageTextContent(content: Block[]): string {
  const texts: string[] = [];
  for (const block of content) {
    if (block.type === 'content' && 'text' in block) texts.push(stripHtml(block.text));
    if (block.type === 'infobox' && 'blocks' in block) {
      for (const sub of block.blocks) {
        if ('text' in sub) texts.push(stripHtml(sub.text));
      }
    }
  }
  return texts.join('\n\n').slice(0, 3000);
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const cronErr = requireCron(request);
    if (cronErr) return cronErr;

    // Find sentinel issues not yet mended
    const recentMends = await prisma.tweet.findMany({
      where: { type: 'mend', createdAt: { gte: new Date(Date.now() - 14 * 86_400_000) } },
      select: { pageSlug: true, pageTagPath: true },
    });
    const mendedSet = new Set(recentMends.map(r => `${r.pageTagPath}/${r.pageSlug}`));

    const sentinelIssues = await prisma.tweet.findMany({
      where: { type: 'sentinel_check', status: 'issues_found', createdAt: { gte: new Date(Date.now() - 14 * 86_400_000) } },
      select: { pageSlug: true, pageTagPath: true, text: true },
      orderBy: { createdAt: 'desc' },
    });

    // Build lookup from sentinel records (pageSlug + pageTagPath stored separately)
    const issuesByRecord = new Map<string, { slug: string; tagPath: string; issues: string[] }>();
    for (const issue of sentinelIssues) {
      if (!issue.pageSlug || !issue.pageTagPath) continue;
      const key = `${issue.pageTagPath}/${issue.pageSlug}`;
      if (mendedSet.has(key) || issuesByRecord.has(key)) continue;
      try {
        const parsed = JSON.parse(issue.text);
        const fixable = (parsed.contentIssues as string[])?.filter(
          (i: string) => i === 'missing_excerpt' || i === 'excerpt_too_long' || i === 'missing_infobox'
        );
        if (fixable?.length) issuesByRecord.set(key, { slug: issue.pageSlug, tagPath: issue.pageTagPath, issues: fixable });
      } catch { /* skip malformed */ }
    }

    const batch = [...issuesByRecord.values()].slice(0, BATCH_SIZE);
    if (batch.length === 0) return json({ status: 'nothing_to_mend', fixed: 0 });

    const results: FixResult[] = [];

    for (const { slug, tagPath, issues } of batch) {
      const pageKey = `${tagPath}/${slug}`;

      const page = await prisma.page.findUnique({
        where: { tagPath_slug: { tagPath, slug } },
      });

      if (!page) {
        results.push({ page: pageKey, fix: 'skip', status: 'failed', detail: 'Page not found' });
        continue;
      }

      const content = (page.content as unknown as Block[]) || [];
      const plainText = pageTextContent(content);
      const context = `Title: ${page.title}\nTag path: ${page.tagPath}\n\nContent:\n${plainText}`;
      const updates: Prisma.PageUpdateInput = {};
      const fixes: string[] = [];

      // Fix missing or long excerpt
      if (issues.includes('missing_excerpt') || issues.includes('excerpt_too_long')) {
        const excerpt = await generateWithLLM(EXCERPT_PROMPT, context, 100);
        if (excerpt && excerpt.length <= 160) {
          updates.excerpt = excerpt;
          fixes.push(issues.includes('missing_excerpt') ? 'generated excerpt' : 'condensed excerpt');
        } else if (excerpt) {
          updates.excerpt = excerpt.slice(0, 157) + '...';
          fixes.push('generated excerpt (truncated)');
        }
      }

      // Fix missing infobox
      if (issues.includes('missing_infobox')) {
        const tableHtml = await generateWithLLM(INFOBOX_PROMPT, context, 500);
        if (tableHtml?.includes('<table')) {
          const infoboxBlock = {
            id: randomUUID(),
            type: 'infobox' as const,
            blocks: [{ id: randomUUID(), type: 'content' as const, text: tableHtml }],
          };
          updates.content = [infoboxBlock, ...content] as unknown as Prisma.InputJsonValue;
          fixes.push('generated infobox');
        }
      }

      if (fixes.length === 0) {
        results.push({ page: pageKey, fix: 'skip', status: 'failed', detail: 'LLM generation failed' });
        continue;
      }

      // Bump version + create revision
      const ver = parseVersion(page.version);
      const newVer = formatVersion(incrementVersion(ver, 'patch'));
      updates.version = newVer;

      try {
        await prisma.$transaction(async (tx) => {
          await tx.page.update({ where: { id: page.id }, data: updates });
          await tx.revision.create({
            data: {
              pageId: page.id,
              title: page.title,
              content: (updates.content ?? page.content) as Prisma.InputJsonValue,
              version: newVer,
              changeType: 'patch',
              changes: [] as unknown as Prisma.InputJsonValue,
              authorId: page.authorId || HYDRATE_ID,
              message: `Auto-fix: ${fixes.join(', ')}`,
            },
          });
        });

        await prisma.tweet.create({
          data: {
            type: 'mend',
            pageSlug: page.slug,
            pageTagPath: page.tagPath,
            text: JSON.stringify({ fixes, version: newVer }),
            status: 'sent',
          },
        }).catch(() => {});

        results.push({ page: pageKey, fix: fixes.join(', '), status: 'fixed' });
      } catch (e) {
        results.push({ page: pageKey, fix: fixes.join(', '), status: 'failed', detail: String(e) });
      }
    }

    return json({
      status: 'completed',
      fixed: results.filter(r => r.status === 'fixed').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    });
  }, 'Mender: fix failed');
}
