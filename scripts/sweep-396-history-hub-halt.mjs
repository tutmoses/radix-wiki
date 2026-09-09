// Sweep 396 (contents/history): the category hub - History of Radix, the page
// at the empty slug - carried no line for the August 2026 halt. Its timeline
// ran Origins, Cerberus, Olympia, Babylon, Dan Hughes, Road to Xi'an and then
// the Composability Gap essay, and it was last edited on 16 August, two weeks
// before the network stopped. This inserts one section between Road to Xi'an
// and the Composability Gap and points at the full record.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/history';
const SLUG = '';
const SENTINEL = 'the-august-2026-halt';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2 id="${SENTINEL}">The halt (2026)</h2>
<p>On <strong>31 August 2026</strong>, between 16:02 and 16:58&nbsp;UTC, twenty-six transactions emptied every <a href="/ecosystem/hyperlane" rel="noopener">Hyperlane</a>-bridged asset held on Radix, out of user accounts and out of the liquidity pools of Radix dApps alike, without a single owner signing anything. Five hours later the cause was named in public: not the bridge, but the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> itself, where an invocation could reach a vault its caller had no visibility of. That is the layer every transaction on the network passes through, and the exploit for it was on the ledger for anyone to read.</p>
<p>Validators stopped rather than keep producing rounds against it. Radix consensus needs more than two thirds of staked XRD to be validating and simply stops below that threshold, which is the liveness half of a trade-off it makes in favour of safety, so mainnet came to rest at <strong>21:19:06&nbsp;UTC</strong> on state version 557,840,622 in epoch 339,896 and stayed there. Wallets, the dashboard and the explorers went dark within minutes, because they all read a <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway</a> that will not answer a question about a present it is hours behind.</p>
<p>The repair is a protocol update named <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a>, and its whole content is a check the kernel now runs before an invocation: the caller must be able to see the receiver it is calling. It merged into <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a> on 7 September and into <a href="/contents/tech/core-protocols/babylon-node" rel="noopener">babylon-node</a> on 8 September, and on 9 September the <a href="/ecosystem/radix-accountability-council" rel="noopener">Radix Accountability Council</a> reported it deployed and validated end to end on <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a>. At the time of writing mainnet has not restarted. The record read from the ledger, day by day through the outage, is at <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane Asset Drain and Network Halt (August 2026)</a>.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error('hub is LOCKED');
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('hub page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const at = blocks.findIndex((b) => b.text?.includes('The Composability Gap'));
  if (at === -1) throw new Error('anchor block not found');
  blocks.splice(at, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '1.7.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (insert at ${at} of ${blocks.length})`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'The history hub had no line for the August 2026 halt, having last been edited on 16 August. Adds one section covering the drain, the Radix Engine cause, the stop at epoch 339,896, and the Eagle Ray repair through its Stokenet validation on 9 September, linking the full day-by-day record.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
