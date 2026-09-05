// scripts/wir-figure.mjs — the Week in Review's weekly ledger figure.
//
// Renders "The Week on the Ledger" as an on-brand SVG from the snapshot series that
// network-snapshot.mjs keeps (pages.metadata.state on contents/tech/operations/
// network-weekly), then embeds it into that week's recap as a responsive <figure>
// block. The figure is derived entirely from stored readings — it never invents a
// comparison the state cannot support, and it grows a series strip once two
// comparable weeks exist.
//
//   node scripts/wir-figure.mjs render [--week YYYY-MM-DD]   # SVG + 2x PNG + block html
//   node scripts/wir-figure.mjs embed <slug> [--dry-run]     # insert/replace in the recap
//
// render writes brand-assets/wir/wir-<week>.{svg,png,block.html}; the PNG doubles as
// the announcement tweet's media card. embed is idempotent (keyed on
// data-graphic="wir-ledger") and safe to re-run after a re-render.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config } from 'dotenv';
import {
  isLockedPage, argOf, fmt as fmtOr, compact as compactOr, delta, withClient, embedFigure,
} from './seed-utils.mjs';
import { C, MONO, t, wrap, paras, card, sectionLabel, frame, figureBlock, renderPngs } from '../brand-assets/kit.mjs';

config({ path: new URL('../.env', import.meta.url) });

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(REPO, 'brand-assets/wir');
const SNAP_TAG = 'contents/tech/operations';
const SNAP_SLUG = 'network-weekly';
const MARKER = 'wir-ledger';
const EN = '–';

const [mode, ...rest] = process.argv.slice(2);
const DRY = process.argv.includes('--dry-run');

// A missing reading leaves the figure blank: the dash the prose tools print would
// read as a value inside a stat card.
const fmt = (n, digits) => fmtOr(n, digits, '');
const compact = (n) => compactOr(n, '');
const pct = (f) => {
  const p = f * 100;
  return `${Number.isInteger(p) ? p : p.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`;
};
/** A signed magnitude, for a card whose value is itself a change. */
const signed = (n) => (n == null || !isFinite(n) ? '' : `${n > 0 ? '+' : '−'}${compact(Math.abs(n))}`);

/**
 * The largest week-over-week stake move by a single validator, from the stored top-25.
 *
 * The active set is capped at 100 and its membership barely moves — it was the same 100
 * validators and the same 188 registrations across 16 and 23 August 2026 — so a count of
 * it publishes a constant with "no change" written beside it. The stake inside the set is
 * what actually moves, and the biggest mover is usually the week's story.
 */
function biggestStakeMove(snap, prior, gapDays) {
  if (!prior?.top25?.length || !snap?.top25?.length || gapDays > 10) return null;
  const was = new Map(prior.top25.map((r) => [r[0], r[1]]));
  let best = null;
  for (const [address, stake] of snap.top25) {
    if (!was.has(address)) continue;
    const diff = stake - was.get(address);
    if (!best || Math.abs(diff) > Math.abs(best.diff)) best = { address, diff };
  }
  return best && best.diff !== 0 ? best : null;
}

// ---------------------------------------------------------------- the figure

function statCard(x, y, w, label, value, wow, sub) {
  let s = card(x, y, w, 78);
  s += t(x + 14, y + 23, label, { size: 10, w: 700, fill: C.muted, ls: '0.1em' });
  s += t(x + 14, y + 49, value, { size: 19, w: 700, fill: C.text, font: MONO });
  // A stable metric reads as stable by silence; only a real change earns a chip.
  if (wow && wow !== 'no change') s += t(x + w - 14, y + 49, wow, { size: 11.5, w: 700, fill: C.getaway, font: MONO, anchor: 'end' });
  s += t(x + 14, y + 67, sub, { size: 11, w: 400, fill: C.muted });
  return s;
}

