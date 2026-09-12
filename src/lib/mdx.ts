// src/lib/mdx.ts - Convert wiki blocks to MDX format (the /mdx download export
// and the on-chain ledger backup). The `.md` twin of a page is NOT this — it
// is real markdown with no component tags, from src/lib/markdown.ts.

import { pagePath } from '@/lib/utils';
import { atomicToMarkdown } from '@/lib/markdown';
import type { Block, AtomicBlock, ColumnsBlock, InfoboxBlock } from '@/types/blocks';

// Only the live widgets differ from the `.md` twin: they become component tags.
// Every static leaf is the twin's own serializer, so the two exports cannot
// disagree about a code fence or an entity.
function convertAtomicBlock(block: AtomicBlock): string {
  switch (block.type) {
    case 'recentPages': return `<RecentPages limit={${block.limit}}${block.tagPath ? ` tagPath="${block.tagPath}"` : ''} />`;
    case 'pageList': return `<PageList pageIds={${JSON.stringify(block.pageIds)}} />`;
    case 'assetPrice': return `<AssetPrice ${[block.resourceAddress && `resourceAddress="${block.resourceAddress}"`, block.showChange && 'showChange'].filter(Boolean).join(' ')} />`;
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

  // Not `wiki-formant/markdown`'s frontmatter: the ledger restore in
  // @/lib/radix/ledger reads `path` and `version` back out of this header.
  const frontmatter: Record<string, string | undefined> = {
    title: page.title,
    path: pagePath(page.tagPath ?? '', page.slug ?? ''),
  };
  if (page.bannerImage) frontmatter.bannerImage = page.bannerImage;
  if (page.version) frontmatter.version = page.version;
  if (page.author) {
    frontmatter.author = page.author.displayName || page.author.shortAddress;
  }
  if (page.createdAt) {
    frontmatter.createdAt = new Date(page.createdAt).toISOString();
  }
  if (page.updatedAt) {
    frontmatter.updatedAt = new Date(page.updatedAt).toISOString();
  }

  const frontmatterLines = Object.entries(frontmatter)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: "${v!.replace(/"/g, '\\"')}"`)
    .join('\n');

  const content = blocks.map(convertBlock).filter(Boolean).join('\n\n');

  return `---\n${frontmatterLines}\n---\n\n# ${page.title}\n\n${content}`;
}
