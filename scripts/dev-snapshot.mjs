// scripts/dev-snapshot.mjs — the week in the repositories.
//
// The recap reads the ledger every week and never reads the code, which is half
// the ecosystem missing: the competing digest opens on commits, lines changed and
// a streak, and those numbers are free. This captures the same window the recap
// covers, across every repo that matters, and parks it beside the ledger series in
// pages.metadata.state on contents/tech/operations/network-weekly.
//
//   node scripts/dev-snapshot.mjs capture [--week YYYY-MM-DD] [--dry-run]
//   node scripts/dev-snapshot.mjs read
//
// Uses the authenticated `gh` CLI (5,000 req/hr). Anything that fails is recorded
// as an error on that repo and the rest of the capture still lands: a rate limit
// must never cost the week its ledger reading.

import pg from 'pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID } from './seed-utils.mjs';

config({ path: new URL('../.env', import.meta.url) });

const run = promisify(execFile);
const SNAP_TAG = 'contents/tech/operations';
const SNAP_SLUG = 'network-weekly';
const DEV_MAX = 104;

// The repositories the ecosystem's work actually lands in. Adding one here is the
// only change needed for it to appear in the weekly figures.
const REPOS = [
  { repo: 'hyperscalers/hyperscale-rs', label: 'hyperscale-rs' },
  { repo: 'hyperscalers/hyperscale-vm', label: 'hyperscale-vm' },
  { repo: 'radixdlt/radixdlt-scrypto', label: 'radixdlt-scrypto' },
  { repo: 'radixdlt/babylon-node', label: 'babylon-node' },
  { repo: 'radixdlt/radix-engine-toolkit', label: 'radix-engine-toolkit' },
];

const [mode] = process.argv.slice(2);
const DRY = process.argv.includes('--dry-run');
const argOf = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };

/** The Sunday that ends the week, matching the recap slug and the ledger snapshots. */
function weekKey(iso) {
  const d = iso ? new Date(`${iso}T00:00:00Z`) : new Date();
  const sunday = new Date(d);
  sunday.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return sunday.toISOString().slice(0, 10);
}

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

const meta = (row) => (row?.metadata && typeof row.metadata === 'object' ? row.metadata : {});

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  const { rows } = await client.query(
    'SELECT id, title, version, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [SNAP_TAG, SNAP_SLUG]);
  const page = rows[0];
  if (!page) throw new Error(`${SNAP_TAG}/${SNAP_SLUG} not found`);
  const state = meta(page).state ?? {};

  if (mode === 'read') {
    process.stdout.write(JSON.stringify(state.dev ?? [], null, 2) + '\n');
  } else if (mode === 'capture') {
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
    const next = { ...state, dev: dev.slice(-DEV_MAX) };

    console.log(`\n  week ${week}: ${entry.commits} commits, ` +
      `${entry.partial ? 'at least ' : ''}+${entry.additions} -${entry.deletions} over ${entry.files} files ` +
      `(diff from ${entry.statsFrom} of ${entry.commits} commits), ` +
      `${entry.contributors} contributor(s) across ${ok.length}/${REPOS.length} repos`);

    if (DRY) { console.log('[dry] no write'); }
    else {
      const now = new Date().toISOString();
      const [maj, min, pat] = String(page.version || '1.0.0').split('.');
      const version = `${maj}.${min}.${Number(pat) + 1}`;
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
  } else {
    console.error('Usage: node scripts/dev-snapshot.mjs <capture|read> [--week YYYY-MM-DD] [--dry-run]');
    process.exitCode = 1;
  }
} catch (e) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
