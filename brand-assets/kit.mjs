// brand-assets/kit.mjs — radix.wiki's brand infographic toolkit.
//
// Brand-parameterized drawing kit (mirrors caper/brand-assets/generate-infographics.mjs —
// same kit, radix.wiki's tokens), extracted so every SVG producer draws from one source:
// generate-infographics.mjs (the durable NN-* suite) and scripts/wir-figure.mjs (the
// weekly Week in Review ledger figure). The color KEYS are shared vocabulary:
// getaway = primary accent, jupiter = secondary/warn, neutral = structure.
//
// Caper's copy of this kit is still inline in its generator; a kit edit here must be
// mirrored into caper/brand-assets/generate-infographics.mjs (Tier-2 shared structure).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pw from '../node_modules/playwright/index.js';

const { chromium } = pw;
const HERE = dirname(fileURLToPath(import.meta.url));
const LOGO_URI = fs.readFileSync(resolve(HERE, '.logo-data-uri.txt'), 'utf8').trim();

export const BRAND = {
  eyebrow: 'RADIX WIKI',
  domain: 'radix.wiki',
  // Inter is loaded by the live page; the PNG preview falls back to system-ui.
  sans: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Monaco, monospace",
  radius: 8,
  fonts: [],
  colors: {
    bg: '#393e50', getaway: '#ff9da0', jupiter: '#ffc599', neutral: '#52586e',
    text: '#ffffff', text2: '#e6e8f0', muted: '#c5c9d6', xrd: '#ccd1ff',
    border: '#6b7089', hair: '#5a6178', surf1: '#444a5e', surf2: '#4f5569',
    gTint: 'rgba(255,157,160,0.15)', xTint: 'rgba(204,209,255,0.14)', oTint: 'rgba(255,197,153,0.14)',
    neut: '#8b90a3',
  },
  logo: () => `<image href="${LOGO_URI}" x="48" y="40" width="44" height="44" preserveAspectRatio="xMidYMid meet"/>`,
};

export const C = BRAND.colors;
export const SANS = BRAND.sans;
export const MONO = BRAND.mono;
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function t(x, y, str, o = {}) {
  const { size = 13, w = 400, fill = C.text, font = SANS, anchor = 'start', ls = 0, raw = false } = o;
  const lsAttr = ls ? ` letter-spacing="${ls}"` : '';
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="${anchor}"${lsAttr}>${raw ? str : esc(str)}</text>`;
}
export function wrap(str, maxChars) {
  const words = str.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur ? cur + ' ' : '') + w;
  }
  if (cur) lines.push(cur);
  return lines;
}
export function paras(x, y, str, maxChars, o = {}) {
  const { size = 13, lh = 19, fill = C.text2, w = 400 } = o;
  return wrap(str, maxChars).map((ln, i) => t(x, y + i * lh, ln, { size, w, fill })).join('');
}
export function card(x, y, w, h, hero = false) {
  const stroke = hero ? C.getaway : C.hair;
  const fill = hero ? C.gTint : C.surf1;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${BRAND.radius}" fill="${fill}" stroke="${stroke}" stroke-width="${hero ? 1.25 : 0.75}"/>`;
}
export function badge(cx, cy, label, kind) {
  const map = { xrd: [C.xrd, C.xTint, 44], tok: [C.getaway, C.gTint, 58], sell: [C.jupiter, C.oTint, 52] };
  const [stroke, bg, w] = map[kind] || map.xrd;
  const h = 20;
  return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${BRAND.radius}" fill="${bg}" stroke="${stroke}" stroke-width="1"/>`
    + t(cx, cy + 3.5, label, { size: 10.5, w: 700, fill: stroke, font: MONO, anchor: 'middle', ls: '0.06em' });
}
export function sectionLabel(x, y, label) {
  return `<rect x="${x}" y="${y - 9}" width="7" height="7" fill="${C.getaway}"/>`
    + t(x + 16, y, label, { size: 12.5, w: 700, fill: C.text, ls: '0.1em' });
}
export function numChip(x, y, n, col) {
  return `<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="${col}" stroke-width="1.5"/>`
    + t(x, y + 4.5, String(n), { size: 13, w: 700, fill: col, anchor: 'middle', font: MONO });
}
export function arrowR(cx, cy, col = C.neut) {
  return `<path d="M${cx - 6},${cy - 7} L${cx + 5},${cy} L${cx - 6},${cy + 7}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
}
export function statMini(x, y, w, label, val, valCol = C.text) {
  return card(x, y, w, 54)
    + t(x + 14, y + 23, label, { size: 10, w: 700, fill: C.muted, ls: '0.1em' })
    + t(x + 14, y + 43, val, { size: 15, w: 700, fill: valCol, font: MONO });
}
export function frame(W, H, title, tag, note, body) {
  let g = `<rect width="${W}" height="${H}" fill="${C.bg}"/>`;
  g += BRAND.logo();
  g += t(104, 50, BRAND.eyebrow, { size: 11, w: 700, fill: C.getaway, ls: '0.16em' });
  g += t(104, 80, title, { size: 30, w: 700, fill: C.text, ls: '-0.01em' });
  if (tag) g += t(W - 48, 80, tag, { size: 12, w: 700, fill: C.muted, anchor: 'end', ls: '0.06em', font: MONO });
  g += `<line x1="48" y1="104" x2="${W - 48}" y2="104" stroke="${C.hair}" stroke-width="1"/>`;
  g += body;
  const fy = H - 40;
  g += `<line x1="48" y1="${fy}" x2="${W - 48}" y2="${fy}" stroke="${C.hair}" stroke-width="0.5"/>`;
  g += t(48, fy + 22, note, { size: 12, w: 500, fill: C.muted });
  g += t(W - 48, fy + 22, BRAND.domain, { size: 12, w: 700, fill: C.getaway, anchor: 'end' });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${SANS}">${g}</svg>`;
}

