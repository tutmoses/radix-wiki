// scripts/maintenance-log.mjs – State I/O for the wiki-sweep routine's log page.
//
// The maintenance log is a real wiki page at
//   /contents/tech/operations/wiki-maintenance-log
// Its machine state (rotation cursor, per-source watermarks, backlog, feedback,
// run history) lives in pages.metadata.state. The visible content blocks are
// re-rendered from that state so the page reads cleanly in the app.
//
// Usage:
//   node scripts/maintenance-log.mjs read                 # print state JSON to stdout
//   node scripts/maintenance-log.mjs write '<json>'       # replace state, re-render, revision
//   node scripts/maintenance-log.mjs compact [--dry-run]  # re-apply the caps to stored state
//   node scripts/maintenance-log.mjs backlog-add '<json>' # append items (race-safe)
//
// The write payload is the full new state object (read, mutate, write back).
//
// Every write compacts first: `backlog` holds only OPEN work items (run-diary
// prose belongs in `runHistory`, which is what it duplicates), the three
// append-only arrays are capped, and `sources` is capped by recency with its
// banked class verdicts exempt. Uncapped, this page grew to 384 KB of content
// and 710 KB of state, and each of the ~6 runs/day wrote a full copy of both
// into `revisions` — 16 MB, over half that table. So a revision is now written
// at most once a day; intra-day runs update the page in place.
//
// Two things are pinned against their cap, because the routine cannot recreate
// them by running again: FLAG FOR A HUMAN backlog items (nothing here can action
// them) and banked bot-block watermarks (they are why an audit costs no probes).

import pg from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

config({ path: new URL('../.env', import.meta.url) });

const TAG_PATH = 'contents/tech/operations';
const SLUG = 'wiki-maintenance-log';
const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz';
const uid = () => randomUUID();

const [mode, payload] = process.argv.slice(2);
const DRY = process.argv.includes('--dry-run');

// Held in state / shown on the page. Kept apart: state is the routine's memory,
// the page is what a reader can actually get through.
const BACKLOG_MAX = 60, RUNS_MAX = 30, FEEDBACK_MAX = 40, SOURCES_MAX = 150;
// The _SHOWN caps count entries; what a reader pays is words, and entries here run
// long — ten shown runs were 4,865 words on their own, and the whole page reached
// 13,399. Semrush flagged it as the one page on the wiki carrying too much content.
// Halving the render window puts it near 7,000 without touching the _MAX caps above,
// so nothing leaves stored state and each section still prints its "N older held in
// state" line.
const BACKLOG_SHOWN = 15, RUNS_SHOWN = 5, FEEDBACK_SHOWN = 8, SOURCES_SHOWN = 15;

