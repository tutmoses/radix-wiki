// src/lib/content.ts — shared HTML-to-text extraction for LLM/MCP exports
import type { Block, AtomicBlock } from '@/types/blocks';

export function stripHtml(html: string): string {
  return html
    .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, ' $2 ($1) ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|h[1-6]|li|tr|th|td|div)>/gi, '\n')
    .replace(/<(?:li)>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const BANNER_LABELS: Record<string, string> = {
  stub: 'Stub', unsourced: 'Needs citations', outdated: 'May be outdated',
  promotional: 'Written like an advertisement', cleanup: 'Needs cleanup', coi: 'Conflict of interest',
};

function extractAtomicText(block: AtomicBlock): string {
  if (block.type === 'content') return stripHtml(block.text);
  if (block.type === 'codeTabs') return block.tabs.map(t => `[${t.label}]\n${t.code}`).join('\n');
  if (block.type === 'banner') return `[Notice: ${BANNER_LABELS[block.variant] ?? block.variant}]${block.text ? ' ' + stripHtml(block.text) : ''}`;
  if (block.type === 'references') return block.items.length ? `References:\n${block.items.map((it, i) => `${i + 1}. ${stripHtml(it.text)}${it.url ? ` (${it.url})` : ''}`).join('\n')}` : '';
  return '';
}

export function extractText(blocks: Block[]): string {
  return blocks.map(b => {
    if (b.type === 'content') return stripHtml(b.text);
    if (b.type === 'infobox') return b.blocks.map(extractAtomicText).filter(Boolean).join('\n');
    if (b.type === 'columns') return b.columns.map(col => col.blocks.map(extractAtomicText).filter(Boolean).join('\n')).join('\n');
    if (b.type === 'codeTabs') return b.tabs.map(t => `[${t.label}]\n${t.code}`).join('\n');
    if (b.type === 'banner' || b.type === 'references') return extractAtomicText(b);
    return '';
  }).filter(Boolean).join('\n\n');
}