/** Build the figure for one snapshot (with an optional comparable prior + series). */
function wirFigure(snap, prior, series, dev, devPrior) {
  const W = 920, L = 48, R = W - 48, w = R - L;
  const gapDays = prior ? Math.round((new Date(snap.week) - new Date(prior.week)) / 86400000) : 0;
  const d = (now, was, o = {}) => delta(now, was, { ...o, gapDays });
  const oci = snap.ociswap || {};
  let b = '';

  // ---- stat cards
  const gap = 14, cw = (w - 3 * gap) / 4, y0 = 134;
  const supplyShare = snap.xrdSupply ? `${((snap.totalStake / snap.xrdSupply) * 100).toFixed(1)}% of all XRD` : '';
  b += statCard(L, y0, cw, 'STAKED XRD', compact(snap.totalStake),
    d(snap.totalStake, prior?.totalStake), supplyShare);
  // Not a validator count: the active set is capped at 100, so that card printed a constant.
  const move = biggestStakeMove(snap, prior, gapDays);
  const netMove = prior ? snap.totalStake - prior.totalStake : null;
  b += move
    ? statCard(L + cw + gap, y0, cw, 'BIGGEST STAKE MOVE', `${signed(move.diff)} XRD`, '',
      netMove ? `of ${signed(netMove)} network-wide` : 'by a single validator')
    : statCard(L + cw + gap, y0, cw, 'REGISTERED VALIDATORS', `${snap.registered}`, '',
      `${snap.active} of them in the active set`);
  b += statCard(L + 2 * (cw + gap), y0, cw, 'A THIRD OF STAKE', `${snap.nakamoto} validators`,
    d(snap.nakamoto, prior?.nakamoto, { percent: false }), `top 10 hold ${snap.top10Share}%`);
  b += statCard(L + 3 * (cw + gap), y0, cw, 'OCISWAP 7D VOLUME', `${compact(oci.volume7dXrd)} XRD`,
    d(oci.volume7dXrd, prior?.ociswap?.volume7dXrd), `${fmt(oci.swaps7d)} swaps`);

  // ---- two panels: stake concentration | fees in motion
  const yB = y0 + 78 + 38;
  const lw = 470, rx = L + lw + 30, rw = w - lw - 30;

  const feeText = `${fmt(snap.feeDivergentCount)} validators charge a fee different from the one stored in their substate ${EN} ${fmt(snap.feeDivergentActiveCount)} of them active, with ${compact(snap.feeDivergentActiveStake)} XRD staked.`;
  const pend = (snap.pendingFeeChanges || []).slice(0, 3);
  const feeLines = wrap(feeText, 44).length;
  const rightH = 24 + feeLines * 18 + 10 + (pend.length ? pend.length * 46 : 24);

  b += sectionLabel(L, yB, 'STAKE CONCENTRATION');
  const bars = (snap.top25 || []).slice(0, 12).map((v) => v[1]);
  let leftH = 0;
  if (bars.length) {
    // Balance the columns: the chart absorbs the height the fee cards occupy.
    const chH = Math.min(160, Math.max(104, rightH - 64));
    const chY = yB + 18, bw = (lw - 11 * 6) / 12, max = Math.max(...bars);
    bars.forEach((stake, i) => {
      const h = Math.max(6, (stake / max) * chH);
      const x = L + i * (bw + 6), y = chY + chH - h;
      const third = i < snap.nakamoto;
      b += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="3" fill="${third ? C.gTint : C.surf2}" stroke="${third ? C.getaway : C.hair}" stroke-width="1"/>`;
    });
    b += t(L, chY + chH + 22, `The largest ${snap.nakamoto} validators together hold a third of all staked XRD.`, { size: 11.5, fill: C.text2 });
    b += t(L, chY + chH + 40, `Largest ${compact(bars[0])} XRD ${EN} twelfth ${compact(bars[11] ?? bars[bars.length - 1])} XRD.`, { size: 11, fill: C.muted });
    leftH = 18 + chH + 46;
  } else {
    b += paras(L, yB + 26, `${snap.nakamoto} validators hold a third of all staked XRD; the top 10 hold ${snap.top10Share}%. Per-validator stakes were not kept for this week.`, 58, { size: 12.5, lh: 19 });
    leftH = 26 + 3 * 19;
  }

  b += sectionLabel(rx, yB, 'FEES IN MOTION');
  b += paras(rx, yB + 24, feeText, 44, { size: 12, lh: 18 });
  let py = yB + 24 + feeLines * 18 + 10;
  if (pend.length) {
    pend.forEach((p) => {
      b += card(rx, py, rw, 40);
      b += t(rx + 12, py + 17, p.name, { size: 11.5, w: 700, fill: C.text });
      b += t(rx + 12, py + 32, `${pct(p.currentFee)} → ${pct(p.fee)} at epoch ${fmt(p.epoch)} · ${compact(p.stake)} XRD staked`, { size: 10.5, fill: C.jupiter, font: MONO });
      py += 46;
    });
  } else {
    b += t(rx, py + 8, 'No fee changes queued on the ledger.', { size: 11.5, fill: C.muted });
    py += 24;
  }
  const yBEnd = Math.max(yB + leftH, py);

  // ---- series strip, only once there are two comparable readings
  let yC = yBEnd + 12;
  const comparable = series.length >= 2;
  if (comparable) {
    yC += 24;
    b += sectionLabel(L, yC, 'THE SERIES SO FAR');
    const rows = [
      ['Staked XRD', series.map((s) => s.totalStake), C.getaway, C.gTint],
      ['Ociswap 7d volume', series.map((s) => s.ociswap?.volume7dXrd), C.xrd, C.xTint],
    ];
    let ry = yC + 20;
    for (const [label, vals, stroke, fill] of rows) {
      const clean = vals.map((v) => (isFinite(v) ? v : 0));
      // Min-max scaled: the strip shows the trend, the numbers live in the cards above.
      const max = Math.max(...clean), min = Math.min(...clean), span = max - min || 1;
      b += t(L, ry + 15, label, { size: 11, w: 600, fill: C.text2 });
      const x0 = L + 170, bw = Math.min(42, (w - 170 - 90 - (clean.length - 1) * 5) / clean.length);
      clean.forEach((v, i) => {
        const h = 4 + ((v - min) / span) * 16;
        b += `<rect x="${x0 + i * (bw + 5)}" y="${ry + 19 - h}" width="${bw}" height="${h}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
      });
      b += t(x0 + clean.length * (bw + 5) + 8, ry + 15, compact(clean[clean.length - 1]), { size: 11, w: 700, fill: stroke, font: MONO });
      ry += 34;
    }
    b += t(L + 170, ry + 2, `${series[0].week} → ${series[series.length - 1].week}, one reading per week`, { size: 9.5, fill: C.muted });
    yC = ry + 12;
  }

  // ---- the repositories, when capture-dev has a reading for this week
  if (dev) {
    yC += 26;
    b += sectionLabel(L, yC, 'THE WEEK IN THE REPOSITORIES');
    const dy = yC + 18;
    const dcw = (w - 3 * gap) / 4;
    const dd = (now, was) => (devPrior && was ? d(now, was) : '');
    b += statCard(L, dy, dcw, 'COMMITS', fmt(dev.commits), dd(dev.commits, devPrior?.commits),
      `${dev.contributors} contributor${dev.contributors === 1 ? '' : 's'}`);
    // Line totals come from a sample of the week's commits, so they are a floor.
    b += statCard(L + dcw + gap, dy, dcw, 'LINES CHANGED',
      `${dev.partial ? '≥' : ''}${compact(dev.additions + dev.deletions)}`, '',
      `+${compact(dev.additions)} / -${compact(dev.deletions)}`);
    const busiest = Object.values(dev.repos || {}).length
      ? [...dev.repos].filter((r) => !r.error).sort((a2, b2) => b2.commits - a2.commits)[0]
      : null;
    b += statCard(L + 2 * (dcw + gap), dy, dcw, 'BUSIEST REPOSITORY',
      busiest ? busiest.label : '\u2014', '', busiest ? `${fmt(busiest.commits)} commits` : '');
    const activeDays = Math.max(0, ...(dev.repos || []).filter((r) => !r.error).map((r) => r.activeDays || 0));
    b += statCard(L + 3 * (dcw + gap), dy, dcw, 'DAYS WITH A COMMIT', `${activeDays} of 7`, '',
      `${(dev.repos || []).filter((r) => !r.error && r.commits > 0).length} active repos`);
    yC = dy + 78;
  }

  const H = yC + 62;
  // The footer is one line between the left margin and the domain mark; past about
  // 118 characters it runs under the mark. Keep both variants inside that.
  const note = dev
    ? `Ledger at epoch ${fmt(snap.epoch)}, state version ${fmt(snap.stateVersion)}. Repositories from GitHub, ${dev.since} to ${dev.until}.`
    : `Read live from the Radix Gateway at epoch ${fmt(snap.epoch)}, state version ${fmt(snap.stateVersion)}.`;
  if (note.length > 118) console.warn(`  warn: footer note is ${note.length} chars and will collide with the domain mark`);
  return { W, H, svg: frame(W, H, 'The Week on the Ledger', `WEEK ENDING ${snap.week}`, note, b) };
}

