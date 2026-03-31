// src/app/api/mend/route.ts — Mender agent (regeneration): auto-fixes content quality issues
//
// Reads Sentinel findings, creates infobox blocks for pages that lack them,
// and strips broken external links.

import { prisma } from '@/lib/prisma/client';
import { Prisma } from '@prisma/client';
import { json, cronRoute } from '@/lib/api';
import { generateWithLLM } from '@/lib/moltbook';
import { parseVersion, incrementVersion, formatVersion } from '@/lib/versioning';
import { randomUUID } from 'crypto';
import { stripHtml } from '@/lib/content';
import type { Block } from '@/types/blocks';

export const maxDuration = 120;

const BATCH_SIZE = 5;
const HYDRATE_ID = 'cmk5t48vx0000005zc5se4dqz';

const INFOBOX_PROMPT = `Generate an HTML table for a wiki infobox summarizing this page's key metadata. Requirements:
- Use a <table> element with <tr> rows, each containing a <th> label and <td> value
- First row: single <td colspan="2"> with a bold category/type header
- Include relevant metadata: type/category, status, key dates, key people/entities, related links
- Maximum 8 rows
- No inline styles — use semantic HTML only
- External links: <a href="..." target="_blank" rel="noopener">
- Internal wiki links: <a href="/path"> (no rel or target attributes)
- Keep values concise (1-2 sentences max per cell)

Respond with ONLY the <table>...</table> HTML. Nothing else.`;

type FixResult = { page: string; fix: string; status: 'fixed' | 'failed'; detail?: string };

function pageTextContent(content: Block[]): string {
  const texts: string[] = [];
  for (const block of content) {
    if (block.type === 'content' && 'text' in block) texts.push(stripHtml(block.text));
    if (block.type === 'infobox' && 'blocks' in block) {
      for (const sub of block.blocks) {
        if (sub.type === 'content') texts.push(stripHtml(sub.text));
      }
    }
  }
  return texts.join('\n\n').slice(0, 3000);
}

export const GET = cronRoute(async () => {
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
          (i: string) => i === 'missing_infobox' || i.startsWith('broken:')
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

      // Strip broken links — remove <a> tag but keep anchor text
      const brokenUrls = issues.filter(i => i.startsWith('broken:')).map(i => i.slice(7));
      if (brokenUrls.length > 0) {
        const currentContent = (updates.content ?? content) as unknown as Block[];
        let contentJson = JSON.stringify(currentContent);
        for (const url of brokenUrls) {
          const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          contentJson = contentJson.replace(
            new RegExp(`<a\\s+[^>]*href=\\\\"${escaped}\\\\"[^>]*>(.*?)</a>`, 'g'),
            '$1',
          );
        }
        updates.content = JSON.parse(contentJson) as Prisma.InputJsonValue;
        fixes.push(`stripped ${brokenUrls.length} broken link(s)`);
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
