/**
 * Run 329 (community rotation, staleness pass).
 *
 * Re-measured at the GitHub API on 29 August 2026. Two counted facts on the
 * page had moved (public repositories 14 -> 15, vanitygen stars 20 -> 21), and
 * the reason for the first is worth a sentence: on 24 August 2026 he forked a
 * browser extension for Radix Kingdoms. It is a fork, not authorship - every
 * commit in it is by the upstream author - so the page's claim that his last
 * commit of his own on a Radix repository is March 2024 survives the check.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'community';
const SLUG = 'kangaderoo';
const SENTINEL = 'radixkingdoms';
const DRY = process.argv.includes('--dry-run');

const ADDED = ` The claim survives a re-check on 29 August 2026, but only just, and the exception is worth naming: on 24 August 2026 he forked <a href="https://github.com/kangaderoo/radixkingdoms" target="_blank" rel="noopener"><code>radixkingdoms</code></a>, a browser-extension UI overlay for the on-ledger strategy game <a href="/ecosystem/radix-kingdoms" rel="noopener">Radix Kingdoms</a>. It is his first Radix-adjacent action on GitHub in over two years and it is not his code &ndash; all three commits in the repository are authored by its upstream owner, <a href="https://github.com/TibiaGoogleMaps/radixkingdoms" target="_blank" rel="noopener">TibiaGoogleMaps</a>. A fork is a bookmark with a copy attached, and this one is the fifteenth public repository on the account.`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const replacements = [
  [`was opened in December 2009 and holds 14 public repositories`,
   `was opened in December 2009 and holds 15 public repositories`],
  [`<h2>Before Radix</h2><p>Ten of his fourteen public repositories predate his Radix work`,
   `<h2>Before Radix</h2><p>Ten of his fifteen public repositories predate his Radix work`],
  [`<code>vanitygen</code></a> at 20 stars`,
   `<code>vanitygen</code></a> at 21 stars`],
  [`and it is the most recent commit of his own on any Radix repository.</p>`,
   `and it is the most recent commit of his own on any Radix repository.${ADDED}</p>`],
];

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const hits = new Set();
  const apply = (text) => {
    let out = text;
    for (const [from, to] of replacements) {
      if (out.includes(from)) { out = out.split(from).join(to); hits.add(from.slice(0, 40)); }
    }
    return out;
  };
  for (const b of blocks) {
    if (typeof b.text === 'string') b.text = apply(b.text);
    for (const n of b.blocks || []) if (typeof n.text === 'string') n.text = apply(n.text);
  }
  const missed = replacements.filter(([from]) => !hits.has(from.slice(0, 40)));
  if (missed.length) {
    for (const [from] of missed) console.error('   MISS:', from.slice(0, 110));
    throw new Error('aborting rather than writing a partial edit');
  }

  const version = '1.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${JSON.stringify(page.content).length} -> ${JSON.stringify(blocks).length} B`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Re-measured at the GitHub API on 29 Aug 2026: public repositories 14 -> 15 and vanitygen 20 -> 21 stars. Records the fifteenth repository, a 24 Aug 2026 fork of TibiaGoogleMaps/radixkingdoms, and states that the page’s March-2024 "most recent commit of his own" claim survives because every commit in the fork is upstream-authored.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
