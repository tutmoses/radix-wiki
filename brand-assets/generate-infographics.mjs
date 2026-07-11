import fs from 'node:fs';
import pw from '/Users/libertant/Desktop/GitHub/radix-wiki/node_modules/playwright/index.js';
const { chromium } = pw;

const REPO = '/Users/libertant/Desktop/GitHub/radix-wiki';

// ============================ brand ========================================
// Brand-parameterized toolkit (mirrors caper/brand-assets/generate-infographics.mjs —
// same kit, radix.wiki's tokens). The color KEYS are shared vocabulary:
// getaway = primary accent, jupiter = secondary/warn, neutral = structure.
const LOGO_URI = fs.readFileSync(`${REPO}/brand-assets/.logo-data-uri.txt`, 'utf8').trim();
const BRAND = {
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

// ============================ shared toolkit ================================
const C = BRAND.colors;
const SANS = BRAND.sans;
const MONO = BRAND.mono;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function t(x, y, str, o = {}) {
  const { size = 13, w = 400, fill = C.text, font = SANS, anchor = 'start', ls = 0, raw = false } = o;
  const lsAttr = ls ? ` letter-spacing="${ls}"` : '';
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="${anchor}"${lsAttr}>${raw ? str : esc(str)}</text>`;
}
function wrap(str, maxChars) {
  const words = str.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur ? cur + ' ' : '') + w;
  }
  if (cur) lines.push(cur);
  return lines;
}
function paras(x, y, str, maxChars, o = {}) {
  const { size = 13, lh = 19, fill = C.text2, w = 400 } = o;
  return wrap(str, maxChars).map((ln, i) => t(x, y + i * lh, ln, { size, w, fill })).join('');
}
function card(x, y, w, h, hero = false) {
  const stroke = hero ? C.getaway : C.hair;
  const fill = hero ? C.gTint : C.surf1;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${BRAND.radius}" fill="${fill}" stroke="${stroke}" stroke-width="${hero ? 1.25 : 0.75}"/>`;
}
function badge(cx, cy, label, kind) {
  const map = { xrd: [C.xrd, C.xTint, 44], tok: [C.getaway, C.gTint, 58], sell: [C.jupiter, C.oTint, 52] };
  const [stroke, bg, w] = map[kind] || map.xrd;
  const h = 20;
  return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${BRAND.radius}" fill="${bg}" stroke="${stroke}" stroke-width="1"/>`
    + t(cx, cy + 3.5, label, { size: 10.5, w: 700, fill: stroke, font: MONO, anchor: 'middle', ls: '0.06em' });
}
function sectionLabel(x, y, label) {
  return `<rect x="${x}" y="${y - 9}" width="7" height="7" fill="${C.getaway}"/>`
    + t(x + 16, y, label, { size: 12.5, w: 700, fill: C.text, ls: '0.1em' });
}
function numChip(x, y, n, col) {
  return `<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="${col}" stroke-width="1.5"/>`
    + t(x, y + 4.5, String(n), { size: 13, w: 700, fill: col, anchor: 'middle', font: MONO });
}
function arrowR(cx, cy, col = C.neut) {
  return `<path d="M${cx - 6},${cy - 7} L${cx + 5},${cy} L${cx - 6},${cy + 7}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function statMini(x, y, w, label, val, valCol = C.text) {
  return card(x, y, w, 54)
    + t(x + 14, y + 23, label, { size: 10, w: 700, fill: C.muted, ls: '0.1em' })
    + t(x + 14, y + 43, val, { size: 15, w: 700, fill: valCol, font: MONO });
}
function frame(W, H, title, tag, note, body) {
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

// ============================ The Radix Engine =============================
// Layers + one-liners grounded in radix.wiki's own pages
// (contents/tech/core-protocols/{application,system,vm,kernel}-layer, radix-engine,
// cerberus-consensus-protocol, scrypto-programming-language).
function radixEngine() {
  const W = 920, H = 650, L = 48, R = W - L, w = R - L;
  let b = paras(L, 150, 'The Radix Engine is the execution environment for every Scrypto smart contract — purpose-built for DeFi, where tokens and NFTs are native assets rather than balances in a mapping.', 116, { size: 14, lh: 21, fill: C.text2 });
  b += sectionLabel(L, 206, 'FOUR LAYERS, TOP TO BOTTOM');
  const layers = [
    { n: 1, name: 'Application', tag: 'topmost', desc: 'Your Scrypto blueprints, packages, and components execute here.' },
    { n: 2, name: 'System', tag: '', desc: 'Objects, the resource model, and modules — Metadata · Royalty · Role Assignment.' },
    { n: 3, name: 'VM', tag: '', desc: 'Runs blueprint code in two VMs: Scrypto (WebAssembly) and Native.' },
    { n: 4, name: 'Kernel', tag: 'lowest', desc: 'Substates, actors, ownership transfer, and execution costing.' },
  ];
  const y0 = 224, h = 62, gap = 10;
  layers.forEach((ly, i) => {
    const y = y0 + i * (h + gap);
    b += card(L, y, w, h);
    b += `<rect x="${L}" y="${y}" width="3" height="${h}" fill="${C.getaway}"/>`;
    b += numChip(L + 34, y + h / 2, ly.n, C.getaway);
    b += t(L + 62, y + 27, ly.name, { size: 16, w: 700, fill: C.text });
    b += t(L + 62, y + 47, ly.desc, { size: 13, w: 400, fill: C.text2 });
    if (ly.tag) b += t(R - 16, y + 27, ly.tag, { size: 10.5, w: 700, fill: C.muted, anchor: 'end', ls: '0.08em' });
  });
  const kb = y0 + layers.length * (h + gap);
  b += t(W / 2, kb + 2, 'runs on', { size: 10.5, w: 700, fill: C.muted, anchor: 'middle', ls: '0.1em' });
  b += `<path d="M${W / 2 - 6},${kb + 10} L${W / 2},${kb + 18} L${W / 2 + 6},${kb + 10}" fill="none" stroke="${C.muted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  const cy = kb + 26, ch = 60;
  b += card(L, cy, w, ch, true);
  b += t(L + 20, cy + 27, 'Cerberus consensus', { size: 16, w: 700, fill: C.getaway });
  b += t(L + 20, cy + 47, 'Braided BFT — reaches agreement across only the shards each transaction touches.', { size: 13, w: 400, fill: C.text2 });
  return { W, H, title: 'The Radix Engine', tag: 'EXECUTION STACK', note: 'Written in Scrypto (Rust) · asset-oriented · Scrypto VM + Native VM.', body: b };
}

// ============================ Radix Organizational Structure ===============
// Boxes-and-connectors org chart grounded in radix.wiki's own pages
// (ecosystem/radix-foundation, ecosystem/rdx-works, ecosystem/radix-accountability-council,
// ideas/radix-network-dao-charter) and cross-checked against the Radix blog/knowledge base.
// Org-chart-specific drawing helpers live here (not in the shared kit) so caper's copy stays identical.
function line(x1, y1, x2, y2, col = C.hair, o = {}) {
  const { w = 1, dash = '' } = o;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}
function triDown(cx, cy, col) { return `<path d="M${cx - 5},${cy - 6} L${cx + 5},${cy - 6} L${cx},${cy} Z" fill="${col}"/>`; }
function triUp(cx, cy, col) { return `<path d="M${cx - 5},${cy + 6} L${cx + 5},${cy + 6} L${cx},${cy} Z" fill="${col}"/>`; }
function chip(x, y, label, col) {
  const w = label.length * 6.4 + 16;
  return `<rect x="${x}" y="${y - 12}" width="${w}" height="16" rx="4" fill="none" stroke="${col}" stroke-width="0.9"/>`
    + t(x + w / 2, y - 0.5, label, { size: 9.5, w: 700, fill: col, font: MONO, anchor: 'middle', ls: '0.05em' });
}
// A titled node box: accent left-bar, wrapped title/desc lines, bottom-anchored tag chip.
// `titleSlot` reserves N title rows so sibling boxes align their descriptions even when
// titles differ in line count. The chip is bottom-anchored, so h just needs to clear the text.
function node(x, y, w, h, o) {
  const { titleLines, descLines = [], tag, accent = C.hair, fill = C.surf1, dash = '', chipCol = C.muted, titleCol = C.text, titleSlot } = o;
  const slots = titleSlot || titleLines.length;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${BRAND.radius}" fill="${fill}" stroke="${accent}" stroke-width="${dash ? 1 : 0.9}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  if (!dash) s += `<rect x="${x}" y="${y}" width="3" height="${h}" fill="${accent}"/>`;
  titleLines.forEach((ln, i) => { s += t(x + 15, y + 24 + i * 15, ln, { size: 12.5, w: 700, fill: titleCol }); });
  const descY0 = y + 24 + slots * 15 + 4;
  descLines.forEach((ln, i) => { s += t(x + 15, descY0 + i * 15, ln, { size: 11, w: 400, fill: C.muted }); });
  if (tag) s += chip(x + 15, y + h - 12, tag, chipCol);
  return s;
}

function radixOrgChart() {
  const W = 920, H = 716, L = 48, R = W - L;
  let b = paras(L, 146, 'How Radix is organized: a UK not-for-profit foundation and its subsidiaries build and steward the network — while governance is now handing over to a community-owned DAO.', 118, { size: 14, lh: 20, fill: C.text2 });

  // --- Section A: the Foundation group -------------------------------------
  b += sectionLabel(L, 198, 'THE FOUNDATION GROUP');
  // legend (line semantics)
  b += line(628, 194, 650, 194, C.getaway, { w: 2 }) + t(656, 198, 'owns', { size: 10, w: 600, fill: C.muted });
  b += line(704, 194, 726, 194, C.jupiter, { w: 2, dash: '4 3' }) + t(732, 198, 'funds / forming', { size: 10, w: 600, fill: C.muted });

  // top tier: Foundation (owner) + RDX Works (funded, separate)
  const fdX = 196, fdW = 300, fdY = 212, topH = 92, fdCx = fdX + fdW / 2; // 346
  b += node(fdX, fdY, fdW, topH, {
    titleLines: ['Radix Foundation Ltd'],
    descLines: ['UK not-for-profit · limited by', 'guarantee · no shareholders'],
    accent: C.getaway, fill: C.gTint, chipCol: C.getaway, tag: 'HOLDING CO',
  });
  const rwX = 576, rwW = 296; // center 724
  b += node(rwX, fdY, rwW, topH, {
    titleLines: ['RDX Works Ltd'],
    descLines: ['Core protocol developer; fka', 'Radix DLT (2017), renamed 2021'],
    accent: C.jupiter, fill: C.oTint, dash: '4 3', chipCol: C.jupiter, tag: 'SEPARATE COMPANY',
  });
  // dashed funding link Foundation -> RDX Works
  const linkY = fdY + topH / 2;
  b += line(fdX + fdW, linkY, rwX, linkY, C.jupiter, { w: 1.4, dash: '4 3' });
  b += `<path d="M${rwX - 9},${linkY - 5} L${rwX},${linkY} L${rwX - 9},${linkY + 5}" fill="none" stroke="${C.jupiter}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  b += t((fdX + fdW + rwX) / 2, linkY - 8, 'grant funding', { size: 9.5, w: 700, fill: C.muted, anchor: 'middle', ls: '0.04em' });

  // ownership bus down to four subsidiaries
  const subY = 338, subH = 100, gap = 16, subW = (R - L - 3 * gap) / 4; // 194
  const cols = [0, 1, 2, 3].map((i) => L + i * (subW + gap));
  const centers = cols.map((x) => x + subW / 2); // 145,355,565,775
  const busY = 320;
  b += line(fdCx, fdY + topH, fdCx, busY, C.getaway, { w: 1.2 });
  b += line(centers[0], busY, centers[3], busY, C.getaway, { w: 1.2 });
  centers.forEach((cx) => { b += line(cx, busY, cx, subY, C.getaway, { w: 1.2 }) + triDown(cx, subY, C.getaway); });
  b += t(fdCx, busY - 7, 'wholly-owned subsidiaries', { size: 9.5, w: 700, fill: C.muted, anchor: 'middle', ls: '0.06em' });

  const subs = [
    { titleLines: ['Radix Tokens', '(Jersey) Ltd'], titleSlot: 2, descLines: ['Issues & manages XRD;', 'JFSC-regulated treasury'], tag: 'TOKENS', accent: C.xrd, chipCol: C.xrd, fill: C.xTint },
    { titleLines: ['Radix Publishing Ltd'], titleSlot: 2, descLines: ['Canonical open-source', 'code, GitHub & comms'], tag: 'CODE / COMMS' },
    { titleLines: ['Archetype Ltd'], titleSlot: 2, descLines: ['Holds non-open-source', 'intellectual property'], tag: 'IP' },
    { titleLines: ['Exosphere Ltd'], titleSlot: 2, descLines: ['Holding co; formerly', 'Radix Ecosystem Holding'], tag: 'HOLDING' },
  ];
  subs.forEach((s, i) => { b += node(cols[i], subY, subW, subH, s); });

  // --- divider -------------------------------------------------------------
  b += line(L, 462, R, 462, C.hair, { w: 0.5 });

  // --- Section B: governance in transition ---------------------------------
  b += sectionLabel(L, 488, 'GOVERNANCE IN TRANSITION — 2026');
  const flY = 506, flH = 92, aGap = 58, flW = (R - L - 2 * aGap) / 3; // 236
  const fx = [0, 1, 2].map((i) => L + i * (flW + aGap)); // 48, 342, 636
  const fc = fx.map((x) => x + flW / 2); // 166, 460, 754
  b += node(fx[0], flY, flW, flH, {
    titleLines: ['Radix Foundation'], descLines: ['Entering maintenance mode', '(2026); pre-funds core infra'], tag: 'WINDING DOWN',
  });
  b += node(fx[1], flY, flW, flH, {
    titleLines: ['Radix Accountability Council'], descLines: ['5 community-elected;', 'multi-sig steward · Feb 2026'], tag: 'BRIDGE BODY (RAC)', accent: C.getaway, fill: C.gTint, chipCol: C.getaway,
  });
  b += node(fx[2], flY, flW, flH, {
    titleLines: ['Radix DLT DAO (RDD)'], descLines: ['Community-owned; legal', 'entity forming · gets treasury'], tag: 'FUTURE OWNER', dash: '4 3', accent: C.getaway, fill: C.surf1, chipCol: C.muted,
  });
  // arrows between flow stages
  [[fx[0] + flW, fx[1], 'hands over'], [fx[1] + flW, fx[2], 'forms']].forEach(([x1, x2, lab]) => {
    const mid = (x1 + x2) / 2;
    b += arrowR(mid + 6, flY + flH / 2, C.neut);
    b += line(x1 + 4, flY + flH / 2, mid, flY + flH / 2, C.neut, { w: 1.4 });
    b += t(mid, flY - 6, lab, { size: 9.5, w: 700, fill: C.muted, anchor: 'middle' });
  });

  // community strip feeding the RAC
  const commY = 616, commH = 42;
  b += card(L, commY, R - L, commH);
  b += `<rect x="${L}" y="${commY}" width="3" height="${commH}" fill="${C.xrd}"/>`;
  b += t(L + 16, commY + 18, 'COMMUNITY', { size: 10, w: 700, fill: C.xrd, ls: '0.1em' });
  b += t(L + 16, commY + 34, 'XRD holders elect the RAC and vote on proposals — 1 XRD = 1 vote, non-custodial balance snapshot.', { size: 12, w: 400, fill: C.text2 });
  // up-arrow: community elects RAC
  b += line(fc[1], commY, fc[1], flY + flH, C.xrd, { w: 1.4 }) + triUp(fc[1], flY + flH, C.xrd);
  b += t(fc[1] + 10, commY - 6, 'elects', { size: 9.5, w: 700, fill: C.muted, anchor: 'start' });

  return {
    W, H,
    title: 'Radix Organizational Structure',
    tag: 'ENTITIES & GOVERNANCE',
    note: 'Grounded in radix.wiki — Radix Foundation & RAC pages · the 2026 Foundation-to-DAO transition.',
    body: b,
  };
}

// ============================ render ========================================
const GRAPHICS = [
  { file: '01-radix-engine', build: radixEngine },
  { file: '02-org-structure', build: radixOrgChart },
];

const faces = BRAND.fonts.map((f) =>
  `@font-face{font-family:${f.family};font-weight:${f.weight};font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(f.file).toString('base64')}) format('woff2')}`).join('');

const browser = await chromium.launch();
for (const g of GRAPHICS) {
  const { W, H, title, tag, note, body } = g.build();
  const svg = frame(W, H, title, tag, note, body);
  fs.writeFileSync(`${REPO}/brand-assets/${g.file}.svg`, svg);
  const html = `<!doctype html><meta charset="utf-8"><style>${faces}html,body{margin:0;background:${C.bg}}#c{width:${W}px;height:${H}px}</style><div id="c">${svg}</div>`;
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#c').screenshot({ path: `${REPO}/brand-assets/${g.file}.png` });
  await page.close();
  console.log('built', g.file, `${W}x${H}`);
}
await browser.close();
