// src/lib/sanitize.ts — allowlist sanitiser for wallet-authored page HTML.
//
// Content blocks store raw editor HTML and the renderer hands it to
// `dangerouslySetInnerHTML`, as do the linkGrid and references leaves in
// `wiki-formant/block-views` and the infobox's metadata table. Writes are gated
// on an XRD balance, which is a price, not a trust boundary, on a site whose
// readers connect wallets.
//
// The allowlist is `wiki-formant/sanitize`: the prose set, what the shared
// editor nodes store, and the presentational SVG subset. What is below is this
// wiki's own, derived from the HTML actually stored in `pages` and `revisions`
// (a Sep 2026 survey of 376 pages and 3,702 revisions, which held no script,
// handler or javascript: URL). A tag, attribute or class a page needs that is
// missing renders stripped: add it here.

import { mapBlockTree } from 'wiki-formant/blocks';
import { createHtmlSanitizer, sanitizeCoreLeaf } from 'wiki-formant/sanitize';
import { BLOCK_SHAPE } from '@/lib/block-shape';
import type { Block } from '@/types/blocks';

// Third-party embed hosts: the editor's YouTube, tweet and map nodes, plus every
// host a stored iframe points at. `frame-src` in next.config.ts is `https:`
// broad, so this list is the only thing deciding which hosts a page can frame.
const IFRAME_HOSTS = [
  'www.youtube.com', 'www.youtube-nocookie.com', 'platform.twitter.com',
  'www.google.com', 'maps.google.com', 'embed.apple.com', 'docs.google.com',
  'radixrolodex.com', 'quack.space',
  // Only in older revisions, kept so a restore still renders.
  'embed.notion.co', 'replit.com', 'tutmoses.github.io', 'widgets.sociablekit.com',
];

// The YouTube node round-trips its player options as iframe attributes. They are
// inert in the DOM, but an editor that loses them resets the options on save.
const YOUTUBE_ATTRS = [
  'autoplay', 'disablekbcontrols', 'enableiframeapi', 'endtime', 'ivloadpolicy', 'loop',
  'modestbranding', 'origin', 'playlist', 'rel', 'start',
];

/** One stored HTML fragment, cleaned. Text without a tag passes untouched. */
export const sanitizeHtml = createHtmlSanitizer({
  iframeHosts: IFRAME_HOSTS,
  // `image` is the infographic kit's logo (`brand-assets/kit.mjs`), always a
  // data: PNG and held to that scheme below, so it can never fetch.
  tags: ['q', 'aside', 'image'],
  attributes: {
    div: ['data-callout'],
    iframe: YOUTUBE_ATTRS,
    img: ['decoding'],
    p: ['data-callout-title'],
    pre: ['language'],
    // `data-sweep` is a sweep script's idempotency sentinel.
    table: ['style', 'data-sweep'],
    col: ['style'],
    tr: ['id'],
    ol: ['start', 'type'],
    image: ['x', 'y', 'width', 'height', 'href', 'preserveAspectRatio', 'opacity'],
  },
  classes: {
    a: ['notion-link', 'path-step-link'],
    div: ['tweet-embed'],
    iframe: ['w-full', 'aspect-video', 'rounded-lg'],
    ol: ['path'],
    li: ['path-step'],
    p: ['path-branches', 'text-text-muted'],
    span: [
      'citation-needed', 'path-step-num', 'path-step-main', 'path-step-head',
      'path-step-title', 'path-step-meta', 'path-step-desc',
    ],
    sup: ['cite'],
  },
  schemesByTag: { image: ['data'] },
});

/**
 * Every leaf field a renderer writes as raw HTML. codeTabs is left alone on
 * purpose: its `code` is source text, which `highlightBlocks` escapes before
 * highlighting, and through an HTML sanitiser it would lose every `<T>` in a
 * Rust signature.
 */
const sanitizeLeaf = (block: Block): Block =>
  block.type === 'codeTabs' ? block : sanitizeCoreLeaf(block, sanitizeHtml);

/**
 * A page row with its authored HTML cleaned: the block tree, and every string
 * metadata value, which the infobox renders as table cells. Non-string metadata
 * (a sweep's `state`) passes through, so an editor save round-trips it.
 *
 * Runs server-side on the way to the renderer and the editor, never on write,
 * so it covers rows stored before it existed and no sanitiser ships to the client.
 */
export function sanitizePage<T extends { content: unknown; metadata?: unknown }>(page: T): T {
  const { content, metadata } = page;
  return {
    ...page,
    content: Array.isArray(content) ? mapBlockTree(content as Block[], sanitizeLeaf, BLOCK_SHAPE) : content,
    metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? Object.fromEntries(Object.entries(metadata).map(([k, v]) => [k, typeof v === 'string' ? sanitizeHtml(v) : v]))
      : metadata,
  };
}