// "run 214 (ecosystem): link audit CLEAN…" — a run diary entry, not a work item.
const JOURNAL = /^run\s+\d+\b/i;
// Standing flags the routine can't action itself. Never let the cap age these
// out — they sort to the top and leave only by being marked done.
const PINNED = /FLAG FOR A HUMAN/i;
// A watermark whose note banks a CLASS verdict rather than one site's status —
// a bot wall, a 403/429/999, a Cloudflare interstitial. These are what let an
// audit spend zero probes on its flag list, so the cap must never age one out;
// they are the `sources` analogue of PINNED. They also accrete slowly (41 keys
// in 320 runs) where plain site probes do not.
const BANKED = /\bbanked\b|bot[- ]?(wall|block)|\b(403|429|999)\b|cloudflare/i;

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Drop what's closed or duplicated, cap what's append-only. */
function compact(state) {
  // Newest first. Undated items fall back to append order — a later index means
  // newer, and must outrank an earlier one.
  const open = (state.backlog || [])
    .map((b) => (typeof b === 'string' ? { date: '', item: b } : b))
    .map((b, i) => ({ status: 'open', ...b, i }))
    .filter((b) => b.status === 'open' && b.item && (PINNED.test(b.item) || !JOURNAL.test(b.item)))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || b.i - a.i);
  const backlog = [
    ...open.filter((b) => PINNED.test(b.item)),
    ...open.filter((b) => !PINNED.test(b.item)),
  ].slice(0, BACKLOG_MAX).map(({ i, ...b }) => b);

  // `sources` is a map, and only a handful of its keys are per-run watermarks —
  // the rest are dated one-off verdicts on a single site, ~3 new per run with
  // nothing pulling against them (49% of state and 278 keys by run 320). Sort by
  // lastChecked and recency does the work: anything checked every run is
  // re-stamped and never falls, so only genuinely untouched probes age out.
  const recency = (a, b) => String(b[1]?.lastChecked || '').localeCompare(String(a[1]?.lastChecked || ''));
  const srcAll = Object.entries(state.sources || {});
  const isBanked = ([, v]) => BANKED.test(String(v?.note || ''));
  const sources = Object.fromEntries(
    [...srcAll.filter(isBanked), ...srcAll.filter((e) => !isBanked(e)).sort(recency).slice(0, SOURCES_MAX)]
      .sort(recency),
  );

  return {
    ...state,
    backlog,
    sources,
    feedback: (state.feedback || []).slice(-FEEDBACK_MAX),
    runHistory: (state.runHistory || []).slice(-RUNS_MAX),
  };
}

