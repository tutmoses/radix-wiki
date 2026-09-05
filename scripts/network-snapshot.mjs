// scripts/network-snapshot.mjs — one reading of the network a week, kept as a series.
//
// The numbers live on a real wiki page at /contents/tech/operations/network-weekly:
// machine state in pages.metadata.state, visible blocks re-rendered from it, the same
// shape as maintenance-log.mjs. A week-over-week delta needs last week's reading, and
// this is the only thing that remembers it.
//
//   node scripts/network-snapshot.mjs capture [--dry-run]     # read the ledger, store the week
//   node scripts/network-snapshot.mjs capture-dev [--week YYYY-MM-DD] [--dry-run]
//   node scripts/network-snapshot.mjs read                    # print state JSON
//   node scripts/network-snapshot.mjs announce <id> <impressions> <likes> <replies>
//
// Ledger data comes from /api/charts/snapshot rather than the Gateway directly, so this
// script and /charts share one parser. A second fee parser is how /charts came to publish
// the stored validator fee instead of the charged one, for months, across 59% of staked
// XRD. Override the origin with SNAPSHOT_ORIGIN=http://localhost:3000 when testing.
//
// `capture-dev` is the other half of the same week: the recap read the ledger every week
// and never read the code, which is half the ecosystem missing. It parks repository
// activity beside the ledger series in the same state blob, through the authenticated
// `gh` CLI (5,000 req/hr). Anything that fails is recorded as an error on that repo and
// the rest of the capture still lands: a rate limit must never cost the week its reading.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from 'dotenv';
import { bump } from 'wiki-formant/versioning';
import {
  uid, cuid, AUTHOR_ID, isLockedPage, esc, meta, argOf, weekKey, fmt, compact, delta, withClient,
} from './seed-utils.mjs';

config({ path: new URL('../.env', import.meta.url) });

const TAG = 'contents/tech/operations';
const SLUG = 'network-weekly';
const TITLE = 'The Network, Week by Week';
const ORIGIN = process.env.SNAPSHOT_ORIGIN || 'https://radix.wiki';

const [mode, ...rest] = process.argv.slice(2);
const DRY = process.argv.includes('--dry-run');

// Two years of scalars, for both series; the validator sets and the append-only lists
// stay short. The maintenance log reached 384 KB of content and 710 KB of state by not
// doing this.
const WEEKS_MAX = 104, TOP_MAX = 12, ANNOUNCE_MAX = 26;
const SHOWN = 12;

