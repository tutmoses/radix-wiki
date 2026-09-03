// The brand + drawing kit lives in kit.mjs (shared with scripts/wir-figure.mjs).
// Only the durable NN-* builders and their org-chart-specific helpers live here.
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { BRAND, C, MONO, t, paras, card, sectionLabel, numChip, arrowR, frame, renderPngs } from './kit.mjs';

const ASSETS = dirname(fileURLToPath(import.meta.url));

// ============================ The Radix Engine =============================
// Layers + one-liners grounded in radix.wiki's own pages
// (contents/tech/core-protocols/{application,system,vm,kernel}-layer, radix-engine,
// cerberus-consensus-protocol, scrypto-programming-language).
function radixEngine() {
  const W = 920, H = 650, L = 48, R = W - L, w = R - L;
  let b = paras(L, 150, 'The Radix Engine is the execution environment for every Scrypto smart contract – purpose-built for DeFi, where tokens and NFTs are native assets rather than balances in a mapping.', 116, { size: 14, lh: 21, fill: C.text2 });
  b += sectionLabel(L, 206, 'FOUR LAYERS, TOP TO BOTTOM');
  const layers = [
    { n: 1, name: 'Application', tag: 'topmost', desc: 'Your Scrypto blueprints, packages, and components execute here.' },
    { n: 2, name: 'System', tag: '', desc: 'Objects, the resource model, and modules – Metadata · Royalty · Role Assignment.' },
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
  b += t(L + 20, cy + 47, 'Braided BFT – reaches agreement across only the shards each transaction touches.', { size: 13, w: 400, fill: C.text2 });
  return { W, H, title: 'The Radix Engine', tag: 'EXECUTION STACK', note: 'Written in Scrypto (Rust) · asset-oriented · Scrypto VM + Native VM.', body: b };
}


// ============================ The Developer Path ===========================
// The route through /developers, in the order the sections are meant to be read.
// Every box is a link on the web. The affordance is NOT stated inside the SVG:
// the same file renders as a social-card PNG, where nothing is clickable, so the
// claim lives in the figcaption instead.
// The figure is the page's navigation, not a picture of it,
// so it is embedded with `interactive: true` (which keeps the links reachable —
// see kit.figureBlock) and the labels are drawn in accent so they read as links.
// Counts and difficulty come from the guides' own metadata.difficulty; keep them
// in step when guides are added or moved.
function developerPath() {
  const W = 920, H = 680, L = 48, R = W - L, w = R - L;

  // An <a> whose only child is a <rect> has no text, and normaliseLinks replaces
  // a text-less anchor's contents with a label derived from its href — so the
  // link must always wrap the card's <text> too, never the box alone.
  const link = (href, inner) => `<a href="${href}">${inner}</a>`;
  const chevron = (x, y, col) =>
    `<path d="M${x},${y - 4} L${x + 4.5},${y} L${x},${y + 4}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  const pill = (xRight, y, label, col) => {
    const pw = label.length * 6.1 + 18;
    return `<rect x="${xRight - pw}" y="${y - 12}" width="${pw}" height="18" rx="9" fill="none" stroke="${col}" stroke-width="0.9"/>`
      + t(xRight - pw / 2, y + 1, label, { size: 10, w: 700, fill: col, font: MONO, anchor: 'middle', ls: '0.04em' });
  };

  let b = paras(L, 150, 'Only the first four sections are a sequence \u2014 each stage assumes the one above it. The last three are branches, taken when a project needs them.', 116, { size: 14, lh: 21, fill: C.text2 });

  b += sectionLabel(L, 210, 'THE CORE PATH \u2014 IN ORDER');

  const stages = [
    { n: 1, name: 'Getting Started', slug: 'getting-started', meta: '3 \u00b7 Beginner', col: C.getaway,
      desc: 'Install the toolchain, write a first blueprint, deploy to Stokenet and then mainnet.' },
    { n: 2, name: 'Scrypto', slug: 'scrypto', meta: '9 \u00b7 Beginner to Advanced', col: C.getaway,
      desc: 'Resources and NFTs, authorization and badges, testing, and the design patterns.' },
    { n: 3, name: 'Transactions', slug: 'transactions', meta: '5 \u00b7 Intermediate to Advanced', col: C.jupiter,
      desc: 'The manifest language, the transaction lifecycle, fees, addresses and entity types.' },
    { n: 4, name: 'Frontend', slug: 'frontend', meta: '4 \u00b7 Intermediate', col: C.jupiter,
      desc: 'The dApp Toolkit, the Gateway SDK, ROLA wallet login, and dApp verification.' },
  ];

  const y0 = 228, h = 60, gap = 12, chipX = L + 34, cardX = L + 56;
  // The spine runs behind the chips, so the four rows read as one ordered run
  // rather than four unrelated boxes.
  b += `<line x1="${chipX}" y1="${y0 + h / 2}" x2="${chipX}" y2="${y0 + 3 * (h + gap) + h / 2}" stroke="${C.hair}" stroke-width="1.5"/>`;
  stages.forEach((st, i) => {
    const y = y0 + i * (h + gap), mid = y + h / 2;
    let row = card(cardX, y, R - cardX, h, i === 0);
    row += `<rect x="${cardX}" y="${y}" width="3" height="${h}" fill="${st.col}"/>`;
    row += `<circle cx="${chipX}" cy="${mid}" r="14" fill="${C.bg}"/>`;
    row += numChip(chipX, mid, st.n, st.col);
    row += t(cardX + 20, y + 25, st.name, { size: 16, w: 700, fill: st.col });
    row += pill(R - 34, y + 23, st.meta, C.muted);
    row += t(cardX + 20, y + 45, st.desc, { size: 12.5, w: 400, fill: C.text2 });
    row += chevron(R - 22, mid, C.neut);
    b += link(`/developers/${st.slug}`, row);
  });

  const by = y0 + 4 * (h + gap) + 20;
  b += sectionLabel(L, by, 'THEN, AS THE PROJECT NEEDS IT');
  const branches = [
    { name: 'Infrastructure', slug: 'infrastructure', meta: '3 guides', desc: 'Run a node, use the public APIs, integrate off-ledger services.' },
    { name: 'AI Agents', slug: 'ai-agents', meta: '5 pages', desc: 'x402 payments, agent wallets, MCP servers, context packs.' },
    { name: 'Tools', slug: 'tools', meta: '4 pages', desc: 'Manifest builders, event webhooks, the community SDKs.' },
  ];
  const cw = Math.floor((w - 2 * 14) / 3), cy = by + 18, ch = 78;
  branches.forEach((br, i) => {
    const x = L + i * (cw + 14);
    let box = card(x, cy, cw, ch);
    box += t(x + 16, cy + 25, br.name, { size: 14.5, w: 700, fill: C.getaway });
    box += t(x + cw - 34, cy + 25, br.meta, { size: 10, w: 700, fill: C.muted, font: MONO, anchor: 'end', ls: '0.05em' });
    box += paras(x + 16, cy + 45, br.desc, 33, { size: 12, lh: 15, fill: C.text2 });
    box += chevron(x + cw - 22, cy + 21, C.neut);
    b += link(`/developers/${br.slug}`, box);
  });

  return {
    W, H, title: 'The Route to Mastery', tag: 'DEVELOPER PATH',
    note: '33 guides across seven sections \u00b7 start at Installing Scrypto',
    body: b,
  };
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
  let b = paras(L, 146, 'How Radix is organized: a UK not-for-profit foundation and its subsidiaries build and steward the network – while governance is now handing over to a community-owned DAO.', 118, { size: 14, lh: 20, fill: C.text2 });

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
  b += sectionLabel(L, 488, 'GOVERNANCE IN TRANSITION – 2026');
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
  b += t(L + 16, commY + 34, 'XRD holders elect the RAC and vote on proposals – 1 XRD = 1 vote, non-custodial balance snapshot.', { size: 12, w: 400, fill: C.text2 });
  // up-arrow: community elects RAC
  b += line(fc[1], commY, fc[1], flY + flH, C.xrd, { w: 1.4 }) + triUp(fc[1], flY + flH, C.xrd);
  b += t(fc[1] + 10, commY - 6, 'elects', { size: 9.5, w: 700, fill: C.muted, anchor: 'start' });

  return {
    W, H,
    title: 'Radix Organizational Structure',
    tag: 'ENTITIES & GOVERNANCE',
    note: 'Grounded in radix.wiki – Radix Foundation & RAC pages · the 2026 Foundation-to-DAO transition.',
    body: b,
  };
}

// ============================ render ========================================
const GRAPHICS = [
  { file: '01-radix-engine', build: radixEngine },
  { file: '02-org-structure', build: radixOrgChart },
  { file: '03-developer-path', build: developerPath },
];

await renderPngs(GRAPHICS.map((g) => {
  const { W, H, title, tag, note, body } = g.build();
  return { file: g.file, W, H, svg: frame(W, H, title, tag, note, body) };
}), ASSETS);
