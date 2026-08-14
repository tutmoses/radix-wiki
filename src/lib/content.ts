// src/lib/content.ts — shared HTML-to-text extraction for LLM/MCP exports

import type { Block, AtomicBlock } from '@/types/blocks';

// The editor stores typographic punctuation as named entities, so text exports
// carried raw `&mdash;` / `&ldquo;` / `&rsquo;` an agent had to read as literal
// ampersand-soup. Numeric forms decode generically; the named table covers what
// the corpus actually uses (punctuation, arrows, maths, accented Latin, Greek)
// rather than attempting the full HTML5 list. Shared by extractText, the
// markdown twin (src/lib/markdown.ts), and snippet extraction (src/lib/utils.ts).
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', middot: '·', bull: '•', sect: '§', para: '¶', dagger: '†',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', laquo: '«', raquo: '»',
  larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔',
  times: '×', divide: '÷', minus: '−', plusmn: '±', ne: '≠', le: '≤', ge: '≥',
  asymp: '≈', radic: '√', infin: '∞', sum: '∑', prod: '∏', int: '∫', deg: '°', permil: '‰',
  sup2: '²', sup3: '³', frac12: '½', frac14: '¼', frac34: '¾',
  euro: '€', pound: '£', yen: '¥', cent: '¢', copy: '©', reg: '®', trade: '™',
  eacute: 'é', egrave: 'è', ecirc: 'ê', aacute: 'á', agrave: 'à', acirc: 'â', aring: 'å',
  auml: 'ä', ouml: 'ö', uuml: 'ü', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ',
  ccedil: 'ç', oslash: 'ø', szlig: 'ß', aelig: 'æ',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ',
  mu: 'μ', nu: 'ν', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', omega: 'ω',
  Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', Lambda: 'Λ', Phi: 'Φ', Pi: 'Π',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d{1,7});/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]{1,9});/g, (m, name: string) => NAMED_ENTITIES[name] ?? m);
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, ' $2 ($1) ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|h[1-6]|li|tr|th|td|div)>/gi, '\n')
      .replace(/<(?:li)>/gi, '- ')
      .replace(/<[^>]+>/g, ''),
  )
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
