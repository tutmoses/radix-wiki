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

/** Normalise one anchor tag: fix internal/external links, strip nofollow from internal. */
function normaliseAnchor(attrs: string): string {
  const rawHref = getAttr(attrs, 'href');
  if (rawHref == null) return `<a${attrs}>`;

  // Rewrite absolute radix.wiki links (http or https) to relative paths
  let href = rawHref.replace(/^https?:\/\/(?:www\.)?radix\.wiki(\/.*)?$/i, (_, path) => path || '/');
  const isInternal = href.startsWith('/') || href.startsWith('#');
  let cleanedAttrs = removeAttr(attrs, 'href');

  if (isInternal) {
    // Internal: strip any nofollow/noreferrer and drop target="_blank" (stay in tab)
    cleanedAttrs = removeAttr(cleanedAttrs, 'rel');
    cleanedAttrs = removeAttr(cleanedAttrs, 'target');
    return `<a href="${href}"${cleanedAttrs}>`;
  }

  // External: ensure target="_blank" and rel="noopener" (strip any nofollow)
  cleanedAttrs = removeAttr(cleanedAttrs, 'rel');
  cleanedAttrs = removeAttr(cleanedAttrs, 'target');
  return `<a href="${href}"${cleanedAttrs} target="_blank" rel="noopener">`;
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
    // Normalise every anchor (attribute-order agnostic)
    .replace(/<a\b([^>]*)>/gi, (_match, attrs) => normaliseAnchor(attrs));
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
