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
// The HTML→markdown half is `wiki-formant/markdown` and the case bodies the
// wikis share are `wiki-formant/blocks`. What stays here is the DISPATCH,
// because the block type set is this project's and always will be – and a
// switch over the union means a new block type is a compile error until it is
// handled, rather than silently rendering as nothing.

import { decodeEntities, htmlToMarkdown, inlineToMarkdown } from 'wiki-formant';
import { markdownDocument } from 'wiki-formant/markdown';
import {
  renderBlockTree,
  codeTabsToMarkdown,
  bannerToMarkdown,
  referencesToMarkdown,
  statsToMarkdown,
  linkGridToMarkdown,
  linkList,
} from 'wiki-formant/blocks';
import { BANNER_LABELS } from '@/lib/content';
import { BASE_URL, pageUrl } from '@/lib/utils';
import type { Block, AtomicBlock } from '@/types/blocks';
import { ccBy40 } from 'wiki-formant/license';

// The grant, its name and the credit line, from `wiki-formant/license` — the
// same four fields the other two wikis had each written out. Only the site's own
// identity is passed in.
export const WIKI_LICENSE = ccBy40({ siteName: 'Radix Wiki', siteUrl: BASE_URL });

const decode = decodeEntities;

// `inline` and `htmlToMarkdown` are the shared converter now; aliased so the
// block renderers below read unchanged.
const inline = inlineToMarkdown;

// Re-exported: src/lib/mdx.ts converts authored HTML through this module.
export { htmlToMarkdown };

type ResolvedPage = { title: string; tagPath: string; slug: string };

const pageLinks = (pages: ResolvedPage[]) =>
  linkList(pages.map(p => ({ label: p.title, href: pageUrl(p.tagPath, p.slug) })));

function atomicToMarkdown(block: AtomicBlock): string {
  switch (block.type) {
    case 'content':
      return htmlToMarkdown(block.text);

    case 'codeTabs':
      return codeTabsToMarkdown(block.tabs);

    case 'banner':
      return bannerToMarkdown(BANNER_LABELS[block.variant] ?? block.variant, block.text);

    case 'references':
      return referencesToMarkdown(block.items, block.title || 'References');

    case 'stats':
      return statsToMarkdown(block.items);

    case 'linkGrid':
      return linkGridToMarkdown(block.groups, block.intro);

    case 'recentPages':
      return block.resolvedPages?.length
        ? pageLinks(block.resolvedPages)
        : `_Dynamic page list — live at ${block.tagPath ? `${BASE_URL}/${block.tagPath}` : BASE_URL}_`;

    case 'pageList':
      return block.resolvedPages?.length
        ? pageLinks(block.resolvedPages)
        : '_Curated page list — rendered on the live page._';

    case 'rssFeed':
      return block.resolvedItems?.length
        ? linkList(block.resolvedItems.map(i => ({ label: i.title, href: i.link })))
        : `_Live feed: ${block.url}_`;

    case 'assetPrice':
      return `_Live asset price widget — ${block.resourceAddress ? `${BASE_URL}/charts/tokens/${block.resourceAddress}` : `${BASE_URL}/charts`}_`;

    case 'testimonial':
      return `> "${decode(block.quote)}"\n> — ${block.author}${block.role ? `, ${block.role}` : ''}`;

    case 'tipJar':
      return `**${block.label || 'Tip the author'}**${block.message ? `\n\n${inline(block.message)}` : ''}${block.address ? `\n\nRadix: \`${block.address}\`` : ''}`;

    default:
      return '';
  }
}

/** The whole block tree as markdown. Containers flatten in document order. */
export function blocksToMarkdown(blocks: Block[]): string {
  return renderBlockTree<Block>(blocks, {
    atomic: b => (b.type === 'infobox' || b.type === 'columns' ? '' : atomicToMarkdown(b)),
    containers: b =>
      b.type === 'infobox' ? [b.blocks] : b.type === 'columns' ? b.columns.map(c => c.blocks) : null,
  });
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
