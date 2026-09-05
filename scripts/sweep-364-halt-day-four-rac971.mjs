// sweep-364: carry the operational-status page's halt notice to 4 September.
//
// The notice was last refreshed at 23:09 UTC on 3 September against RAC 969.
// The council posted again at 11:02 UTC on 4 September (RAC 971, embed-verified
// as projectShift, the same author as 969): testing still ongoing, still no
// date, and an explicit request that the community hold the post-mortem until
// after the restart. The ledger has not moved — an eighteenth consecutive
// reading returns state version 557,840,622 at epoch 339,896 — so this adds one
// paragraph and re-dates the infobox rather than opening a new section.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/resources';
const SLUG = 'radix-ecosystem-operational-status';
const SENTINEL = 'RadixAccountabilityCouncil/971';
const DRY = process.argv.includes('--dry-run');

const INFOBOX_FROM = 'no restart date announced as of 3 September';
const INFOBOX_TO = 'no restart date announced as of 11:02 UTC, 4 September';

const PARA_ANCHOR = '<strong>No date was given</strong>, and the update says so in terms: &ldquo;Still no hard date to commit to.&rdquo;</p>';
const PARA_ADD = PARA_ANCHOR + '\n<p>The council said it again <a href="https://t.me/RadixAccountabilityCouncil/971" target="_blank" rel="noopener">at 11:02&nbsp;UTC on 4 September</a>, nineteen hours later and eighty-five hours into the halt. The testing &ldquo;is still ongoing and still no date we can commit to&rdquo;; the council thanked everyone who had sent in details, ideas and validations, asked that everyone &ldquo;operate with a high degree of containment on all of this until it&rsquo;s fixed and running proper&rdquo;, and asked that the post-mortem wait until the end. On the other business it carries, it reported no relevant updates and repeated the call to join the discussion phase of the governance-framework ratification. The message is authorship-verified at its <a href="https://t.me/RadixAccountabilityCouncil/971?embed=1&amp;mode=tme" target="_blank" rel="noopener">public embed</a> as projectShift, the author of the 3 September update as well.</p>\n<p>Nothing on the ledger moved in between. Read at <strong>11:03&nbsp;UTC on 4 September</strong>, the Gateway returns the same last committed ledger for an eighteenth consecutive check &ndash; state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179&nbsp;UTC &ndash; and <code>/state/validators/list</code> answers HTTP 500 at a sync delay of <strong>308,671 seconds</strong> against the 720 the Gateway tolerates.</p>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

/** Walk content + infobox children; the network-status row lives inside an infobox. */
const patch = (blocks, from, to) => {
  let hits = 0;
  for (const b of blocks) {
    if (typeof b.text === 'string' && b.text.includes(from)) { b.text = b.text.replace(from, to); hits++; }
    if (Array.isArray(b.blocks)) hits += patch(b.blocks, from, to);
  }
  return hits;
};

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  for (const s of [INFOBOX_FROM, INFOBOX_TO, PARA_ANCHOR]) {
    if ([...s].some((ch) => ch.charCodeAt(0) === 0x00a0)) throw new Error(`literal U+00A0 in a find-string: ${s.slice(0, 50)}`);
  }

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const a = patch(blocks, INFOBOX_FROM, INFOBOX_TO);
  if (a !== 1) throw new Error(`infobox network-status row: expected 1 hit, got ${a}`);
  const b = patch(blocks, PARA_ANCHOR, PARA_ADD);
  if (b !== 1) throw new Error(`halt paragraph: expected 1 hit, got ${b}`);

  const version = '1.9.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (infobox row + 2 paragraphs)`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Halt notice carried to 4 September: RAC 971 at 11:02 UTC (embed-verified as projectShift) reports testing still ongoing and still no date, asks for containment until the restart and for the post-mortem to wait; eighteenth consecutive Gateway reading at 11:03 UTC unchanged at state version 557,840,622 / epoch 339,896, /state/validators/list HTTP 500 at 308,671s sync delay. Infobox network-status row re-dated.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