// ---------------------------------------------------------------- operations

async function loadState(client) {
  // WIR_STATE_FILE overrides the DB read for layout testing (same idea as SNAPSHOT_ORIGIN).
  if (process.env.WIR_STATE_FILE) return JSON.parse(fs.readFileSync(process.env.WIR_STATE_FILE, 'utf8'));
  const { rows } = await client.query(
    'SELECT metadata FROM pages WHERE tag_path = $1 AND slug = $2', [SNAP_TAG, SNAP_SLUG]);
  return rows[0]?.metadata?.state ?? null;
}

async function render(client) {
  const state = await loadState(client);
  const snaps = state?.snapshots || [];
  if (!snaps.length) {
    console.error('No ledger readings stored. Run: node scripts/network-snapshot.mjs capture');
    process.exit(2);
  }
  const week = argOf('--week') || snaps[snaps.length - 1].week;
  const idx = snaps.findIndex((s) => s.week === week);
  if (idx < 0) {
    console.error(`No reading for week ${week}. Stored: ${snaps.map((s) => s.week).join(', ')}`);
    process.exit(2);
  }
  const snap = snaps[idx];
  const prior = snaps[idx - 1] || null;
  const series = snaps.slice(0, idx + 1).slice(-12);

  // The repository reading is optional: a week with no dev capture still gets its
  // ledger figure rather than no figure at all.
  const devs = state?.dev || [];
  const dev = devs.find((x) => x.week === week) || null;
  const devPrior = dev ? devs[devs.indexOf(dev) - 1] || null : null;
  if (!dev) console.log('  note: no repository reading for this week (node scripts/network-snapshot.mjs capture-dev)');

  const { W, H, svg } = wirFigure(snap, prior, series, dev, devPrior);
  await renderPngs([{ file: `wir-${week}`, W, H, svg }], OUT);
  fs.writeFileSync(resolve(OUT, `wir-${week}.block.html`), figureBlock(svg, {
    marker: MARKER,
    label: `The week on the Radix ledger, week ending ${week}`,
    caption: `The week on the Radix ledger ${EN} read at epoch ${fmt(snap.epoch)}, state version ${fmt(snap.stateVersion)}.`,
  }));
  console.log(`wrote brand-assets/wir/wir-${week}.{svg,png,block.html}`);
  console.log('Open the PNG and check it before embedding or attaching it anywhere.');
}

