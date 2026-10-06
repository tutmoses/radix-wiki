// Sweep 542: /ecosystem/liquify has been orphaned since the 1 Oct status-index deletion. Its natural home is
// the LSU page's unstaking section, which describes the 2,016-epoch delay and nothing a holder can do about
// it: Liquify is the on-ledger market that buys LSUs for XRD from providers' discounted bids (component state
// as read on /ecosystem/liquify).
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'liquid-stake-units';
const SENTINEL = 'href="/ecosystem/liquify"';
const DRY = process.argv.includes('--dry-run');

const FROM = 'Locked owner stake carries a longer 8,064-epoch (≈ 28-day) delay.</p>';
const TO = 'Locked owner stake carries a longer 8,064-epoch (≈ 28-day) delay.</p> <p>A holder who will not wait can sell the LSUs instead. <a href="/ecosystem/liquify" rel="noopener">Liquify</a> is an on-ledger market for exactly this: liquidity providers deposit XRD with standing bids at a discount, a seller receives XRD at once, and the delay falls on the buyer.</p>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }
  const block = blocks.find((b) => b.type === 'content' && b.text.includes(FROM));
  if (!block) throw new Error(`no match: ${FROM.slice(0, 60)}`);
  block.text = block.text.replace(FROM, TO);
  const version = '1.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 542: unstaking section adds the alternative to waiting out the delay, selling LSUs to Liquify (XRD from providers\' discounted bids, delay borne by the buyer), and gives the orphaned /ecosystem/liquify page an inbound link.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
