// scripts/sweep-343-weft-hyperlane-sequel.mjs — run 343 (ecosystem rotation)
// Weft's exploit page ends on 31 August 03:10 UTC. Thirteen hours later a second,
// unrelated incident took every Hyperlane-bridged asset on the network. This adds
// the pointer and the one fact about Weft that the second incident settles.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'weft-finance';
const SENTINEL = 'hyperlane-asset-drain-2026';
const DRY = process.argv.includes('--dry-run');

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

  const target = blocks.findIndex((b) => (b.text || '').includes('The 30 August 2026 exploit'));
  if (target === -1) throw new Error('exploit section not found');

  blocks[target].text +=
    '<h3>The second incident, thirteen hours later</h3>' +
    '<p>At 16:02 UTC on 31 August, thirteen hours after the last remediation transaction above, a separate attacker began emptying every ' +
    '<a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane-bridged asset held on Radix</a>. ' +
    'Twenty-six transactions in under an hour took the whole supply of hUSDC, hUSDT, hETH, hWBTC, hSOL and hBNB out of accounts and pools across the network and bridged it away. ' +
    'The method has nothing in common with the exploit above: it needed no oracle, no price feed and no lending market, and it produced no borrow position. ' +
    'What the two share is the exit, since both attackers left over a Hyperlane warp route.</p>' +
    '<p>Weft held 0.21 hUSDC in its lending pool when that pool was read at 03:10 UTC, so the second incident took effectively nothing further from the protocol. ' +
    'It removes the reserve currency the market would have restarted against: the four wrapped assets the page lists as disabled and locked collateral no longer exist on Radix in any quantity.</p>';

  const version = '4.9.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (+${blocks[target].text.length - page.content[target].text.length} bytes on block ${target})`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Adds the 31 August Hyperlane asset drain as a separate incident, distinguishes its method from the 30 August exploit, and notes that the wrapped collateral Weft had disabled no longer exists on Radix.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
