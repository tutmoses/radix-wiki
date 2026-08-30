// src/lib/markdown.ts — the block tree as real markdown, for the `.md` twin of
// every wiki page (the /:path*.md rewrite → /api/wiki/:path*?format=text).
//
// Distinct from `extractText` in @/lib/content, which deliberately flattens
// everything to prose. This one preserves the structure an agent navigates and
// cites by — headings, lists, tables, code, emphasis — so a fetched page can
// be quoted precisely instead of re-summarised. No JSX component tags: dynamic
// widgets render their resolved rows when the caller has resolved them
// (resolveBlockData), and otherwise a one-line note with the live URL.
//
// The HTML→markdown half is `wiki-formant/markdown`, shared with the other
// wikis. What stays here is the block tree, because the block TYPE SET is this
// project's and always will be.

import { decodeEntities, htmlToMarkdown, inlineToMarkdown } from 'wiki-formant';
import { markdownDocument } from 'wiki-formant/markdown';
import { BANNER_LABELS } from '@/lib/content';
import { BASE_URL, pageUrl } from '@/lib/utils';
import type { Block, AtomicBlock, ReferenceItem } from '@/types/blocks';

export const WIKI_LICENSE = {
  spdx: 'CC-BY-4.0',
  url: 'https://creativecommons.org/licenses/by/4.0/',
} as const;

const decode = decodeEntities;

// `inline` and `htmlToMarkdown` are the shared converter now; aliased so the
// block renderers below read unchanged.
const inline = inlineToMarkdown;

// Re-exported: src/lib/mdx.ts converts authored HTML through this module.
export { htmlToMarkdown };

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
 *
 * The frontmatter itself is `wiki-formant/markdown` – this was the third
 * hand-rolled YAML builder in the workspace and the second in this repo.
 */
export function pageToMarkdown(page: {
  title: string;
  url: string;
  content: unknown;
  version?: string | null;
  updatedAt?: Date | null;
  lastVerifiedAt?: Date | null;
}): string {
  return markdownDocument(
    {
      title: page.title,
      url: page.url,
      updated: page.updatedAt,
      lastVerified: page.lastVerifiedAt,
      license: WIKI_LICENSE,
      extra: { version: page.version ?? undefined },
    },
    blocksToMarkdown((page.content as Block[]) ?? []),
  );
}
