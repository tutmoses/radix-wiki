import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Follow-up to scripts/sweep-353-dead-video-citations.mjs, which removed the two
// removed-from-YouTube session recordings from this page's prose and missed the same
// two links in its External links list — a page can cite the same dead resource twice.
const TAG_PATH = 'contents/history';
const SLUG = 'european-blockchain-convention-2024';
const DRY = process.argv.includes('--dry-run');

const FIND = '<li><a target="_blank" rel="noopener noreferrer" href="https://youtu.be/TeXUSQhRYJ8?si=fquuf7pmDvuSLXhB">How to Scale DLT Infrastructure? part one (YouTube)</a></li><li><a target="_blank" rel="noopener noreferrer" href="https://youtu.be/LAX_iMiiJRs?si=JIMQ8YD66S1qQNb7">How to Scale DLT Infrastructure? part two (YouTube)</a></li>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));

  const idx = blocks.findIndex((b) => (b.text || '').includes(FIND));
  if (idx < 0) {
    if (!blocks.some((b) => (b.text || '').includes('TeXUSQhRYJ8'))) {
      console.log('  already applied — no write');
      process.exit(0);
    }
    throw new Error('video ids present but find-string did not match');
  }

  blocks[idx].text = blocks[idx].text.replace(FIND, '');
  const [a, b, c] = page.version.split('.').map(Number);
  const version = `${a}.${b}.${c + 1}`;
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  block ${idx}, ${blocks[idx].text.length - page.content[idx].text.length} chars`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       'Run 353: the two "How to Scale DLT Infrastructure?" recordings were cited a second time in External links and both have been removed from YouTube ("Video unavailable", checked 2 September 2026).', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
