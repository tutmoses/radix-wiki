// src/app/llms-index.txt/route.ts — the exhaustive page index.
//
// Every page with a one-line excerpt, grouped by section. This is the listing
// that used to make /llms.txt heavy; agents that want the full map fetch it
// here, and /llms-full.txt has the complete text of every page.

import { prisma } from '@/lib/prisma/client';
import { SECTION_NAMES, corpusRoute, pageLine } from '@/lib/llms';
import { BASE_URL } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const GET = corpusRoute(async () => {
  const pages = await prisma.page.findMany({
    select: { title: true, tagPath: true, slug: true, content: true },
    where: { tagPath: { not: '' } },
    orderBy: { updatedAt: 'desc' },
  });

  // Group pages by top-level tag path
  const grouped = new Map<string, typeof pages>();
  for (const p of pages) {
    const topSlug = p.tagPath.split('/')[0]!;
    if (!grouped.has(topSlug)) grouped.set(topSlug, []);
    grouped.get(topSlug)!.push(p);
  }

  const sectionLines: string[] = [];
  for (const [slug, group] of grouped) {
    const name = SECTION_NAMES.get(slug) || slug;
    sectionLines.push(`## ${name}`, '', ...group.map(pageLine), '');
  }

  return [
    `# RADIX Wiki — Complete Page Index`,
    '',
    `> Every page on ${BASE_URL} (${pages.length} pages), grouped by section,`,
    `> most recently updated first. Compact site map: ${BASE_URL}/llms.txt`,
    `> Full text of every page: ${BASE_URL}/llms-full.txt`,
    `> Individual pages in markdown: append .md to any page URL`,
    '',
    ...sectionLines,
  ].join('\n');
});
