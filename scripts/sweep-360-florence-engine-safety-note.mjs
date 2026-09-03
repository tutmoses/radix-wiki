/**
 * Run 360 (blog rotation). /blog/radix-is-florence was the second staleness head in the
 * blog category: never verified, published November 2023, and its central technical
 * argument credits the Radix Engine's native-asset model with making applications
 * "much easier to design and safer to manage" against $3bn of 2022 Ethereum hacks.
 * That argument was live and unqualified three days into a mainnet halt caused by the
 * Radix Engine moving assets without owner authorisation. Run 347's over-claim grep
 * ("cannot be stolen", "unhackable", "impossible to hack") missed it because the claim
 * is comparative and unquantified rather than a slogan. Adds the dated-claim infobox
 * row the rest of this batch carries; the essay itself is left as written.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'blog';
const SLUG = 'radix-is-florence';
const SENTINEL = 'Dated claim';
const DRY = process.argv.includes('--dry-run');

const OLD_TAIL = '<tr><th>Related</th><td><a href="/contents/tech/comparisons/radix-vs-ethereum" rel="noopener">Radix vs Ethereum</a> &middot; <a href="/contents/history" rel="noopener">History of Radix</a></td></tr></tbody></table>';
const NEW_TAIL = '<tr><th>Dated claim</th><td>Published in November 2023. Its technical section credits the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a>&rsquo;s native assets and smart accounts with making applications &ldquo;much easier to design and safer to manage&rdquo; than Ethereum&rsquo;s token-contract model, set against $3bn of 2022 hacks. Read that against the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">asset drain of 31 August 2026</a>, in which twenty-six transactions moved every Hyperlane-bridged asset on the network without an owner signing anything, and mainnet was halted: the stated cause was a flaw in the Radix Engine itself, in the same authorisation layer this essay credits</td></tr>'
  + '<tr><th>Related</th><td><a href="/contents/tech/comparisons/radix-vs-ethereum" rel="noopener">Radix vs Ethereum</a> &middot; <a href="/contents/history" rel="noopener">History of Radix</a> &middot; <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a></td></tr></tbody></table>';

for (const [name, s] of Object.entries({ OLD_TAIL, NEW_TAIL })) {
  if (s.includes('\u00a0')) throw new Error(`${name} contains U+00A0`);
}

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
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const ib = blocks[0].blocks[0];
  if (!ib.text.includes(OLD_TAIL)) throw new Error('find-string missed: infobox tail');
  ib.text = ib.text.replace(OLD_TAIL, NEW_TAIL);

  const version = '2.4.0';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (infobox ${page.content[0].blocks[0].text.length} -> ${ib.text.length} chars)`);
  if (!DRY) {
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Add the dated-claim infobox row. This November 2023 essay credits the Radix Engine\'s native-asset model with making applications "safer to manage" than Ethereum\'s, set against $3bn of 2022 hacks - an argument that needs its date and a pointer to the 31 August 2026 asset drain, whose stated cause was a flaw in that same engine. The essay is left as written; the qualification is editorial and dated.',
       now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
