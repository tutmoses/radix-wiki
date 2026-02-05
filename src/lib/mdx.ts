// src/lib/mdx.ts - Convert wiki blocks to MDX format

import type { Block, AtomicBlock, ContentBlock, ColumnsBlock, InfoboxBlock, RecentPagesBlock, PageListBlock, AssetPriceBlock } from '@/types/blocks';

function htmlToMarkdown(html: string): string {
  if (!html?.trim()) return '';

  return html
    // Headers
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    // Bold/italic
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    // Code
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*><code[^>]*class="language-(\w+)"[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```$1\n$2\n```\n')
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    // Images
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
    .replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
    // Lists
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) =>
      content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    )
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
      let i = 0;
      return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, () => `${++i}. $1\n`);
    })
    // Blockquote
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) =>
      content.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n'
    )
    // Paragraphs and breaks
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    // Tables
    .replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, content) => {
      const rows: string[] = [];
      const headerMatch = content.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
      const bodyMatch = content.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);

      const extractCells = (row: string, tag: string) => {
        const cells: string[] = [];
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
        let match;
        while ((match = regex.exec(row))) {
          cells.push(match[1].replace(/<[^>]*>/g, '').trim());
        }
        return cells;
      };

      if (headerMatch) {
        const headerCells = extractCells(headerMatch[1], 'th');
        if (headerCells.length) {
          rows.push(`| ${headerCells.join(' | ')} |`);
          rows.push(`| ${headerCells.map(() => '---').join(' | ')} |`);
        }
      }

      const body = bodyMatch ? bodyMatch[1] : content;
      const rowMatches = body.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
      for (const row of rowMatches) {
        const cells = extractCells(row, 'td');
        if (cells.length) rows.push(`| ${cells.join(' | ')} |`);
      }

      return rows.length ? '\n' + rows.join('\n') + '\n\n' : '';
    })
    // Strip remaining tags
    .replace(/<[^>]*>/g, '')
    // Decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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
  excerpt?: string | null;
  bannerImage?: string | null;
  version?: string;
  author?: { displayName?: string | null; radixAddress: string } | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  content: unknown;
}

export function blocksToMdx(page: PageData): string {
  const blocks = Array.isArray(page.content) ? page.content as Block[] : [];

  // Build frontmatter
  const frontmatter: Record<string, string | undefined> = {
    title: page.title,
    path: `/${page.tagPath}/${page.slug}`,
  };
  if (page.excerpt) frontmatter.excerpt = page.excerpt;
  if (page.bannerImage) frontmatter.bannerImage = page.bannerImage;
  if (page.version) frontmatter.version = page.version;
  if (page.author) {
    frontmatter.author = page.author.displayName || page.author.radixAddress;
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
