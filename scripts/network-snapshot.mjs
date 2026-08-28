// scripts/network-snapshot.mjs — one on-chain reading a week, kept as a series.
//
// The numbers live on a real wiki page at /contents/tech/operations/network-weekly:
// machine state in pages.metadata.state, visible blocks re-rendered from it, the same
// shape as maintenance-log.mjs. A week-over-week delta needs last week's reading, and
// this is the only thing that remembers it.
//
//   node scripts/network-snapshot.mjs capture [--dry-run]   # read the ledger, store the week
//   node scripts/network-snapshot.mjs read                  # print state JSON
//   node scripts/network-snapshot.mjs announce <id> <impressions> <likes> <replies>
//
// Data comes from /api/charts/snapshot rather than the Gateway directly, so this script
// and /charts share one parser. A second fee parser is how /charts came to publish the
// stored validator fee instead of the charged one, for months, across 59% of staked XRD.
// Override the origin with SNAPSHOT_ORIGIN=http://localhost:3000 when testing.

import pg from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';

config({ path: new URL('../.env', import.meta.url) });

const TAG = 'contents/tech/operations';
const SLUG = 'network-weekly';
const TITLE = 'The Network, Week by Week';
const ORIGIN = process.env.SNAPSHOT_ORIGIN || 'https://radix.wiki';
const uid = () => randomUUID();

const [mode, ...rest] = process.argv.slice(2);
const DRY = process.argv.includes('--dry-run');

// Two years of scalars; the validator sets and the append-only lists stay short. The
// maintenance log reached 384 KB of content and 710 KB of state by not doing this.
const SNAPSHOTS_MAX = 104, TOP_MAX = 12, ANNOUNCE_MAX = 26;
const SHOWN = 12;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const meta = (row) => (row?.metadata && typeof row.metadata === 'object' ? row.metadata : {});

/** The Sunday ending the week we are recording, so the key matches the recap's slug. */
function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - t.getUTCDay());
  return t.toISOString().slice(0, 10);
}

const fmt = (n, digits = 0) =>
  n == null || !isFinite(n) ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: digits });

function compact(n) {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return fmt(n);
}

/** Never invent a comparison: an absent or stale prior reading yields no delta at all. */
function delta(now, was, { percent = true, staleDays = 10, gapDays = 0 } = {}) {
  if (was == null || now == null || !isFinite(was) || !isFinite(now) || was === 0) return '';
  if (gapDays > staleDays) return '';
  const diff = now - was;
  if (diff === 0) return 'no change';
  const sign = diff > 0 ? '+' : '−';
  const mag = Math.abs(diff);
  return percent
    ? `${sign}${((mag / Math.abs(was)) * 100).toFixed(1)}%`
    : `${sign}${compact(mag)}`;
}

function render(state) {
  const snaps = (state.snapshots || []).slice(-SHOWN).reverse();
  const latest = snaps[0];
  const rows = snaps.map((s) => {
    const oci = s.ociswap || {};
    return `<tr><td>${esc(s.week)}</td><td>${fmt(s.epoch)}</td><td>${compact(s.totalStake)}</td>` +
      `<td>${s.active ?? '—'} / ${s.registered ?? '—'}</td><td>${s.nakamoto ?? '—'}</td>` +
      `<td>${compact(oci.volume7dXrd)}</td><td>${fmt(oci.swaps7d)}</td></tr>`;
  }).join('');

  const blocks = [
    { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text:
      `<table><tbody>` +
      `<tr><th>Weeks recorded</th><td>${(state.snapshots || []).length}</td></tr>` +
      (latest ? `<tr><th>Latest reading</th><td>${esc(latest.week)}</td></tr>` +
                `<tr><th>Epoch</th><td>${fmt(latest.epoch)}</td></tr>` +
                `<tr><th>Validators holding a third</th><td>${latest.nakamoto ?? '—'}</td></tr>` : '') +
      `</tbody></table>` }] },
    { id: uid(), type: 'content', text:
      `<p>One reading of the Radix ledger a week, taken through the Radix Gateway and kept ` +
      `so that each week can be compared with the one before it. Stake and supply are in XRD. ` +
      `Swap figures cover Ociswap only, which is one venue among several and not the whole of ` +
      `Radix trading. Every row records the epoch it was read at, because a number without ` +
      `a position on the ledger cannot be checked later.</p>` },
    { id: uid(), type: 'content', text:
      `<h2>The last ${snaps.length} week${snaps.length === 1 ? '' : 's'}</h2>` +
      (rows
        ? `<table><tbody><tr><th>Week ending</th><th>Epoch</th><th>Staked XRD</th>` +
          `<th>Active / registered</th><th>Third of stake</th><th>Ociswap 7d (XRD)</th><th>Swaps</th></tr>${rows}</tbody></table>`
        : '<p>No readings yet.</p>') },
  ];

  const ann = (state.announcements || []).slice(-10).reverse();
  if (ann.length) {
    blocks.push({ id: uid(), type: 'content', text:
      `<h2>How the weekly recap was received</h2>` +
      `<table><tbody><tr><th>Week</th><th>Impressions</th><th>Likes</th><th>Replies</th></tr>` +
      ann.map((a) => `<tr><td>${esc(a.week)}</td><td>${fmt(a.impressions)}</td><td>${fmt(a.likes)}</td><td>${fmt(a.replies)}</td></tr>`).join('') +
      `</tbody></table>` });
  }
  return blocks;
}

const cap = (state) => ({
  ...state,
  snapshots: (state.snapshots || []).slice(-SNAPSHOTS_MAX).map((s, i, arr) =>
    i < arr.length - TOP_MAX ? { ...s, top25: undefined } : s),
  announcements: (state.announcements || []).slice(-ANNOUNCE_MAX),
});

