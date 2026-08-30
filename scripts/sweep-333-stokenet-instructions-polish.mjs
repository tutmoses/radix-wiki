import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/releases';
const SLUG = 'stokenet';
const SENTINEL = 'so the document ends by sending operators to';
const DRY = process.argv.includes('--dry-run');

const EDITS = [
  ['so the document ends by directing operators to message the operator on Telegram with an account address and a stake figure.',
   'so the document ends by sending operators to <a href="/community/daffy" rel="noopener">Daffy</a> on Telegram with an account address and a stake figure.'],
  ['Most of the rest is configuration, and two of the items are worth reading even by someone who will never run a node.',
   'Most of the rest is configuration, and two items in it are worth reading even by someone who will never run a node.'],
];

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
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  for (const [from, to] of EDITS) {
    const n = blocks[2].text.split(from).length - 1;
    if (n !== 1) throw new Error(`anchor found ${n}x: ${from.slice(0, 50)}`);
    blocks[2].text = blocks[2].text.replace(from, to);
  }

  const version = '1.10.1';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  block2 ${page.content[2].text.length} -> ${blocks[2].text.length} B`);
  if (!DRY) {
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       'Wording in the node-instructions section: name Daffy with the internal link the rest of the page uses instead of repeating "the operator", and unstack a noun phrase.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
