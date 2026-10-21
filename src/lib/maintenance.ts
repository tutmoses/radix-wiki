// src/lib/maintenance.ts — Tracking categories.
//
// Wikipedia's hidden maintenance categories are its work queue: a cleanup
// template files a page into `Articles needing update` / `Orphaned articles`,
// and contributors pick work off the list. This wiki already computed the same
// signals — `isStale()` drives the outdated banner, the content standard asks
// for hyperlinked assertions, tag paths declare required metadata — but each
// only ever surfaced on the affected page, where nobody looking for work sees
// it. These are those predicates, gathered into lists.

import { prisma } from '@/lib/prisma/client';
import { cached } from '@/lib/wiki';
import { pagePath } from '@/lib/utils';
import { isStale, daysSince } from 'wiki-formant/freshness';
import { getMetadataKeys } from '@/lib/tags';
import { leafBlocks } from '@/lib/block-shape';
import type { Block } from '@/types/blocks';

const HREF = /href=\\?"([^"\\?#]+)/g;
/** A `references` block keeps each citation in a `url` field, not an href. */
const REF_URL = /"url":"https?:/g;

interface MaintenanceItem { title: string; href: string; tagPath: string; detail: string }
export interface MaintenanceQueue { key: string; title: string; description: string; items: MaintenanceItem[] }

type Row = {
  id: string; title: string; slug: string; tagPath: string;
  content: unknown; metadata: unknown; updatedAt: Date; lastVerifiedAt: Date | null;
};

const href = (p: Row) => pagePath(p.tagPath, p.slug);

export const getMaintenanceQueues = cached('getMaintenanceQueuesWithRefs', async (): Promise<MaintenanceQueue[]> => {
  const pages = await prisma.wikiPage.findMany({
    where: { NOT: { tagPath: '' } },
    select: { id: true, title: true, slug: true, tagPath: true, content: true, metadata: true, updatedAt: true, lastVerifiedAt: true },
    orderBy: { title: 'asc' },
  }) as Row[];

  // One pass builds the link graph and the per-page link tallies together: page
  // content is the expensive read, so it is serialised once and reused.
  const ids = new Set(pages.map(p => p.id));
  const linkedPaths = new Set<string>();
  const linkedIds = new Set<string>();
  const external = new Map<string, number>();
  for (const page of pages) {
    const text = JSON.stringify(page.content ?? '');
    let outbound = 0;
    for (const [, target] of text.matchAll(HREF)) {
      if (!target) continue;
      if (target.startsWith('/')) linkedPaths.add(target.replace(/\/+$/, ''));
      else if (/^https?:/i.test(target)) outbound++;
    }
    external.set(page.id, outbound + (text.match(REF_URL)?.length ?? 0));
    // A list that picks its pages names them by id rather than by href.
    for (const b of Array.isArray(page.content) ? leafBlocks(page.content as Block[]) : []) {
      if (b.type === 'list') for (const id of b.pages ?? []) if (id !== page.id && ids.has(id)) linkedIds.add(id);
    }
  }

  const orphaned = pages.filter(p => !linkedPaths.has(href(p)) && !linkedIds.has(p.id));
  const nowMs = Date.now();
  const outdated = pages.filter(p => isStale(p, nowMs));
  const unsourced = pages.filter(p => !external.get(p.id));
  const incomplete = pages.flatMap(p => {
    const meta = (p.metadata ?? {}) as Record<string, string>;
    const missing = getMetadataKeys(p.tagPath.split('/')).filter(k => k.required && !meta[k.key]?.trim()).map(k => k.label.replace(/:$/, ''));
    return missing.length ? [{ page: p, missing }] : [];
  });

  return [
    {
      key: 'outdated',
      title: 'Outdated',
      description: 'Last verified more than 180 days ago. Re-check the facts against current sources, then stamp the page with npx mark-verified.',
      items: outdated.map(p => ({ title: p.title, href: href(p), tagPath: p.tagPath, detail: `${daysSince(p.lastVerifiedAt ?? p.updatedAt, nowMs)} days` })),
    },
    {
      key: 'orphaned',
      title: 'Orphaned',
      description: 'No other page links here. Readers can only arrive via search or the category index — link them from a related article.',
      items: orphaned.map(p => ({ title: p.title, href: href(p), tagPath: p.tagPath, detail: 'no inbound links' })),
    },
    {
      key: 'unsourced',
      title: 'Unsourced',
      description: 'No external link anywhere in the page. Every factual claim should hyperlink to the source it came from.',
      items: unsourced.map(p => ({ title: p.title, href: href(p), tagPath: p.tagPath, detail: 'no external links' })),
    },
    {
      key: 'incomplete',
      title: 'Missing required metadata',
      description: 'A field the page\u2019s tag path declares as required is empty, so its infobox and category facets are incomplete.',
      items: incomplete.map(({ page, missing }) => ({ title: page.title, href: href(page), tagPath: page.tagPath, detail: `missing ${missing.join(', ')}` })),
    },
  ].filter(q => q.items.length > 0);
});