async function embed(client) {
  const slug = rest.find((a) => !a.startsWith('--'));
  if (!slug) throw new Error('embed requires the recap slug, e.g. week-in-review-2026-08-16');
  if (isLockedPage('blog', slug)) throw new Error(`blog/${slug} is locked`);

  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2',
    ['blog', slug]);
  if (!rows.length) throw new Error(`blog/${slug} not found`);
  const page = rows[0];
  const week = page.metadata?.date;
  if (!week) throw new Error(`${slug} has no metadata.date to key the figure on`);

  const blockPath = resolve(OUT, `wir-${week}.block.html`);
  if (!fs.existsSync(blockPath)) {
    throw new Error(`brand-assets/wir/wir-${week}.block.html missing. Run: node scripts/wir-figure.mjs render --week ${week}`);
  }
  const html = fs.readFileSync(blockPath, 'utf8');
  if (/\u00a0/.test(html)) throw new Error('literal U+00A0 in the figure block');

  const res = await embedFigure(client, page, {
    marker: MARKER,
    html,
    // After the ledger section if the essay has one; otherwise above Sources; then above the nav.
    place: (blocks) => {
      const has = (b, s) => b.type === 'content' && typeof b.text === 'string' && b.text.includes(s);
      const ledger = blocks.findIndex((b) => has(b, '>The week on the ledger'));
      const sources = blocks.findIndex((b) => has(b, '<h2>Sources'));
      const nav = blocks.findIndex((b) => has(b, 'Radix Week in Review series:'));
      return ledger >= 0 ? ledger + 1 : sources >= 0 ? sources : nav >= 0 ? nav : blocks.length;
    },
    message: `Add the week-on-the-ledger figure for ${week}.`,
    dry: DRY,
  });
  if (!res) { console.log(`${slug}: figure unchanged, no write`); return; }
  console.log(`  ${DRY ? '[dry] ' : ''}${slug}  v${page.version} -> v${res.version}  ${res.action}`);
}

await withClient(async (client) => {
  if (mode === 'render') await render(client);
  else if (mode === 'embed') await embed(client);
  else {
    console.error('Usage: node scripts/wir-figure.mjs <render|embed> [--week YYYY-MM-DD | <slug>] [--dry-run]');
    process.exit(1);
  }
});
