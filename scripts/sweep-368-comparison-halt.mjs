import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/comparisons';
const SLUG = 'radix-vs-ethereum';
const SENTINEL = 'Where the comparison stands, 5 September 2026';

const OLD_ROW = 'One unsharded ledger (<a href="/contents/tech/comparisons/radix-vs-solana">measured 21 August 2026</a>)</td>';
const NEW_ROW = 'One unsharded ledger (<a href="/contents/tech/comparisons/radix-vs-solana">measured 21 August 2026</a>); no round committed since 31 August 2026</td>';

const OLD_STRENGTH = 'developer-friendly Rust-based language, structurally eliminates common exploit classes.</p>';
const NEW_STRENGTH = [
  'developer-friendly Rust-based language, and an execution model with no reentrancy and no <code>approve()</code> pattern to abuse.</p>',
  '<h2 id="halt-2026">' + SENTINEL + '</h2>',
  '<p>The throughput row and the strengths above both need a date. On 31 August 2026 a single transaction took resources out of sixty <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">vaults</a> belonging to other people, and the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine permitted it</a>. Twenty-six such transactions <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">emptied every Hyperlane-bridged asset on the network</a> between 16:02 and 16:57 UTC, and at 22:02 UTC the cause was <a href="https://t.me/radix_dlt/1000779" target="_blank" rel="noopener">stated publicly</a> as the engine rather than the bridge.</p>',
  '<p>The defect sat in the reference check every transaction passes before any contract code runs, which accepted a <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">vault</a> reference on the test that its <a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">blueprint</a> was a vault, without asking who owned it. So the two comparisons this page draws against Solidity still hold – reentrancy and the approval pattern are absent from Radix – and the broader claim they were carrying does not. The engine removes a class of bug; it did not remove this one.</p>',
  '<p>Mainnet has not committed a round since. Its node runners halted it at 21:19:06 UTC on 31 August to stop further use of the defect, and the public <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway</a> has returned the same head ever since: state version 557,840,622, epoch 339,896, round 102, read again at 03:03 UTC on 5 September, 101 hours 44 minutes later. The fix is proposed as the <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray protocol update</a>, and the live reading is kept on the <a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">operational status page</a>.</p>',
].join('\n');

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  for (const [name, s] of [['NEW_ROW', NEW_ROW], ['NEW_STRENGTH', NEW_STRENGTH]]) {
    if (/\u00A0/.test(s)) throw new Error(`${name} contains U+00A0`);
    if (/—/.test(s)) throw new Error(`${name} contains an em dash`);
  }

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const b = blocks.find((x) => x.text?.includes(OLD_ROW));
  if (!b) throw new Error('OLD_ROW not found');
  if (!b.text.includes(OLD_STRENGTH)) throw new Error('OLD_STRENGTH not found');
  b.text = b.text.replace(OLD_ROW, NEW_ROW).replace(OLD_STRENGTH, NEW_STRENGTH);

  const version = '1.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  block grew ${page.content[2].text.length} -> ${b.text.length} bytes`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       "Date the comparison against the 31 August 2026 vault reference vulnerability and the halt that followed. The strengths list asserted that Radix structurally eliminates common exploit classes; the engine permitted a single transaction to drain sixty vaults belonging to other people, so the claim is narrowed to the two exclusions that hold (reentrancy, the approval pattern) and the defect is stated with its sources. The live-throughput row now records that mainnet has committed no round since 21:19:06 UTC on 31 August, read again at 03:03 UTC on 5 September at state version 557,840,622, epoch 339,896, round 102.", now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
