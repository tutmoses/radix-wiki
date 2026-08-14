// src/lib/markdown.ts — the block tree as real markdown, for the `.md` twin of
// every wiki page (the /:path*.md rewrite → /api/wiki/:path*?format=text).
//
// Distinct from `extractText` in @/lib/content, which deliberately flattens
// everything to prose. This one preserves the structure an agent navigates and
// cites by — headings, lists, tables, code, emphasis — so a fetched page can
// be quoted precisely instead of re-summarised. No JSX component tags: dynamic
// widgets render their resolved rows when the caller has resolved them
// (resolveBlockData), and otherwise a one-line note with the live URL.

import { decodeEntities } from '@/lib/content';
import { BASE_URL, pageUrl } from '@/lib/utils';
import type { Block, AtomicBlock, ReferenceItem } from '@/types/blocks';

const BANNER_LABELS: Record<string, string> = {
  stub: 'Stub',
  unsourced: 'Needs citations',
  outdated: 'May be outdated',
  promotional: 'Written like an advertisement',
  cleanup: 'Needs cleanup',
  coi: 'Conflict of interest',
};

const decode = decodeEntities;

/** Inline-level HTML → markdown. Applied inside cells, list items, headings. */
function inline(html: string): string {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<(?:strong|b)\b[^>]*>(.*?)<\/(?:strong|b)>/gi, '**$1**')
      .replace(/<(?:em|i)\b[^>]*>(.*?)<\/(?:em|i)>/gi, '_$1_')
      .replace(/<code\b[^>]*>(.*?)<\/code>/gi, '`$1`')
      .replace(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<img\b[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/gi, '![$1]($2)')
      .replace(/<img\b[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** One `<table>` → a GFM table. Falls back to nothing when there are no rows. */
function tableToMarkdown(html: string): string {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m =>
    [...m[1]!.matchAll(/<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(c => inline(c[2]!).replace(/\|/g, '\\|')),
  );
  if (!rows.length) return '';
  const width = Math.max(...rows.map(r => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')];
  // A table whose first row is all <th> has a header; otherwise synthesise an
  // empty one, since GFM has no headerless table form.
  const headed = /<th\b/i.test(html.slice(0, html.indexOf('</tr>') + 1));
  const [head, ...body] = headed ? [pad(rows[0]!), ...rows.slice(1).map(pad)] : [Array(width).fill(''), ...rows.map(pad)];
  return [
    `| ${head!.join(' | ')} |`,
    `| ${Array(width).fill('---').join(' | ')} |`,
    ...body.map(r => `| ${r.join(' | ')} |`),
  ].join('\n');
}

/** Block-level HTML → markdown. */
export function htmlToMarkdown(html: string): string {
  let out = html;

  // Tables first — their inner markup must not be eaten by the generic rules.
  out = out.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, m => `\n\n${tableToMarkdown(m)}\n\n`);

  // Lists. `<ol>` numbering is computed per-list, which is why this cannot be a
  // single regex with a `$1` backreference — inside a replace callback `$1` is
  // a literal, not a substitution.
  out = out.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_m, body: string) => {
    const items = [...body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(i => `- ${inline(i[1]!)}`);
    return `\n\n${items.join('\n')}\n\n`;
  });
  out = out.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_m, body: string) => {
    const items = [...body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((i, n) => `${n + 1}. ${inline(i[1]!)}`);
    return `\n\n${items.join('\n')}\n\n`;
  });

  out = out
    .replace(/<pre\b[^>]*>\s*<code\b[^>]*class="language-(\w+)"[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_m, lang: string, code: string) => `\n\n\`\`\`${lang}\n${decode(code).trim()}\n\`\`\`\n\n`)
    .replace(/<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_m, code: string) => `\n\n\`\`\`\n${decode(code).trim()}\n\`\`\`\n\n`)
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_m, code: string) => `\n\n\`\`\`\n${decode(code).trim()}\n\`\`\`\n\n`)
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, body: string) =>
      `\n\n${inline(body).split('\n').map(l => `> ${l}`).join('\n')}\n\n`)
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, body: string) =>
      `\n\n${'#'.repeat(Number(level))} ${inline(body)}\n\n`)
    .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_m, body: string) => `\n\n${inline(body)}\n\n`)
    .replace(/<div\b[^>]*>([\s\S]*?)<\/div>/gi, (_m, body: string) => `\n\n${inline(body)}\n\n`);

  return decode(out.replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const refLine = (r: ReferenceItem, i: number) =>
  `${i + 1}. ${inline(r.text)}${r.url ? ` — ${r.url}` : ''}`;

type ResolvedPage = { title: string; tagPath: string; slug: string };

const pageLinks = (pages: ResolvedPage[]) =>
  pages.map(p => `- [${p.title}](${pageUrl(p.tagPath, p.slug)})`).join('\n');

function atomicToMarkdown(block: AtomicBlock): string {
  switch (block.type) {
    case 'content':
      return htmlToMarkdown(block.text);

    case 'codeTabs':
      return block.tabs
        .map(t => `**${t.label}**\n\n\`\`\`${t.language || ''}\n${decode(t.code.replace(/<[^>]+>/g, '')).trim()}\n\`\`\``)
        .join('\n\n');

    case 'banner':
      return `> **[${BANNER_LABELS[block.variant] ?? block.variant}]**${block.text ? ` ${inline(block.text)}` : ''}`;

    case 'references':
      return block.items.length
        ? `### ${block.title || 'References'}\n\n${block.items.map(refLine).join('\n')}`
        : '';

    case 'stats':
      return block.items.length
        ? block.items.map(s => `- **${s.value}${s.suffix ?? ''}** — ${s.label}`).join('\n')
        : '';

    case 'linkGrid': {
      const intro = block.intro ? `${inline(block.intro)}\n\n` : '';
      const groups = block.groups.map(g =>
        [
          `### ${g.heading}`,
          ...(g.description ? ['', htmlToMarkdown(g.description)] : []),
          '',
          ...g.links.map(l => `- [${l.label}](${l.href})`),
        ].join('\n'),
      );
      return `${intro}${groups.join('\n\n')}`;
    }

    case 'recentPages':
      return block.resolvedPages?.length
        ? pageLinks(block.resolvedPages as ResolvedPage[])
        : `_Dynamic page list — live at ${block.tagPath ? `${BASE_URL}/${block.tagPath}` : BASE_URL}_`;

    case 'pageList':
      return block.resolvedPages?.length
        ? pageLinks(block.resolvedPages as ResolvedPage[])
        : '_Curated page list — rendered on the live page._';

    case 'rssFeed':
      return block.resolvedItems?.length
        ? block.resolvedItems.map(i => `- [${i.title}](${i.link})`).join('\n')
        : `_Live feed: ${block.url}_`;

    case 'assetPrice':
      return `_Live asset price widget — ${block.resourceAddress ? `${BASE_URL}/charts/tokens/${block.resourceAddress}` : `${BASE_URL}/charts`}_`;

    case 'testimonial':
      return `> "${decode(block.quote)}"\n> — ${block.author}${block.role ? `, ${block.role}` : ''}`;

    case 'tipJar':
      return `**${block.label || 'Tip the author'}**${block.message ? `\n\n${inline(block.message)}` : ''}${block.address ? `\n\nRadix: \`${block.address}\`` : ''}`;

    case 'footer':
      return block.text ? htmlToMarkdown(block.text) : '';

    case 'store':
      return '_Product grid — rendered on the live page._';

    default:
      return '';
  }
}

/** The whole block tree as markdown. Containers flatten in document order. */
export function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map(b => {
      if (b.type === 'infobox') return b.blocks.map(atomicToMarkdown).filter(Boolean).join('\n\n');
      if (b.type === 'columns') {
        return b.columns
          .map(c => c.blocks.map(atomicToMarkdown).filter(Boolean).join('\n\n'))
          .filter(Boolean)
          .join('\n\n');
      }
      return atomicToMarkdown(b);
    })
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * A complete markdown document: YAML frontmatter + body. `last_verified` is
 * the freshness signal an agent actually needs, so it rides in the
 * frontmatter alongside the usual title/url/updated.
 */
export function pageToMarkdown(page: {
  title: string;
  url: string;
  content: unknown;
  version?: string | null;
  updatedAt?: Date | null;
  lastVerifiedAt?: Date | null;
}): string {
  const esc = (s: string) => s.replace(/"/g, '\\"');
  const front = [
    '---',
    `title: "${esc(page.title)}"`,
    `url: "${page.url}"`,
    ...(page.version ? [`version: "${esc(page.version)}"`] : []),
    ...(page.updatedAt ? [`updated: ${page.updatedAt.toISOString().split('T')[0]}`] : []),
    ...(page.lastVerifiedAt ? [`last_verified: ${page.lastVerifiedAt.toISOString().split('T')[0]}`] : []),
    'license: CC-BY-4.0',
    'license_url: "https://creativecommons.org/licenses/by/4.0/"',
    '---',
  ].join('\n');
  return `${front}\n\n# ${page.title}\n\n${blocksToMarkdown((page.content as Block[]) ?? [])}\n`;
}
