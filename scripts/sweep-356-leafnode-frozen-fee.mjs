import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 356, ecosystem rotation. Readings taken at 23:04 UTC on 2 September 2026:
//   POST mainnet.radixdlt.com/status/gateway-status -> epoch 339896, state version 557840622, round 102
//   POST mainnet.radixdlt.com/state/validators/list -> 500 NotSyncedUpError, current_sync_delay_seconds 179118
// The page already records the 100% fee queued for epoch 341223 and the DEPLOYMENT_PAUSED website.
// What is new: 341223 - 339896 = 1327 epochs on a counter the halt has stopped, and the unstaking
// that would answer the fee is a transaction the ledger is not accepting either.

const TAG_PATH = 'ecosystem';
const SLUG = 'leafnode';
const VERSION = '4.1.0';
const SENTINEL = '1,327 epochs';

const FEE_OLD = 'queued for epoch&nbsp;341223 (early September 2026)</td></tr>';
const FEE_NEW = 'queued for epoch&nbsp;341223, which the halted ledger has not reached</td></tr>';

const SECTION = `<h2>The fee change the stopped ledger cannot deliver (2 September 2026)</h2>
<p>The 100% fee described above is queued for epoch 341,223. Radix mainnet has committed no round since 21:19:06 UTC on 31 August 2026. Read at <strong>23:04 UTC on 2 September 2026</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a> still returns epoch 339,896 at state version 557,840,622, and <code>/state/validators/list</code> answers HTTP 500 because the Gateway's database is 179,118 seconds behind the ledger against a permitted 720.</p>
<p>An epoch ends when rounds are produced, and none are being produced. The queued fee therefore sits <strong>1,327 epochs</strong> beyond a counter that has stopped, and it will arrive whenever the network restarts rather than in the first week of September. The interval before a queued fee applies is the window in which a delegator who does not want the new rate unstakes. Unstaking is a transaction, and the ledger is accepting none. Anyone still delegated to Leaf Node is held in a validator whose fee switch is armed, on a network where neither the switch nor the exit from it can move until the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halt</a> ends. Every queued fee change on Radix is in the same position; this one is dated and on the record.</p>`;

const MESSAGE = 'The halt has frozen this validator mid-wind-down. The 100% fee is queued for epoch 341,223 and the ledger has been stopped at epoch 339,896 since 21:19:06 UTC on 31 August, so neither the fee nor the unstaking that answers it can arrive; the Gateway read at 23:04 UTC on 2 September is 179,118 seconds behind against a permitted 720. The infobox no longer dates the fee to early September.';

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const [label, s] of [['FEE_NEW', FEE_NEW], ['SECTION', SECTION]]) {
    if (s.includes(' ')) throw new Error(`${label} carries a literal U+00A0`);
    if (s.includes('—')) throw new Error(`${label} carries an em dash`);
  }
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied - no write'); process.exit(0); }

  const info = blocks[0];
  if (info.type !== 'infobox') throw new Error('block 0 is not the infobox');
  if (!info.blocks[0].text.includes(FEE_OLD)) throw new Error('fee find-string did not match');
  info.blocks[0].text = info.blocks[0].text.replace(FEE_OLD, FEE_NEW);

  blocks.push({ id: uid(), type: 'content', text: SECTION });

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  ${page.content.length} blocks -> ${blocks.length}, 1 infobox substitution`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now]);
    await client.query('COMMIT');
    console.log('    written');
  }
} finally {
  client.release();
  await pool.end();
}