async function load(client) {
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG, SLUG],
  );
  return rows[0] || null;
}

async function persist(client, page, state, message) {
  const content = render(state);
  const now = new Date().toISOString();
  const json = JSON.stringify(content);

  if (!page) {
    console.log(`  ${DRY ? '[dry] ' : ''}${SLUG}  page created (v1.0.0)`);
    if (DRY) return;
    const id = cuid();
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO pages (id, slug, title, content, tag_path, metadata, version, author_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'1.0.0',$7,$8,$8)`,
      [id, SLUG, TITLE, json, TAG,
       JSON.stringify({ excerpt: 'A weekly reading of the Radix ledger, kept so each week can be compared with the last.', state }),
       AUTHOR_ID, now]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,'1.0.0','major',$5,$6,$7)`,
      [cuid(), id, json, TITLE, AUTHOR_ID, message, now]);
    await client.query('COMMIT');
    return;
  }

  const [maj, min] = String(page.version || '1.0.0').split('.');
  const version = `${maj}.${Number(min) + 1}.0`;
  console.log(`  ${DRY ? '[dry] ' : ''}${SLUG}  v${page.version} -> v${version}`);
  if (DRY) return;
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content = $1, metadata = $2, version = $3, updated_at = $4 WHERE id = $5',
    [json, JSON.stringify({ ...meta(page), state }), version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,'minor',$6,$7,$8)`,
    [cuid(), page.id, json, page.title, version, AUTHOR_ID, message, now]);
  await client.query('COMMIT');
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG, SLUG)) throw new Error(`${TAG}/${SLUG} is locked`);

  if (mode === 'read') {
    const page = await load(client);
    if (!page) { console.error('Not found. Run: node scripts/network-snapshot.mjs capture'); process.exit(2); }
    process.stdout.write(JSON.stringify(meta(page).state ?? {}, null, 2) + '\n');

  } else if (mode === 'capture') {
    const res = await fetch(`${ORIGIN}/api/charts/snapshot`, { headers: { accept: 'application/json' } });
    if (res.status === 404) {
      throw new Error(
        `no snapshot route at ${ORIGIN} (404).\n` +
        `  The route ships with the app, so a 404 on radix.wiki means it is not deployed yet.\n` +
        `  Against a local dev server instead:\n` +
        `    SNAPSHOT_ORIGIN=http://localhost:3000 node scripts/network-snapshot.mjs capture`,
      );
    }
    if (!res.ok) throw new Error(`snapshot route ${res.status} at ${ORIGIN}`);
    const reading = await res.json();

    const page = await load(client);
    const state = meta(page).state ?? {};
    const snapshots = [...(state.snapshots || [])];
    const week = weekKey();
    const prior = snapshots.filter((s) => s.week !== week).slice(-1)[0];

    // Re-running inside the same week replaces that week rather than appending.
    const at = snapshots.findIndex((s) => s.week === week);
    const entry = { week, ...reading };
    if (at >= 0) snapshots[at] = entry; else snapshots.push(entry);

    const gap = prior ? Math.round((new Date(week) - new Date(prior.week)) / 86400000) : 0;
    console.log(`  week ${week}  epoch ${fmt(reading.epoch)}  state version ${fmt(reading.stateVersion)}`);
    console.log(`  staked ${compact(reading.totalStake)} XRD ${delta(reading.totalStake, prior?.totalStake, { gapDays: gap })}`);
    console.log(`  validators ${reading.active} active / ${reading.registered} registered ` +
                `${delta(reading.active, prior?.active, { percent: false, gapDays: gap })}`);
    console.log(`  third of stake held by ${reading.nakamoto} ${delta(reading.nakamoto, prior?.nakamoto, { percent: false, gapDays: gap })}`);
    console.log(`  fee divergence: ${reading.feeDivergentCount} validators (${reading.feeDivergentActiveCount} active, ` +
                `${compact(reading.feeDivergentActiveStake)} XRD)`);
    if (reading.pendingFeeChanges?.length) {
      console.log(`  pending fee changes (${reading.pendingFeeChanges.length}):`);
      for (const p of reading.pendingFeeChanges) {
        console.log(`     ${p.name} ${(p.currentFee * 100).toFixed(2)}% -> ${(p.fee * 100).toFixed(2)}% ` +
                    `at epoch ${fmt(p.epoch)} (+${fmt(p.epoch - reading.epoch)}), ${compact(p.stake)} XRD staked`);
      }
    }
    if (!prior) console.log('  no prior reading: this week has no comparison.');
    else if (gap > 10) console.log(`  prior reading is ${gap} days old: too stale to compare.`);

    await persist(client, page, cap({ ...state, snapshots }), `Ledger reading for the week ending ${week}`);

  } else if (mode === 'announce') {
    const [id, impressions, likes, replies] = rest.filter((a) => !a.startsWith('--'));
    if (!id) throw new Error('announce requires <tweetId> <impressions> <likes> <replies>');
    const page = await load(client);
    if (!page) throw new Error('Not found; run capture first.');
    const state = meta(page).state ?? {};
    const announcements = (state.announcements || []).filter((a) => a.id !== id);
    announcements.push({
      week: weekKey(), id,
      impressions: Number(impressions) || 0, likes: Number(likes) || 0, replies: Number(replies) || 0,
    });
    await persist(client, page, cap({ ...state, announcements }), `Record how the ${weekKey()} recap was received`);

  } else {
    console.error('Usage: node scripts/network-snapshot.mjs <capture|read|announce> [args] [--dry-run]');
    process.exit(1);
  }
} catch (e) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
