// src/lib/html.ts — HTML post-processing for wiki content rendering

import { slugify } from '@/lib/utils';

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();

/** Process HTML content for display: heading IDs, link normalization, external link attributes. */
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
    // Convert absolute internal links to relative paths
    .replace(/<a\s+href="https?:\/\/(?:www\.)?radix\.wiki(\/[^"]*)"([^>]*)>/gi, '<a href="$1"$2>')
    // Remove nofollow/noopener from internal (relative) links
    .replace(/<a\s+href="(\/[^"]*)"([^>]*)>/gi, (match, href, rest) => {
      const cleaned = rest.replace(/\s*rel="[^"]*"/gi, '').replace(/\s*target="[^"]*"/gi, '');
      return `<a href="${href}"${cleaned}>`;
    })
    // Add target + rel to external links (noopener only, no noreferrer)
    .replace(/<a\s+href="(https?:\/\/[^"]+)"([^>]*)>/gi, (match, href, rest) => {
      if (rest.includes('target=')) {
        return match.replace(/rel="[^"]*"/gi, 'rel="noopener"');
      }
      return `<a href="${href}"${rest} target="_blank" rel="noopener">`;
    });
}
