// Sweep 544: /ecosystem/stream-wallet has been orphaned since the 1 Oct status-index deletion. Its home is the
// Radix Wallet article: Radix Stream was a community self-custody mobile wallet that pre-dates the official one
// (last release v1.2.13, 24 April 2023, both store listings now 404, as recorded on /ecosystem/stream-wallet).
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/tech/core-protocols';
const SLUG = 'radix-wallet';
const SENTINEL = 'href="/ecosystem/stream-wallet"';
const DRY = process.argv.includes('--dry-run');

const FROM = 'href="https://wallet.radixdlt.com">https://wallet.radixdlt.com</a>.</p>';
const TO = 'href="https://wallet.radixdlt.com">https://wallet.radixdlt.com</a>.</p> <p>Community-built wallets came before it. <a href="/ecosystem/stream-wallet" rel="noopener">Radix Stream</a>, a self-custody mobile wallet from the IdeoMaker team, published its last release on 24 April 2023 and can no longer be installed from either app store.</p>';

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
  const version = '1.6.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
        'Sweep 544: links Radix Stream, the community mobile wallet that pre-dates this one (last release 24 Apr 2023, store listings removed, per /ecosystem/stream-wallet); that page had no inbound link since 1 Oct.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
