import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'weft-finance';
const SENTINEL = '324 further transactions';
const DRY = process.argv.includes('--dry-run');

const ANCHOR = 'was still enabled and unlocked when this was read at 20:00 UTC.</p>';
const BREAK_TX = 'https://dashboard.radixdlt.com/transaction/txid_rdx17mgxz8dlmyzrrtppec9fer4lqfyl38j40skdql9f3xfyw2wvk88qfalnwp';

const ADDITION = ANCHOR + '\n'
  + '<p>It began on <strong>28 August 2026 at 12:35:17&nbsp;UTC</strong>, in an ordinary ten-minute refresh '
  + `(<a href="${BREAK_TX}" target="_blank" rel="noopener">transaction</a>, state version 556,254,628). `
  + 'In the update immediately before it the feed carried HUG at <code>0.000131085370299542</code>&nbsp;XRD; in this one it carried '
  + '<code>1289.783156723014634465</code>. That first figure is the same to the last digit in every batch sampled between 1 and 28 August, '
  + 'so HUG was a fixed entry rather than a quoted one until this update moved it into the band the feed uses for dollar assets, after which it drifted with them on each cycle. '
  + 'From that write to the borrow is <strong>53 hours and 28 minutes</strong>, and <strong>324 further transactions</strong> touched the component in between. '
  + 'Each carried a current timestamp, so a consumer checking only staleness would have accepted every one of them; the last, at 17:55:53 on 30 August, published 1,330.41&nbsp;XRD. '
  + 'The general lesson for builders reading a feed is set out on <a href="/developers/scrypto/08-oracle-integration" rel="noopener">Oracle Integration</a>.</p>';

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
  const target = blocks.find((b) => (b.text || '').includes(ANCHOR));
  if (!target) throw new Error('anchor not found');
  target.text = target.text.replace(ANCHOR, ADDITION);

  const version = '4.8.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  +${ADDITION.length - ANCHOR.length} chars`);
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
       'Dates the mispricing. HUG went from 0.000131085370299542 XRD to 1289.78 in the routine refresh at 12:35:17 UTC on 28 August (state version 556,254,628), 53 hours and 28 minutes and 324 feed transactions before the borrow. The page recorded how long the error stood after the exploit but not before it.',
       now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
