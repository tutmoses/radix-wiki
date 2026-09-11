// Sweep 407 — /contents/resources/radix-ecosystem-operational-status
// Day twelve: the restart is gated on a coordinated boot rather than on a climb. The largest
// validators are upgraded and deliberately offline; the chart measures the tail.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/resources';
const SLUG = 'radix-ecosystem-operational-status';
const SENTINEL = 'halt-coordinated-boot';
const DRY = process.argv.includes('--dry-run');
const ANCHOR = 'id="halt-restart-sequence"';

const HTML = `<p id="${SENTINEL}"><strong>The restart is gated on a coordinated boot, not on a climb, and the largest validators are upgraded and deliberately offline.</strong> At <strong>10:11:24&nbsp;UTC on 11 September</strong>, answering a node runner asking in the main Radix Telegram group why the ten largest validators could not spare ten minutes to update, <a href="https://t.me/radix_dlt/1003000" target="_blank" rel="noopener">Faraz said the state is intentional</a>: <q>The largest nodes are upgraded and waiting to boot up together once we have a decent amount of stake online from the remaining nodes.</q> The stated aim is to come back well clear of two thirds rather than barely over it, because crossing the threshold marginally risks a node falling over and <q>triggering another liveness break</q>, and a few large nodes are easier to coordinate than a long tail of small ones. <a href="https://t.me/radix_dlt/1002990" target="_blank" rel="noopener">Daffy had answered the same question</a> sixteen minutes earlier: the update is planned this way, and any conclusion about a validator still on v1.3 should wait a week after the network is live. That changes how the adoption chart reads. Published adoption can sit well short of 67% right up to the moment it clears, because the stake that closes the gap sits behind nodes that are down on purpose, so <a href="/ecosystem/stakesafe#sweep407-offline-by-design" rel="noopener">the tracker measures the tail's progress</a> rather than counting down.</p>
<p>The numbers behind that, read at <strong>11:05&nbsp;UTC on 11 September</strong>: <a href="https://validators.stakesafe.net" target="_blank" rel="noopener">the adoption tracker</a> reads <strong>1,528,203,682&nbsp;XRD</strong> on v1.4.0.0, <strong>32.77%</strong> of the active validator set, with 39.65% of that stake having a node online at all; adoption rose 72,399,358&nbsp;XRD in the preceding four hours and every XRD of it came from outside the twelve largest validators, which still hold 2,073,397,318&nbsp;XRD and still read a v1.3 version and offline. The shortfall to the 3,124,224,298&nbsp;XRD that more than 67% comes to is 1,596,020,616&nbsp;XRD. Eighteen validators holding 327,184,952&nbsp;XRD, 7.02% of the set, read online on a v1.3 build, which is the one reading the version column gives unambiguously and the group the council's upgrade instruction is aimed at. Read at <strong>11:05:08&nbsp;UTC</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> returns state version 557,840,622 at epoch 339,896, round 102: <strong>two hundred and fifty-three hours and forty-six minutes</strong> without a committed round.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const NBSP = /\u00A0/;
  if (NBSP.test(HTML)) throw new Error('literal U+00A0 in script string');

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied, no write');
    process.exit(0);
  }

  const i = blocks.findIndex((b) => b.text?.includes(ANCHOR));
  if (i < 0) throw new Error('halt block not found');
  const before = blocks[i].text.length;
  blocks[i].text = blocks[i].text + HTML;

  const version = '1.18.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  appended ${HTML.length} chars to block ${i}: ${before} -> ${blocks[i].text.length}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Day twelve of the halt: Faraz and Daffy both state in the main Radix group that the largest validators are already upgraded and deliberately offline, waiting to boot together well clear of two thirds, so adoption can sit short of 67% until the moment it clears. Adds the 11:05 UTC tracker and gateway readings.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
