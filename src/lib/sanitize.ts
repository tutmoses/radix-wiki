// src/lib/sanitize.ts — allowlist sanitiser for wallet-authored page HTML.
//
// Content blocks store raw editor HTML and the renderer hands it to
// `dangerouslySetInnerHTML`, as do the linkGrid and references leaves in
// `wiki-formant/block-views` and the infobox's metadata table. Writes are gated
// on an XRD balance, which is a price, not a trust boundary, on a site whose
// readers connect wallets. Everything below is an allowlist: unknown tags,
// attributes (every on* handler among them), classes and URL schemes are
// dropped rather than escaped.
//
// The lists are derived from the HTML actually stored in `pages` and
// `revisions` (a Sep 2026 survey of 376 pages and 3,702 revisions, which held
// no script, handler or javascript: URL), plus what this wiki's editor nodes
// emit. A tag, attribute or class a page needs that is missing here renders
// stripped: add it here.
//
// codeTabs is absent on purpose. Its `code` is source text, which
// `highlightBlocks` escapes before highlighting; run through an HTML sanitiser
// it would lose every `<T>` in a Rust signature.

import sanitize from 'sanitize-html';
import { mapBlockTree } from 'wiki-formant/blocks';
import { BLOCK_SHAPE } from '@/lib/block-shape';
import type { Block } from '@/types/blocks';

// Inline SVG, as the infographic kit (`brand-assets/kit.mjs`) writes it. `image`
// carries the kit's logo as a data: PNG, and is held to that scheme below, so it
// can never fetch. `foreignObject`, `use`, `script` and the animation elements
// are deliberately absent.
const SVG_TAGS = ['svg', 'rect', 'line', 'path', 'circle', 'polygon', 'polyline', 'text', 'image'];

// Inert geometry and paint, applied to every SVG tag: the tag list is what
// bounds the surface.
const SVG_ATTRS = [
  'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'd', 'points', 'width', 'height',
  'viewBox', 'preserveAspectRatio', 'xmlns', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray',
  'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight',
  'letter-spacing', 'text-anchor', 'role', 'aria-label', 'style',
];

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

// Declarations only on the tags that carry them (figure chrome, table widths),
// and only layout and paint. No `position` or `z-index`, so a page cannot lay a
// fake signing prompt over the site's chrome.
const STYLE_PROPS = [
  'width', 'height', 'min-width', 'max-width', 'margin', 'padding', 'border', 'border-top',
  'border-radius', 'background', 'color', 'font-size', 'display', 'overflow',
];

// Ordinary CSS tokens plus rgb()/rgba(). Excluding quotes, backslashes and any
// other `(` keeps `url(...)` and `expression(...)` out of every property.
const SAFE_CSS_VALUE = /^(?:[a-z0-9#%.,\-+/ ]|rgba?\([\d\s,.%]+\))*$/i;

// The YouTube node round-trips its player options as iframe attributes. They are
// inert in the DOM, but an editor that loses them resets the options on save.
const YOUTUBE_ATTRS = [
  'autoplay', 'disablekbcontrols', 'enableiframeapi', 'endtime', 'ivloadpolicy', 'loop',
  'modestbranding', 'origin', 'playlist', 'rel', 'start',
];

const OPTIONS: sanitize.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'div', 'span', 'blockquote', 'q', 'pre', 'code', 'aside',
    'strong', 'b', 'em', 's', 'sup',
    'h1', 'h2', 'h3', 'h4',
    'ul', 'ol', 'li',
    'a', 'img', 'figure', 'figcaption',
    'table', 'colgroup', 'col', 'thead', 'tbody', 'tr', 'th', 'td',
    'iframe',
    ...SVG_TAGS,
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title', 'id'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    // The embed wrappers, the tab markup `activateTabGroups` reads back, and
    // the callout box.
    div: [
      'style', 'data-callout', 'data-youtube-video', 'data-iframe-embed', 'data-map-embed',
      'data-twitter-embed', 'data-tweet-id', 'data-url',
      'data-tabs', 'data-active-tab', 'data-tab-item', 'data-tab-title',
    ],
    iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'scrolling', 'loading', 'referrerpolicy', ...YOUTUBE_ATTRS],
    figure: ['style', 'data-graphic'],
    figcaption: ['style'],
    p: ['id', 'data-callout-title'],
    pre: ['language'],
    // `data-sweep` is a sweep script's idempotency sentinel.
    table: ['style', 'data-sweep'],
    col: ['style'],
    tr: ['id'],
    th: ['colspan', 'rowspan', 'colwidth'],
    td: ['colspan', 'rowspan', 'colwidth'],
    ol: ['start', 'type'],
    li: ['id'],
    // Heading ids back the anchors readers have already linked to.
    h1: ['id'], h2: ['id'], h3: ['id'], h4: ['id'],
    ...Object.fromEntries(SVG_TAGS.map(t => [t, t === 'image' ? [...SVG_ATTRS, 'href'] : SVG_ATTRS])),
  },
  // Classes are allowlisted by name, not just permitted: the stylesheet ships
  // `fixed`, `inset-0` and `z-50`, which do the overlay `position` would.
  allowedClasses: {
    a: ['link', 'notion-link', 'path-step-link'],
    code: ['language-*'],
    div: ['iframe-embed', 'map-embed', 'twitter-embed', 'tweet-embed'],
    img: ['rounded-lg', 'max-w-full'],
    iframe: ['w-full', 'aspect-video', 'rounded-lg'],
    ol: ['path'],
    li: ['path-step'],
    p: ['path-branches', 'text-text-muted'],
    span: [
      'citation-needed', 'path-step-num', 'path-step-main', 'path-step-head',
      'path-step-title', 'path-step-meta', 'path-step-desc',
    ],
    sup: ['cite'],
    table: ['tiptap-table'],
    th: ['p-2', 'font-semibold', 'bg-surface-1'],
    td: ['p-2'],
  },
  allowedStyles: { '*': Object.fromEntries(STYLE_PROPS.map(p => [p, [SAFE_CSS_VALUE]])) },
  allowedSchemes: ['http', 'https', 'mailto'],
  // The editor keeps a pasted image inline as base64, and the SVG logo only
  // ever is one.
  allowedSchemesByTag: { img: ['http', 'https', 'data'], image: ['data'] },
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
  allowedIframeHostnames: IFRAME_HOSTS,
  // SVG names are camelCase (viewBox, preserveAspectRatio). Lower-casing them
  // would still render, but keeping the case means what is stored is what was
  // allowlisted.
  parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
  // Drop the contents of a disallowed <script> or <style>, not just the tags.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
};

/** One stored HTML fragment, cleaned. Text without a tag passes untouched. */
export function sanitizeHtml(html: string): string {
  return html.includes('<') ? sanitize(html, OPTIONS) : html;
}

/** Every leaf field a renderer writes as raw HTML. Keep in step with BlockRenderer. */
function sanitizeLeaf(block: Block): Block {
  switch (block.type) {
    case 'content':
      return typeof block.text === 'string' ? { ...block, text: sanitizeHtml(block.text) } : block;
    case 'linkGrid':
      return { ...block, groups: block.groups.map(g => (g.description ? { ...g, description: sanitizeHtml(g.description) } : g)) };
    case 'references':
      return { ...block, items: block.items.map(i => ({ ...i, text: sanitizeHtml(i.text) })) };
    default:
      return block;
  }
}

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