// The repositories the ecosystem's work actually lands in. Adding one here is the
// only change needed for it to appear in the weekly figures.
const REPOS = [
  { repo: 'hyperscalers/hyperscale-rs', label: 'hyperscale-rs' },
  { repo: 'hyperscalers/hyperscale-vm', label: 'hyperscale-vm' },
  { repo: 'radixdlt/radixdlt-scrypto', label: 'radixdlt-scrypto' },
  { repo: 'radixdlt/babylon-node', label: 'babylon-node' },
  { repo: 'radixdlt/radix-engine-toolkit', label: 'radix-engine-toolkit' },
];

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
  snapshots: (state.snapshots || []).slice(-WEEKS_MAX).map((s, i, arr) =>
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

  const version = bump(page.version, 'minor');
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

// ---------------------------------------------------------------- repositories

const run = promisify(execFile);

async function gh(path) {
  const { stdout } = await run('gh', ['api', '-H', 'Accept: application/vnd.github+json', path], {
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

/** The commits endpoint caps a page at 100 and returns newest first, so a single
 *  unpaginated call under-counts a busy week AND makes it look like the work landed
 *  on two days. Walk the pages; stop at PAGE_MAX so one runaway repo cannot stall
 *  the capture. */
const PAGE_MAX = 6;
async function allCommits(repo, since, until) {
  const out = [];
  for (let page = 1; page <= PAGE_MAX; page++) {
    const batch = await gh(`/repos/${repo}/commits?since=${since}T00:00:00Z&until=${until}T23:59:59Z&per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('unexpected response');
    out.push(...batch);
    if (batch.length < 100) return { commits: out, truncated: false };
  }
  return { commits: out, truncated: true };
}

async function repoWeek({ repo, label }, since, until) {
  try {
    // `since`/`until` are inclusive of the seven days ending on the recap's Sunday.
    const { commits, truncated } = await allCommits(repo, since, until);

    // Per-commit stats need one call each; cap it so a very busy week cannot turn
    // into hundreds of requests. The count is always exact, the diff may be partial.
    const detailed = commits.slice(0, 60);
    let additions = 0, deletions = 0, files = 0, counted = 0;
    for (const c of detailed) {
      try {
        const full = await gh(`/repos/${repo}/commits/${c.sha}`);
        additions += full.stats?.additions ?? 0;
        deletions += full.stats?.deletions ?? 0;
        files += full.files?.length ?? 0;
        counted++;
      } catch { /* one bad commit does not spoil the week */ }
    }

    const days = new Set(commits.map((c) => (c.commit?.author?.date || '').slice(0, 10)).filter(Boolean));
    const authors = new Set(commits.map((c) => c.author?.login || c.commit?.author?.name).filter(Boolean));
    const perDay = {};
    for (const c of commits) {
      const d = (c.commit?.author?.date || '').slice(0, 10);
      if (d) perDay[d] = (perDay[d] || 0) + 1;
    }

    return {
      label, repo,
      commits: commits.length,
      // Flagged so nobody reads a capped count or diff as the true total.
      truncated,
      partial: counted < commits.length,
      statsFrom: counted,
      additions, deletions, files,
      activeDays: days.size,
      authors: [...authors].slice(0, 8),
      perDay,
    };
  } catch (e) {
    return { label, repo, error: String(e.message || e).slice(0, 200) };
  }
}

async function languages() {
  const out = {};
  for (const { repo, label } of REPOS) {
    try { out[label] = await gh(`/repos/${repo}/languages`); } catch { /* optional */ }
  }
  return out;
}

/** The repository reading writes metadata only: the visible blocks are the ledger's,
 *  so re-rendering them here would churn every block id for a change they don't show. */
async function captureDev(client, page) {
  const state = meta(page).state ?? {};
  const week = weekKey(argOf('--week'));
  const until = week;
  const since = new Date(new Date(`${week}T00:00:00Z`).getTime() - 6 * 86400000).toISOString().slice(0, 10);
  console.log(`Capturing ${since} .. ${until}`);

  const repos = [];
  for (const r of REPOS) {
    const res = await repoWeek(r, since, until);
    repos.push(res);
    console.log(`  ${res.label.padEnd(22)} ${res.error ? `ERROR ${res.error}` : `${res.commits}${res.truncated ? '+' : ''} commits, +${res.additions} -${res.deletions}, ${res.files} files, ${res.activeDays}/7 days${res.partial ? ' (diff sampled)' : ''}`}`);
  }

  const ok = repos.filter((r) => !r.error);
  const entry = {
    week, since, until,
    capturedAt: new Date().toISOString(),
    commits: ok.reduce((s, r) => s + r.commits, 0),
    additions: ok.reduce((s, r) => s + r.additions, 0),
    deletions: ok.reduce((s, r) => s + r.deletions, 0),
    files: ok.reduce((s, r) => s + r.files, 0),
    // Commit counts are exact. Line and file totals come from a sample of each
    // repo's commits, so when this is true they are a floor, never a total.
    partial: ok.some((r) => r.partial),
    statsFrom: ok.reduce((s, r) => s + (r.statsFrom || 0), 0),
    contributors: [...new Set(ok.flatMap((r) => r.authors))].length,
    repos,
    languages: await languages(),
  };

  // Replace within the same week rather than append, so a re-run is idempotent.
  const dev = (state.dev ?? []).filter((d) => d.week !== week);
  dev.push(entry);
  // Oldest first, matching state.snapshots, so both series index the same way.
  dev.sort((a, b) => a.week.localeCompare(b.week));
  const next = { ...state, dev: dev.slice(-WEEKS_MAX) };

  console.log(`\n  week ${week}: ${entry.commits} commits, ` +
    `${entry.partial ? 'at least ' : ''}+${entry.additions} -${entry.deletions} over ${entry.files} files ` +
    `(diff from ${entry.statsFrom} of ${entry.commits} commits), ` +
    `${entry.contributors} contributor(s) across ${ok.length}/${REPOS.length} repos`);

  if (DRY) { console.log('[dry] no write'); return; }
  const now = new Date().toISOString();
  const version = bump(page.version, 'patch');
  await client.query('BEGIN');
  await client.query('UPDATE pages SET metadata = $1, version = $2, updated_at = $3 WHERE id = $4',
    [JSON.stringify({ ...meta(page), state: next }), version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     SELECT $1, id, content, $2, $3, 'patch', $4, $5, $6 FROM pages WHERE id = $7`,
    [cuid(), page.title, version, AUTHOR_ID, `Record repository activity for the week of ${week}`, now, page.id]);
  await client.query('COMMIT');
  console.log(`  written  v${page.version} -> v${version}`);
}

// ---------------------------------------------------------------- entry

await withClient(async (client) => {
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

  } else if (mode === 'capture-dev') {
    const page = await load(client);
    if (!page) throw new Error(`${TAG}/${SLUG} not found`);
    await captureDev(client, page);

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
    console.error('Usage: node scripts/network-snapshot.mjs <capture|capture-dev|read|announce> [args] [--dry-run]');
    process.exit(1);
  }
});
