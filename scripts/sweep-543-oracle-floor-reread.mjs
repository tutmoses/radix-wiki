/**
 * sweep 543 - developers rotation: 08-oracle-integration's "What the operator
 * did next" re-read on the ledger, 6 October 2026.
 *
 * The section says the ten-token floor was still rewritten on every cycle "read
 * at 07:05:59 UTC" on 31 August. Re-read the Weft Default PriceFeed: the
 * update_prices call at 07:05:51 UTC on 6 October (state version ~561.3M) still
 * sets the same ten native resources to 0.0000000001 XRD and quotes the other
 * ten, on the same ten-minute cadence. One sentence added; no code on the page.
 *
 * Idempotent: skipped if the sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'developers/scrypto';
const SLUG = '08-oracle-integration';
const VERSION = '2.3.2';
const TX = 'https://dashboard.radixdlt.com/transaction/txid_rdx1azjz2hgdyu3ukwk3uhmqfh8xl942rzz3jtn94yfhpckrysery62qry3ckj';
const SENTINEL = 'txid_rdx1azjz2hgdyu3ukwk3uhmqfh8xl942rzz3jtn94yfhpckrysery62qry3ckj';
const FROM = 'the only lever the operator had left.</p>';
const TO =
  'the only lever the operator had left. Five weeks later it is still the setting: the ' +
  `<a href="${TX}" target="_blank" rel="noopener">update at 07:05:51 UTC on 6 October 2026</a> writes the same ten tokens at ` +
  '<code>0.0000000001</code> XRD and real quotes for the other ten, ten minutes after the one before it.</p>';
const MESSAGE =
  'Re-read the Weft Default PriceFeed on the ledger on 6 October 2026: the 07:05:51 UTC update_prices call still floors the ' +
  'same ten native tokens at 0.0000000001 XRD. One sentence added to What the operator did next. wiki-sweep run 543.';

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) { console.log('  already applied - no write'); return; }
  const blocks = JSON.parse(JSON.stringify(page.content));
  const hits = blocks.filter((b) => (b.text || '').split(FROM).length === 2);
  if (hits.length !== 1) throw new Error(`${hits.length} blocks hold the anchor`);
  hits[0].text = hits[0].text.replace(FROM, TO);
  const json = JSON.stringify(blocks);
  assertLinkShapes(blocks, page.title);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  if (DRY) { console.log(TO); return; }
  const now = new Date().toISOString();
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4', [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'patch', AUTHOR_ID, MESSAGE, now],
  );
  await client.query('COMMIT');
  console.log('  written');
});
