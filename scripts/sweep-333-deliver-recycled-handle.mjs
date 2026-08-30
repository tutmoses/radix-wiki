import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'deliver';
const SENTINEL = 'no longer belongs to the project';
const DRY = process.argv.includes('--dry-run');

const OLD = "The metadata also publishes two social links, <code>t.me/DELIVER_XRD</code> and <code>x.com/DELIVER_XRD</code>.";
const NEW = "The metadata also publishes two social links, <code>t.me/DELIVER_XRD</code> and <code>x.com/DELIVER_XRD</code>. The Telegram handle no longer belongs to the project: the channel answering there was created on 1 June 2026, sixteen months after the token, and holds nothing but a fake <a href=\"/contents/resources/recycled-telegram-handles\" rel=\"noopener\">Collab.Land token gate</a> pointing at a lookalike verification bot. The record is correctable even though the supply is not, because the token&rsquo;s metadata roles resolve to its owner rather than to <code>DenyAll</code> and the owner badge is unburned; as of 30 August 2026 nobody has repointed it.";

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
  if (!blocks[4].text.includes(OLD)) throw new Error('social-links anchor missing');
  blocks[4].text = blocks[4].text.replace(OLD, NEW);

  const version = '1.2.0';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  block4 ${page.content[4].text.length} -> ${blocks[4].text.length} B`);
  if (!DRY) {
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'The Telegram handle in the token metadata is recycled. The channel at t.me/DELIVER_XRD was created 1 June 2026, sixteen months after the token, and carries a fake Collab.Land token gate; flagged inline and linked to the recycled-handles advisory, with the note that the metadata roles resolve to the owner so the record is correctable.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
