// src/lib/maintenance.ts — tracking categories, Wikipedia's hidden maintenance
// categories, as the work queues at /maintenance. The predicates and the one
// pass over the pages are `wiki-formant/queues`, which every wiki here shares;
// what stays here is reading this wiki's pages, its addresses and the facts
// each tag path requires.

import { prisma } from '@/lib/prisma/client';
import { cached } from '@/lib/wiki';
import { pagePath } from '@/lib/utils';
import { getMetadataKeys } from '@/lib/tags';
import { leafBlocks } from '@/lib/block-shape';
import { maintenanceQueues, type MaintenanceQueue } from 'wiki-formant/queues';
import type { Block } from '@/types/blocks';

export const getMaintenanceQueues = cached('getMaintenanceQueuesWithRefs', async (): Promise<MaintenanceQueue[]> => {
  const pages = await prisma.wikiPage.findMany({
    where: { NOT: { tagPath: '' } },
    select: { id: true, title: true, slug: true, tagPath: true, content: true, metadata: true, updatedAt: true, lastVerifiedAt: true },
    orderBy: { title: 'asc' },
  });
  return maintenanceQueues(pages, {
    href: p => pagePath(p.tagPath, p.slug),
    required: tagPath => getMetadataKeys(tagPath.split('/')).filter(k => k.required),
    nowMs: Date.now(),
    verify: 'stamp the page with npx mark-verified',
    // A list that picks its pages names them by id rather than by href.
    listedIds: content => (Array.isArray(content) ? leafBlocks(content as Block[]) : []).flatMap(b => (b.type === 'list' ? (b.pages ?? []) : [])),
  });
});
