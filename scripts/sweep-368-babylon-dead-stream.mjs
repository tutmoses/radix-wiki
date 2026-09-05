import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/releases';
const SLUG = 'radix-mainnet-babylon';
const SENTINEL = 'web.archive.org/web/20231024034126';

const OLD = '<a target="_blank" rel="noopener noreferrer nofollow" class="link" href="https://www.youtube.com/live/DIJbfZ_xPKE">migration</a> from the <a rel="noopener" class="link" href="/contents/tech/releases/radix-developer-environment-alexandria">Alexandria</a> release occurred at epoch 32717 on the 28th September 2023.</p>';
const NEW = '<a target="_blank" rel="noopener" class="link" href="https://web.archive.org/web/20231024034126/https://www.youtube.com/watch?v=DIJbfZ_xPKE">migration</a> from the <a rel="noopener" class="link" href="/contents/tech/releases/radix-developer-environment-alexandria">Alexandria</a> release occurred at epoch 32717 on the 28th September 2023. The stream that carried it live, run by <a rel="noopener" class="link" href="/ecosystem/ociswap">Ociswap</a> rather than by Radix, now answers <code>LOGIN_REQUIRED</code> on YouTube, so the link above goes to the Internet Archive’s capture of 24 October 2023.</p>';

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  if (/\u00A0/.test(NEW)) throw new Error('NEW contains U+00A0');
  if (/—/.test(NEW)) throw new Error('NEW contains an em dash');

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const b = blocks.find((x) => x.text?.includes(OLD));
  if (!b) throw new Error('OLD not found');
  b.text = b.text.replace(OLD, NEW);

  const version = '2.1.3';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       "Repoint the dead Babylon migration stream. youtube.com/live/DIJbfZ_xPKE now returns status LOGIN_REQUIRED with an empty title and its oEmbed 403s, so the citation moves to the Wayback capture of 24 October 2023, which preserves the title (THE BABYLON MIGRATION LIVE STREAM), the uploader (Ociswap) and the 28 September 2023 upload date. The uploader is now named on the page, since a community stream was reading as an official Radix source. nofollow dropped from that anchor.", now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
