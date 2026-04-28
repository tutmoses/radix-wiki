// src/lib/html.ts — HTML post-processing for wiki content rendering

import { slugify } from '@/lib/utils';
import type { Block, AtomicBlock } from '@/types/blocks';

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();

/** Extract an attribute value from an anchor attribute string (e.g. ` rel="nofollow" href="/x"`). */
function getAttr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] ?? null : null;
}

/** Remove an attribute from an attribute string. */
function removeAttr(attrs: string, name: string): string {
  return attrs.replace(new RegExp(`\\s${name}\\s*=\\s*"[^"]*"`, 'gi'), '');
}

/** Derive a sensible visible label for an empty anchor from its href. */
function fallbackAnchorText(href: string): string {
  if (href.startsWith('#')) return href.slice(1).replace(/-/g, ' ') || 'section';
  if (href.startsWith('/')) {
    const last = href.split('/').filter(Boolean).pop();
    return last ? last.replace(/-/g, ' ') : 'page';
  }
  try {
    const u = new URL(href);
    return u.hostname.replace(/^www\./, '') || href;
  } catch {
    return href;
  }
}

/** Normalise one anchor tag: fix internal/external links, fix empty anchor text. */
function normaliseAnchor(attrs: string, inner: string): string {
  const rawHref = getAttr(attrs, 'href');
  if (rawHref == null) return `<a${attrs}>${inner}</a>`;

  // Rewrite absolute radix.wiki links (http or https) to relative paths
  const href = rawHref.replace(/^https?:\/\/(?:www\.)?radix\.wiki(\/.*)?$/i, (_, path) => path || '/');
  const isInternal = href.startsWith('/') || href.startsWith('#');
  let cleanedAttrs = removeAttr(attrs, 'href');
  cleanedAttrs = removeAttr(cleanedAttrs, 'rel');
  cleanedAttrs = removeAttr(cleanedAttrs, 'target');

  // If the anchor has no visible text, synthesise a label from the href so search
  // engines and assistive tech aren't faced with an empty link.
  const visible = stripTags(inner);
  const safeInner = visible ? inner : fallbackAnchorText(href);

  if (isInternal) {
    return `<a href="${href}"${cleanedAttrs}>${safeInner}</a>`;
  }
  return `<a href="${href}"${cleanedAttrs} target="_blank" rel="noopener">${safeInner}</a>`;
}

/** Process HTML content for display: heading IDs, link normalization, alt attrs, external link attributes. */
export function processHtml(html: string): string {
  if (!html.trim()) return html;
  return html
    // Demote h1 in content to h2 (page title is the only h1)
    .replace(/<h1(\s[^>]*)?>([\s\S]*?)<\/h1>/gi, '<h2$1>$2</h2>')
    // Add IDs to headings for anchor links
    .replace(/<(h[2-4])([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, content) => {
      if (attrs.includes(' id=')) return match;
      const text = stripTags(content);
      const id = slugify(text);
      return id ? `<${tag}${attrs} id="${id}">${content}</${tag}>` : match;
    })
    // Add alt="" to <img> tags that don't have one (decorative fallback keeps crawlers happy)
    .replace(/<img\b([^>]*)>/gi, (match, attrs) => {
      if (/\salt\s*=/i.test(attrs)) return match;
      return `<img${attrs} alt="">`;
    })
    // Normalise every anchor including its inner text (attribute-order agnostic).
    // Note: this regex does not handle nested <a>, which is invalid HTML anyway.
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, attrs, inner) => normaliseAnchor(attrs, inner));
}

/** Apply processHtml to every content block recursively (for SSR normalisation). */
export function processBlocks(blocks: Block[]): Block[] {
  const mapAtomic = (b: AtomicBlock): AtomicBlock => {
    if (b.type === 'content' && typeof b.text === 'string') {
      return { ...b, text: processHtml(b.text) };
    }
    return b;
  };
  return blocks.map((block): Block => {
    if (block.type === 'content') return mapAtomic(block) as Block;
    if (block.type === 'infobox') return { ...block, blocks: block.blocks.map(mapAtomic) };
    if (block.type === 'columns') return { ...block, columns: block.columns.map(col => ({ ...col, blocks: col.blocks.map(mapAtomic) })) };
    return block;
  });
}