function render(state) {
  const rot = state.rotation || {};
  const runs = (state.runHistory || []).slice(-RUNS_SHOWN).reverse();
  const backlog = state.backlog || [];
  const feedback = state.feedback || [];
  const sources = state.sources || {};

  const intro =
    `<p><em>Auto-maintained by the <code>wiki-sweep</code> routine. Each run records what was swept, ` +
    `advances the category rotation, logs ecosystem signals, and tracks community reception. ` +
    `Do not hand-edit the state block – the routine overwrites it.</em></p>` +
    `<p>The sweep enforces RADIX Wiki's editorial policy: ` +
    `<a href="/policy/verifiability" class="link">verifiability</a>, ` +
    `<a href="/policy/neutral-point-of-view" class="link">neutral point of view</a>, ` +
    `<a href="/policy/no-original-research" class="link">no original research</a>, ` +
    `<a href="/policy/notability" class="link">notability</a>, ` +
    `<a href="/policy/conflict-of-interest" class="link">conflict of interest</a>, and ` +
    `<a href="/policy/freshness" class="link">freshness</a> – the last of which sets the 180-day ` +
    `re-verification window this log exists to keep.</p>`;

  const status =
    `<h2>Current Status</h2><table><tbody>` +
    `<tr><td><strong>Next category in rotation</strong></td><td>${esc(rot.next || '–')}</td></tr>` +
    `<tr><td><strong>Rotation order</strong></td><td>${esc((rot.order || []).join(' → '))}</td></tr>` +
    `<tr><td><strong>Last run</strong></td><td>${esc(state.lastRun || '–')}</td></tr>` +
    `<tr><td><strong>Total runs</strong></td><td>${esc(state.totalRuns || 0)}</td></tr>` +
    `</tbody></table>`;

  const srcRows = Object.entries(sources)
    .sort((a, b) => String(b[1]?.lastChecked || '').localeCompare(String(a[1]?.lastChecked || '')))
    .slice(0, SOURCES_SHOWN)
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v.lastChecked || '–')}</td><td>${esc(v.note || '')}</td></tr>`)
    .join('');

  const more = (shown, total, what) =>
    total > shown ? `<p><em>${total - shown} older ${what} held in state.</em></p>` : '';

  // Printed newest-first and capped like the lists below it. Uncapped this table
  // was 179 KB of a 245 KB page — 73% of what a reader had to scroll past — while
  // the backlog showed 25 of 60 and the run diary 10 of 30.
  const sourcesTbl =
    `<h2>Signal Watermarks</h2><table><tbody>` +
    `<tr><td><strong>Source</strong></td><td><strong>Last checked</strong></td><td><strong>Note</strong></td></tr>` +
    (srcRows || '<tr><td>–</td><td>–</td><td>–</td></tr>') +
    `</tbody></table>` +
    more(SOURCES_SHOWN, Object.keys(sources).length, 'watermarks');

  const backlogList = backlog.length
    ? `<ul>${backlog.slice(0, BACKLOG_SHOWN).map((b) => `<li>${esc(typeof b === 'string' ? b : b.item)}</li>`).join('')}</ul>` +
      more(BACKLOG_SHOWN, backlog.length, 'open items')
    : `<p><em>Empty.</em></p>`;

  const feedbackList = feedback.length
    ? `<ul>${feedback.slice(-FEEDBACK_SHOWN).reverse().map((f) => `<li>${esc(typeof f === 'string' ? f : `${f.date || ''} – ${f.note}`)}</li>`).join('')}</ul>` +
      more(FEEDBACK_SHOWN, feedback.length, 'entries')
    : `<p><em>Nothing logged yet.</em></p>`;

  const runRows = runs
    .map(
      (r) =>
        `<tr><td>${esc(r.date || '')}</td><td>${esc(r.category || '')}</td><td>${esc(r.summary || '')}</td><td>${esc(r.tweet || '')}</td></tr>`,
    )
    .join('');
  const runsTbl =
    `<h2>Recent Runs</h2><table><tbody>` +
    `<tr><td><strong>Date</strong></td><td><strong>Category</strong></td><td><strong>Summary</strong></td><td><strong>Tweet</strong></td></tr>` +
    (runRows || '<tr><td>–</td><td>–</td><td>–</td><td>–</td></tr>') +
    `</tbody></table>`;

  return [
    { id: uid(), type: 'content', text: intro },
    { id: uid(), type: 'content', text: status },
    { id: uid(), type: 'content', text: sourcesTbl },
    { id: uid(), type: 'content', text: `<h2>Open Backlog</h2>${backlogList}` },
    { id: uid(), type: 'content', text: `<h2>Community Feedback &amp; Reception</h2>${feedbackList}` },
    { id: uid(), type: 'content', text: runsTbl },
  ];
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (mode === 'read') {
    const { rows } = await client.query(
      'SELECT metadata FROM pages WHERE tag_path = $1 AND slug = $2',
      [TAG_PATH, SLUG],
    );
    if (!rows.length) {
      console.error('Maintenance-log page not found. Run: node scripts/seed-maintenance-log.mjs');
      process.exit(2);
    }
    process.stdout.write(JSON.stringify(rows[0].metadata?.state ?? {}, null, 2) + '\n');
  } else if (mode === 'backlog-add') {
    // Append-only, and it must not clobber a concurrent sweep. `write` is a naive
    // read-mutate-write of the whole state blob; the sweep runs ~6x/day, so a collision
    // in that window would silently discard a run's rotation cursor and watermarks.
    // SELECT ... FOR UPDATE holds the row for the read-modify-write.
    if (!payload) throw new Error('backlog-add requires a JSON array of items');
    const items = JSON.parse(payload);
    if (!Array.isArray(items) || !items.length) throw new Error('backlog-add expects a non-empty array');

    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id, title, version, metadata FROM pages WHERE tag_path = $1 AND slug = $2 FOR UPDATE',
      [TAG_PATH, SLUG],
    );
    if (!rows.length) { await client.query('ROLLBACK'); throw new Error('Page not found; seed it first.'); }
    const { id, title, version: was, metadata } = rows[0];
    const state = metadata?.state ?? {};
    const today = new Date().toISOString().slice(0, 10);
    const seen = new Set((state.backlog || []).map((b) => (typeof b === 'string' ? b : b.item)));

    const added = [];
    for (const raw of items) {
      const item = typeof raw === 'string' ? raw : raw.item;
      if (!item || seen.has(item)) continue;
      seen.add(item);
      added.push({ date: (typeof raw === 'object' && raw.date) || today, item, status: 'open' });
    }
    if (!added.length) {
      await client.query('ROLLBACK');
      console.log('  nothing to add (all duplicates)');
    } else {
      const next = compact({ ...state, backlog: [...(state.backlog || []), ...added] });
      const content = render(next);
      const now = new Date().toISOString();
      console.log(`  ${DRY ? '[dry] ' : ''}+${added.length} backlog item(s), ${next.backlog.length} open`);
      for (const a of added) console.log(`     ${a.item}`);
      if (DRY) {
        await client.query('ROLLBACK');
      } else {
        await client.query(
          'UPDATE pages SET content = $1, metadata = $2, updated_at = $3 WHERE id = $4',
          [JSON.stringify(content), JSON.stringify({ state: next, lastVerified: today }), now, id],
        );
        await client.query('COMMIT');
        console.log(`Backlog updated (v${was} unchanged — an append is not a revision)`);
      }
    }
  } else if (mode === 'write' || mode === 'compact') {
    const { rows } = await client.query(
      'SELECT id, title, version, metadata FROM pages WHERE tag_path = $1 AND slug = $2',
      [TAG_PATH, SLUG],
    );
    if (!rows.length) throw new Error('Page not found; seed it first.');
    const { id, title, version: was } = rows[0];

    let input;
    if (mode === 'compact') {
      input = rows[0].metadata?.state ?? {};
    } else {
      if (!payload) throw new Error('write requires a JSON state argument');
      input = JSON.parse(payload);
    }

    const state = compact(input);
    const now = new Date().toISOString();
    const content = render(state);
    const metadata = { state, lastVerified: now.slice(0, 10) };

    // One revision a day. Intra-day runs edit the page in place — six full
    // copies of it a day is what made this page over half the revisions table.
    const { rows: [last] } = await client.query(
      'SELECT created_at FROM revisions WHERE page_id = $1 ORDER BY created_at DESC LIMIT 1', [id],
    );
    const revise = mode === 'compact' || !last || last.created_at.toISOString().slice(0, 10) !== now.slice(0, 10);
    const [maj, min] = was.split('.');
    const version = revise ? `${maj}.${Number(min) + 1}.0` : was;

    const count = (v) => (Array.isArray(v) ? v.length : Object.keys(v || {}).length);
    for (const key of ['backlog', 'runHistory', 'feedback']) {
      const [before, after] = [count(input[key]), count(state[key])];
      if (before !== after) console.log(`  ${key}: ${before} → ${after}`);
    }
    console.log(
      `  ${DRY ? '[dry] ' : ''}state ${JSON.stringify(input).length} → ${JSON.stringify(state).length} B, ` +
      `content ${JSON.stringify(content).length} B, v${was}${revise ? ` → v${version} (+revision)` : ' (no revision today)'}`,
    );
    if (!DRY) {
      await client.query('BEGIN');
      await client.query(
        'UPDATE pages SET content = $1, metadata = $2, updated_at = $3, version = $4 WHERE id = $5',
        [JSON.stringify(content), JSON.stringify(metadata), now, version, id],
      );
      if (revise) {
        await client.query(
          `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
           VALUES ($1, $2, $3, $4, $5, 'minor', $6, $7, $8)`,
          [uid(), id, JSON.stringify(content), title, version, AUTHOR_ID,
           mode === 'compact' ? 'Compact the log: drop closed/duplicated backlog items, cap the append-only arrays'
                              : `Sweep run ${state.lastRun || now}`, now],
        );
      }
      await client.query('COMMIT');
      console.log(`Maintenance log updated → v${version}`);
    }
  } else {
    console.error('Usage: node scripts/maintenance-log.mjs <read|write|compact|backlog-add> [json] [--dry-run]');
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
