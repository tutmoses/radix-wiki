// Sweep 534: /ecosystem/farbocoin was the one Closed ecosystem page with no facts table: one
// content block, the infobox-first rule unmet. Re-read 4 Oct 2026: farbo.me still not found at
// whois.nic.me ("Domain not found"); $FARBO supply 100,000,000 at epoch 346,617 and 357 holders,
// the largest 82,416,955.18, unchanged since the 21 Aug reading in the body. Adds a leading
// infobox built from those readings and the body's own cited facts; the body is untouched.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'farbocoin';
const RES = 'resource_rdx1thlrdezdr9hth2u8lghaykampztpmpemam84w76ah7u9nva9lnc4q4';
const SENTINEL = 'Read 4 October 2026, epoch 346,617';
const INFOBOX = `<table><tbody>
<tr><th colspan="2">Farbocoin</th></tr>
<tr><td>Type</td><td>Game token for the Farbo games</td></tr>
<tr><td>Status</td><td>🔴 Closed – farbo.me is no longer registered; the token remains on-ledger</td></tr>
<tr><td>Founded</td><td>2020</td></tr>
<tr><td>Token</td><td><a href="https://dashboard.radixdlt.com/resource/${RES}" target="_blank" rel="noopener">$FARBO</a></td></tr>
<tr><td>Supply</td><td>100,000,000, fixed: minting and burning set to DenyAll</td></tr>
<tr><td>Holders</td><td>357; one account holds 82.4% of supply</td></tr>
<tr><td>Website</td><td><a href="https://web.archive.org/web/20231209050021/http://farbo.me/" target="_blank" rel="noopener">farbo.me (archived)</a></td></tr>
</tbody></table>
<p><em>${SENTINEL}, through the Radix Gateway.</em></p>`;
const DRY = process.argv.includes('--dry-run');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL) || blocks.some((b) => b.type === 'infobox')) {
    console.log('  already applied – no write');
    process.exit(0);
  }
  blocks.unshift({ id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: INFOBOX }] });

  const version = '2.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${blocks.length} blocks)`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 534: add the missing infobox. farbo.me not found at whois.nic.me on 4 Oct 2026; $FARBO supply 100,000,000 and 357 holders (top 82.4%) re-read at epoch 346,617 via the Radix Gateway.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
