// scripts/sweep-352-hyperscale-halt-toggle.mjs — run 352 (contents/tech rotation)
//
// The banked run-350 finding: the halt has produced its first design change in the
// successor network. Asked whether a sharded network could even be halted, the lead
// developer answered that it can, described the beacon chain's liveness response, and
// then proposed an on-chain governed toggle himself — while saying he would have called
// the idea absurd two days earlier. That belongs on the hyperscale-rs page, next to the
// migration section, because it is a property of the design rather than of the incident.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const SENTINEL = 'halt-toggle';
const DRY = process.argv.includes('--dry-run');

const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const SECTION = {
  id: uid(),
  type: 'content',
  text:
    '<h2 id="halt-toggle">Halting a Sharded Network (September 2026)</h2>' +
    '<p>The <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">August 2026 halt of Radix mainnet</a> put a question to this design that had not been asked of it before: ' +
    'whether a network of independently seated shard committees, with membership constantly shuffling, could be stopped at all. ' +
    'It was raised in the project channel on 1 September 2026 by Aditya Ingle, who asked whether a halt in hyperscale would be ' +
    A('https://t.me/hyperscale_rs/11473', '&ldquo;almost infeasible&rdquo;') + ' given per-shard committees and constant shuffling. ' +
    'The exchange that followed is the first design change the incident has produced in the successor network, and each message below is authorship-verified through the Telegram embed.</p>' +
    '<h3>A shard can halt, and the beacon chain treats it as a fault</h3>' +
    '<p>The lead developer\'s answer was that halting is possible but not global: ' +
    A('https://t.me/hyperscale_rs/11474', '&ldquo;you can halt of course but one shard halting doesn\'t impact others so the liveness impact is localised&rdquo;') +
    ', with the caveat that cross-shard transactions needing state in that shard are affected. ' +
    'A stalled shard is not left stalled: prolonged outages are noted by the ' +
    'beacon chain, which rotates the whole committee to restore liveness. ' +
    'He put a figure on &ldquo;prolonged&rdquo; at ' + A('https://t.me/hyperscale_rs/11477', 'hours rather than minutes') +
    ', because a shard is expected to recover on its own from a temporary network partition, and a full committee rotation resyncs an entire validator set at once instead of dripping one shuffled member in at a time. ' +
    'The mechanism that makes a stuck shard self-healing is, on this reading, also the mechanism that makes a deliberate network-wide stop hard to reach.</p>' +
    '<h3>An on-chain governed toggle, proposed two days after being called absurd</h3>' +
    '<p>Pressed on the case that actually arose, an engine-level defect draining funds in every shard at once, he proposed the fix himself: ' +
    A('https://t.me/hyperscale_rs/11478', '&ldquo;there\'s probably a more elegant way to go about it than yanking the power cords out of the wall&hellip; maybe like having a on-chain governed toggle which if voted to flip - then txn processing stops&rdquo;') +
    ', adding that it &ldquo;would be simple enough to implement given the on-chain governance machinery is there already&rdquo;. ' +
    'He then marked the reversal himself: ' + A('https://t.me/hyperscale_rs/11479', '&ldquo;two days ago i would have said &lsquo;why the hell would anyone want that?!&rsquo;&rdquo;') + '. ' +
    'projectShift answered that ' + A('https://t.me/hyperscale_rs/11480', '&ldquo;it\'s now obvious that a well implemented decentralized network with a serious bug can become impossible to halt&rdquo;') +
    ', asked for governance options that are themselves decentralised in who opts in and out, and asked that the asymmetry between delegators and node runners be reduced so both sides have a fair chance of equal power over such a decision.</p>' +
    '<p>Nothing here is implemented. It is a channel exchange, not an RFC, and the ' +
    'crate tree carries no such toggle at the time of writing. ' +
    'What it records is the direction of travel: Babylon was halted by roughly a hundred node runners each independently stopping their own machine, which is why ' +
    '<a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">restarting it requires each of them to decide again</a>, and the successor design is now being discussed with a governed stop as a first-class feature rather than an emergency improvised out of the operators\' own hands.</p>',
};

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
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied – no write');
    process.exit(0);
  }

  const at = blocks.findIndex((b) => (b.text || '').includes('id="migration-shape"'));
  if (at === -1) throw new Error('migration section not found');
  blocks.splice(at + 1, 0, SECTION);

  const version = '6.19.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}, inserted at ${at + 1}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Adds "Halting a Sharded Network (September 2026)": a shard can halt with localised liveness impact and the beacon chain rotates the committee after hours, and the lead developer proposed an on-chain governed stop toggle on 1 September, two days after saying he would have called the idea absurd. Sourced to hyperscale_rs 11473-11480, authorship-verified through the Telegram embed.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
