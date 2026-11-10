// src/lib/mdx.ts - Convert wiki blocks to MDX format (the /mdx download export
// and the on-chain ledger backup). The `.md` twin of a page is NOT this — it
// is real markdown with no component tags, from src/lib/markdown.ts.

import { pagePath, pageUrl } from '@/lib/utils';
import { frontmatter } from 'wiki-formant/markdown';
import { atomicToMarkdown } from '@/lib/markdown';
import type { Block, AtomicBlock, ColumnsBlock, InfoboxBlock } from '@/types/blocks';

// Only the live widgets differ from the `.md` twin: they become component tags.
// Every static leaf is the twin's own serializer, so the two exports cannot
// disagree about a code fence or an entity.
function convertAtomicBlock(block: AtomicBlock): string {
  switch (block.type) {
    case 'list': return `<List ${[`source="${block.source}"`, block.under && `under="${block.under}"`, block.count && `count={${block.count}}`, block.pages && `pages={${JSON.stringify(block.pages)}}`, `show="${block.show}"`].filter(Boolean).join(' ')} />`;
    case 'assetPrice': return `<AssetPrice ${[block.resourceAddress && `resourceAddress="${block.resourceAddress}"`, block.showChange && 'showChange'].filter(Boolean).join(' ')} />`;
    case 'networkChart': return `<NetworkChart metric="${block.metric}"${block.range ? ` range="${block.range}"` : ''} />`;
    case 'rssFeed': return `<RssFeed url="${block.url}" limit={${block.limit || 20}} />`;
    default: return atomicToMarkdown(block);
  }
}

function convertColumnsBlock(block: ColumnsBlock): string {
  const props: string[] = [];
  if (block.gap) props.push(`gap="${block.gap}"`);
  if (block.align) props.push(`align="${block.align}"`);

  const columns = block.columns.map(col => {
    const content = col.blocks.map(convertAtomicBlock).join('\n\n');
    return `<Column>\n${content}\n</Column>`;
  }).join('\n');

  return `<Columns${props.length ? ' ' + props.join(' ') : ''}>\n${columns}\n</Columns>`;
}

function convertInfoboxBlock(block: InfoboxBlock): string {
  const content = block.blocks.map(convertAtomicBlock).join('\n\n');
  return `<Infobox>\n${content}\n</Infobox>`;
}

function convertBlock(block: Block): string {
  switch (block.type) {
    case 'columns': return convertColumnsBlock(block);
    case 'infobox': return convertInfoboxBlock(block);
    default: return convertAtomicBlock(block as AtomicBlock);
  }
}

interface PageData {
  title: string;
  tagPath: string;
  slug: string;
  bannerImage?: string | null;
  version?: string;
  author?: { displayName?: string | null; shortAddress: string } | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  content: unknown;
}

export function blocksToMdx(page: PageData): string {
  const blocks = Array.isArray(page.content) ? page.content as Block[] : [];

  // The ledger restore in @/lib/radix/ledger reads `path` and `version` back out of this header.
  const header = frontmatter({
    title: page.title,
    url: pageUrl(page.tagPath ?? '', page.slug ?? ''),
    extra: {
      path: pagePath(page.tagPath ?? '', page.slug ?? ''),
      bannerImage: page.bannerImage ?? undefined,
      version: page.version,
      author: page.author ? page.author.displayName || page.author.shortAddress : undefined,
      createdAt: page.createdAt && new Date(page.createdAt).toISOString(),
      updatedAt: page.updatedAt && new Date(page.updatedAt).toISOString(),
    },
  });

  const content = blocks.map(convertBlock).filter(Boolean).join('\n\n');

  return `${header}\n\n# ${page.title}\n\n${content}`;
}
