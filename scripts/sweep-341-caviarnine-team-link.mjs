import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 341 dead-link repair, ecosystem rotation. docs.caviarnine.com/introduction/team now
// 404s (the docs sidebar no longer carries the page at all). The claims it supported are
// real - the 14 May 2026 capture states Thailand/Singapore/Canada/Australia with Bangkok as
// headquarters, and names the founders - so the citation is repointed to that capture and
// dated, rather than stripped.

const TAG_PATH = 'ecosystem';
const SLUG = 'caviarnine';
const DEAD = 'https://docs.caviarnine.com/introduction/team';
const ARCHIVE = 'https://web.archive.org/web/20260514230817/https://docs.caviarnine.com/introduction/team';
const SENTINEL = 'web/20260514230817';
const DRY = process.argv.includes('--dry-run');

const NOTE_OLD = 'Their mission is to provide users with seamless access to professional-grade innovative DeFi products and unlock the full potential of DeFi.</p>';
const NOTE_NEW = 'Their mission is to provide users with seamless access to professional-grade innovative DeFi products and unlock the full potential of DeFi. The docs team page these facts come from was removed from <a href="https://docs.caviarnine.com" target="_blank" rel="noopener">docs.caviarnine.com</a> at some point before 31 August 2026, and the links above resolve to its last capture, taken 14 May 2026.</p>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  let hits = 0;
  for (const b of blocks) {
    if (typeof b.text !== 'string') continue;
    const before = b.text;
    b.text = b.text.split(DEAD).join(ARCHIVE);
    hits += (before.split(DEAD).length - 1);
    if (b.text.includes(NOTE_OLD)) b.text = b.text.replace(NOTE_OLD, NOTE_NEW);
  }
  if (hits === 0) throw new Error('dead URL not found');

  const version = '5.4.1';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${hits} link(s) repointed)`);

  if (!DRY) {
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       `Dead link: docs.caviarnine.com/introduction/team 404s and is gone from the docs sidebar. ${hits} citations repointed to the 14 May 2026 Wayback capture, which supports the Bangkok headquarters and founder claims verbatim, and the Team section now dates the removal.`,
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
