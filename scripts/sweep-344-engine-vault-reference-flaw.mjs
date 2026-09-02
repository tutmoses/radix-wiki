// scripts/sweep-344-engine-vault-reference-flaw.mjs — run 344 (community rotation, incident slice)
//
// The Radix Engine page says an entire class of bugs is structurally impossible because
// the engine enforces asset rules itself. On 31 August 2026 the engine handed out a vault
// reference it should never have granted and the enforcement never engaged. The page has
// to carry that, on the page that makes the claim.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/core-protocols';
const SLUG = 'radix-engine';
const SENTINEL = 'vault reference vulnerability';
const DRY = process.argv.includes('--dry-run');

const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const SECTION = {
  id: uid(),
  type: 'content',
  text:
    '<h2>The August 2026 vault reference vulnerability</h2>' +
    '<p>On 31 August 2026 a single transaction took resources out of sixty vaults belonging to other people, and the Radix Engine permitted it. ' +
    'Between 16:02 and 16:57 UTC twenty-six such transactions emptied every ' +
    '<a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane-bridged asset on the network</a>. ' +
    'At 22:02 UTC the cause was ' + A('https://t.me/radix_dlt/1000779', 'stated publicly') + ' as the engine rather than the bridge — ' +
    '"any assets, token or nft, could have been withdrawn and moved without permission" — and by then mainnet had been halted by its node runners, at 21:19:06 UTC, to stop further use of it.</p>' +
    '<p>The defect sits in the reference check every transaction passes through before any WASM runs. In ' +
    A('https://github.com/radixdlt/radixdlt-scrypto/blob/v1.3.1/radix-engine/src/system/system_callback.rs#L1147', '<code>verify_boot_ref_value</code>') +
    ', a non-global node named in a manifest is accepted as a <code>DirectAccess</code> reference, and handed to the caller\'s frame, on one test: that its blueprint is ' +
    '<code>FungibleVault</code> or <code>NonFungibleVault</code>. Ownership is not checked, and is not an input to the function. ' +
    'Direct access exists so that <code>recall</code> can work, and recall is gated behind the resource\'s recaller role — but ' +
    A('https://github.com/radixdlt/radixdlt-scrypto/blob/v1.3.1/radix-engine/src/blueprints/resource/fungible/fungible_vault.rs#L268', 'the same vault blueprint') +
    ' gates <code>take</code>, <code>take_advanced</code> and <code>lock_fee</code> behind the resource\'s <em>withdrawer</em> role, which on any freely transferable token is open. ' +
    'An account\'s balance is protected by the account component\'s own <a href="/contents/tech/core-concepts/access-rules-and-auth-zones" rel="noopener">access rules</a> on <code>withdraw</code>; ' +
    'a call made straight to the vault never reaches them.</p>' +
    '<p>The failure is worth stating precisely, because it is not the class of bug the section above says the engine removes. ' +
    'There was no reentrancy, no overflow and no approval to abuse. The engine\'s rules were not evaded — they were applied to a caller the engine had already decided was entitled to hold the reference. ' +
    'System-level enforcement moves the guarantee from application code into the engine, and this is the cost of that trade: application authors could not have written their way out of it, ' +
    'and one function in the boot path decided the outcome for every account on the network. ' +
    'The version this was read at is v1.3.1, the ' + A('https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.3.1', 'Cuttlefish release') + ', and the same function on <code>main</code> is byte-identical to it. ' +
    'A fix was described as in development when the network was halted; none had been published at the time of writing.</p>',
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

  const xian = blocks.findIndex((b) => (b.text || '').includes("The Radix Engine and Xi"));
  if (xian === -1) throw new Error("Xi'an section not found");
  blocks.splice(xian, 0, SECTION);

  const version = '4.6.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}, inserted at ${xian}`);
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
       'Records the 31 August 2026 vault reference vulnerability on the page that claims system-level enforcement: verify_boot_ref_value grants DirectAccess to any vault named in a manifest, and take/lock_fee are gated by the resource withdrawer role rather than by the holding account.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
