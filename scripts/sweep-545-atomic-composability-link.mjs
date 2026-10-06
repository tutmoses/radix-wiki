// Sweep 545: /contents/tech/core-concepts/composability has had no inbound link since the 1 Oct status-index
// deletion. Its home is the Atomic Composability article, which narrows the general idea it defines.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'atomic-composability';
const SENTINEL = 'href="/contents/tech/core-concepts/composability"';
const DRY = process.argv.includes('--dry-run');

const FROM = '<p><strong>Atomic composability</strong> means that complex multi-step operations either execute completely or not at all.';
const TO = '<p><strong>Atomic composability</strong> means that complex multi-step operations either execute completely or not at all. It is the strict form of <a href="/contents/tech/core-concepts/composability" rel="noopener">composability</a>, the ability of one application to use another’s output as its input.';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }
  const block = blocks.find((b) => b.type === 'content' && b.text?.includes(FROM));
  if (!block) throw new Error(`no match: ${FROM.slice(0, 60)}`);
  block.text = block.text.replace(FROM, TO);
  const version = '2.4.1';
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
        'Sweep 545: links the general Composability article from the overview; it had no inbound link since 1 Oct.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