/** Wrap a kit SVG as wiki-embeddable figure HTML: responsive, accessible, keyed for
 *  idempotent replacement on data-graphic="<marker>". The canonical embed transform —
 *  use this rather than re-deriving the strip/wrap in each script. */
export function figureBlock(svgRaw, { marker, label, caption, interactive = false }) {
  const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  // `role="img"` collapses the graphic to one node for assistive tech, which is
  // right for a diagram and wrong for one whose boxes are links — the links stop
  // being reachable. An interactive figure is a labelled group instead.
  const role = interactive ? 'group' : 'img';
  const svg = svgRaw.replace(/<svg\b[^>]*>/, (tag) =>
    tag
      .replace(/ width="\d+" height="\d+"/, '')
      .replace(/>$/, ` preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block" role="${role}" aria-label="${escAttr(label)}">`));
  return `<figure data-graphic="${marker}" style="max-width:760px;margin:1.5em auto;border:1px solid ${C.hair};border-radius:8px;overflow:hidden;background:${C.bg}"><div style="padding:8px">${svg}</div><figcaption style="padding:10px 14px;border-top:1px solid ${C.hair};font-size:12px;color:${C.muted}">${esc(caption)}</figcaption></figure>`;
}

/** Write each item's SVG and a 2x PNG next to it. items: [{ file, W, H, svg }]. */
export async function renderPngs(items, outDir) {
  const faces = BRAND.fonts.map((f) =>
    `@font-face{font-family:${f.family};font-weight:${f.weight};font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(f.file).toString('base64')}) format('woff2')}`).join('');
  const browser = await chromium.launch();
  try {
    for (const it of items) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(resolve(outDir, `${it.file}.svg`), it.svg);
      const html = `<!doctype html><meta charset="utf-8"><style>${faces}html,body{margin:0;background:${C.bg}}#c{width:${it.W}px;height:${it.H}px}</style><div id="c">${it.svg}</div>`;
      const page = await browser.newPage({ viewport: { width: it.W, height: it.H }, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.locator('#c').screenshot({ path: resolve(outDir, `${it.file}.png`) });
      await page.close();
      console.log('built', it.file, `${it.W}x${it.H}`);
    }
  } finally {
    await browser.close();
  }
}
