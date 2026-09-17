// sweep-449b-deliver-handle-restricted.mjs
//
// Run 449 follow-through. /ecosystem/deliver says the channel answering at the
// handle the DELIVER token publishes "holds nothing but a fake Collab.Land token
// gate". As of 17 September 2026 it holds nothing at all: Telegram has restricted
// it for violating its Terms of Service (MTProto restriction reason, platform
// "all", reason "terms"), and it now returns no subscribers, description or posts.
// The on-ledger record is re-read at epoch 341,716 and is unchanged.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'deliver';
const SENTINEL = 'Telegram has since withdrawn it';
const DRY = process.argv.includes('--dry-run');

const FROM_A = 'and holds nothing but a fake <a href="/contents/resources/recycled-telegram-handles" rel="noopener">Collab.Land token gate</a> pointing at a lookalike verification bot.';
const TO_A = 'and held nothing but a fake <a href="/contents/resources/recycled-telegram-handles" rel="noopener">Collab.Land token gate</a> pointing at a lookalike verification bot. Telegram has since withdrawn it: read through the MTProto API on 17 September 2026, the channel returns a restriction with reason <code>terms</code>, stating that it cannot be displayed because it violated Telegram&rsquo;s Terms of Service, and reports no subscribers, no description and no posts.';

const FROM_B = 'and the owner badge is unburned; as of 30 August 2026 nobody has repointed it.';
const TO_B = 'and the owner badge is unburned; re-read at mainnet epoch 341,716 on 17 September 2026, <code>social_urls</code> still carries the handle and nobody has repointed it.';

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
    console.log('  already applied - no write');
    process.exit(0);
  }

  const b = blocks.find((x) => x.text?.includes(FROM_A));
  if (!b) throw new Error('anchor A not found');
  if (!b.text.includes(FROM_B)) throw new Error('anchor B not found in the same block');
  b.text = b.text.replace(FROM_A, TO_A).replace(FROM_B, TO_B);

  const version = '1.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  em dashes: ${(b.text.match(/\u2014/g) || []).length}, nbsp: ${(b.text.match(/\u00a0/g) || []).length}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Telegram has restricted the channel answering at the handle the DELIVER token publishes, for violating its Terms of Service; read through MTProto on 17 September 2026 it returns no subscribers, description or posts, so the page no longer describes a live gate. On-ledger record re-read at epoch 341,716: supply, the six DenyAll authority roles and social_urls are unchanged, and the owner badge that could repoint the metadata has not been used.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
