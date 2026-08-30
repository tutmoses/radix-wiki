// src/lib/mdx.ts - Convert wiki blocks to MDX format (the /mdx download export
// and the on-chain ledger backup). The `.md` twin of a page is NOT this — it
// is real markdown with no component tags, from src/lib/markdown.ts.

import { pagePath } from '@/lib/utils';
import { htmlToMarkdown } from '@/lib/markdown';
import { BANNER_LABELS } from '@/lib/content';
import type { Block, AtomicBlock, ContentBlock, ColumnsBlock, InfoboxBlock, RecentPagesBlock, PageListBlock, AssetPriceBlock } from '@/types/blocks';

function convertContentBlock(block: ContentBlock): string {
  return htmlToMarkdown(block.text);
}

function convertRecentPagesBlock(block: RecentPagesBlock): string {
  const props = block.tagPath ? ` tagPath="${block.tagPath}"` : '';
  return `<RecentPages limit={${block.limit}}${props} />`;
}

function convertPageListBlock(block: PageListBlock): string {
  return `<PageList pageIds={${JSON.stringify(block.pageIds)}} />`;
}

function convertAssetPriceBlock(block: AssetPriceBlock): string {
  const props: string[] = [];
  if (block.resourceAddress) props.push(`resourceAddress="${block.resourceAddress}"`);
  if (block.showChange) props.push('showChange');
  return `<AssetPrice ${props.join(' ')} />`;
}

function convertAtomicBlock(block: AtomicBlock): string {
  switch (block.type) {
    case 'content': return convertContentBlock(block);
    case 'recentPages': return convertRecentPagesBlock(block);
    case 'pageList': return convertPageListBlock(block);
    case 'assetPrice': return convertAssetPriceBlock(block);
    case 'rssFeed': return `<RssFeed url="${block.url}" limit={${block.limit || 20}} />`;
    case 'codeTabs': return block.tabs.map(t => `\`\`\`${t.language}\n${t.code}\n\`\`\``).join('\n\n');
    case 'store': return `<Store columns={${block.columns}} showPrice={${block.showPrice}} />`;
    case 'footer': return block.text || 'Site Footer';
    case 'stats': return block.items.map(i => `**${i.value}** ${i.label}`).join(' · ');
    case 'testimonial': return `> "${block.quote}"\n> — ${block.author}${block.role ? `, ${block.role}` : ''}`;
    case 'linkGrid': return block.groups.map(g =>
      `**${g.heading}**\n\n${g.links.map(l => `- [${l.label}](${l.href})`).join('\n')}`
    ).join('\n\n');
    case 'tipJar': return `**${block.label || 'Tip the author'}**${block.message ? `\n\n${block.message}` : ''}${block.address ? `\n\nRadix: \`${block.address}\`` : ''}`;
    case 'banner': return `> **[${BANNER_LABELS[block.variant]}]** ${block.text?.trim() || ''}`.trim();
    case 'references': return `## ${block.title || 'References'}\n\n${block.items.map((it, i) => `${i + 1}. ${htmlToMarkdown(it.text)}${it.url ? ` — ${it.url}` : ''}`).join('\n')}`;
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

  // Build frontmatter
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
