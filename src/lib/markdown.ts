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

import { decodeEntities, inlineToMarkdown, markdownDocument } from 'wiki-formant/markdown';
import { coreAtomicToMarkdown, renderBlockTree, linkList } from 'wiki-formant/blocks';
import { pageUrl } from '@/lib/utils';
import { SITE_URL, WIKI_LICENSE } from '@/lib/site';
import type { Block, AtomicBlock } from '@/types/blocks';
import { BLOCK_SHAPE } from '@/lib/block-shape';

const decode = decodeEntities;

// The shared inline converter, aliased so the block renderers below read unchanged.
const inline = inlineToMarkdown;

type ResolvedPage = { title: string; tagPath: string; slug: string };

const pageLinks = (pages: ResolvedPage[]) =>
  linkList(pages.map(p => ({ label: p.title, href: pageUrl(p.tagPath, p.slug) })));

/** One leaf as markdown. The MDX export reuses it for every static leaf. */
export function atomicToMarkdown(block: AtomicBlock): string {
  switch (block.type) {
    case 'content': case 'codeTabs': case 'banner':
    case 'references': case 'stats': case 'linkGrid':
      return coreAtomicToMarkdown(block, { siteUrl: SITE_URL });

    case 'recentPages':
      return block.resolvedPages?.length
        ? pageLinks(block.resolvedPages)
        : `_Dynamic page list — live at ${block.tagPath ? `${SITE_URL}/${block.tagPath}` : SITE_URL}_`;

    case 'pageList':
      return block.resolvedPages?.length
        ? pageLinks(block.resolvedPages)
        : '_Curated page list — rendered on the live page._';

    case 'rssFeed':
      return block.resolvedItems?.length
        ? linkList(block.resolvedItems.map(i => ({ label: i.title, href: i.link })))
        : `_Live feed: ${block.url}_`;

    case 'assetPrice':
      return `_Live asset price widget — ${block.resourceAddress ? `${SITE_URL}/charts/tokens/${block.resourceAddress}` : `${SITE_URL}/charts`}_`;

    case 'testimonial':
      return `> "${decode(block.quote)}"\n> — ${block.author}${block.role ? `, ${block.role}` : ''}`;

    case 'tipJar':
      return `**${block.label || 'Tip the author'}**${block.message ? `\n\n${inline(block.message)}` : ''}${block.address ? `\n\nRadix: \`${block.address}\`` : ''}`;

    default:
      return '';
  }
}

/** The whole block tree as markdown. Containers flatten in document order. */
function blocksToMarkdown(blocks: Block[]): string {
  return renderBlockTree<Block>(blocks, {
    atomic: b => (b.type === 'infobox' || b.type === 'columns' ? '' : atomicToMarkdown(b)),
    containers: BLOCK_SHAPE.containers,
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
