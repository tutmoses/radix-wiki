// Run 327, contents/tech rotation. Banked at run 325 for this rotation: the one
// citable statement out of the 28 Aug hyperscale_rs exchange that the run-324
// section did not carry. The page documents the SAFETY side of committee capture
// (44% of stake for a single shard over a 1000-year horizon) and the beacon's
// re-draw in the f+1..2f band, but never states the LIVENESS threshold. 11116
// asked for it and 11118 answered, author verified as flightofthefox through the
// t.me embed author field.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const SENTINEL = 'The liveness threshold is the monolithic one';
const DRY = process.argv.includes('--dry-run');

const SECTION = [
  '<h3>The liveness threshold, and the answer that is still unpublished</h3>',
  '<p>The 44% figure prices <em>capture</em>. Asked in the same exchange what it costs to attack <em>liveness</em> instead, the developer separated the two: <a href="https://t.me/hyperscale_rs/11118" target="_blank" rel="noopener">&ldquo;same same. you can impact liveness with 1/3&rdquo;</a>. The liveness threshold is the monolithic one, a third of a committee, and it is far below the share that capture needs; what differs is the consequence. Halting a committee is not a durable position, because the beacon takes the seats away: sustained liveness failure, in the developer&rsquo;s words, is where &ldquo;the beacon says <em>fuck your committee</em> - firing squad&rdquo;. That is the channel&rsquo;s statement of the mechanism the <a href="https://github.com/hyperscalers/hyperscale-rs/blob/main/docs/05-byzantine-safety.md" target="_blank" rel="noopener">threat model</a> documents in the f+1 to 2f band, where withholding halts a shard and the beacon undoes it with a full re-draw of every seat.</p>',
  '<p>The question that prompted it asked specifically for the <em>sharded</em> liveness threshold, and for a time horizon at 20% Byzantine stake. Neither number was given. The sharded equivalent of the 44% capture figure, for liveness rather than safety, has not been published, and this page does not have one to record.</p>',
].join('\n');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied — no write'); process.exit(0); }

  const b = blocks[5];
  if (!b || b.type !== 'content' || !b.text.includes('Seating, Shuffling and the Single-Shard Threshold'))
    throw new Error('block 5 is not the seating/shuffling section');

  // Insert after the single-shard-threshold subsection, i.e. immediately before
  // "What shuffling costs, and what asset orientation saves".
  const anchor = '<h3>What shuffling costs, and what asset orientation saves</h3>';
  const at = b.text.indexOf(anchor);
  if (at < 0) throw new Error('anchor subsection not found');
  b.text = b.text.slice(0, at) + SECTION + b.text.slice(at);

  const version = '6.16.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  - inserted ${SECTION.length} B before "${anchor.replace(/<[^>]+>/g, '')}"`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$4 WHERE id=$5',
      [json, version, now, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Add the liveness threshold to the seating/shuffling section: a third of a committee can impact liveness (t.me/hyperscale_rs/11118, author verified as flightofthefox via the t.me embed), sustained liveness failure gets the committee dissolved by the beacon, and the sharded liveness figure the question asked for was not given and remains unpublished.', now]);
    await client.query('COMMIT');
    console.log('  committed');
  }
} finally {
  client.release();
  await pool.end();
}
