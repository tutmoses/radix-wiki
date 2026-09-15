import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const TAG_PATH = 'contents/resources/legal';
const SLUG = 'acceptable-use-policy';
const EXPECT = '1.2.0';
const VERSION = '1.2.1';
const SENTINEL = 'on the shared <a href="/ideas"';

const FROM = 'a page can be deleted outright by the contributor who created it, and deleting it';
const TO = 'a page can be deleted outright by the contributor who created it, or, on the shared <a href="/ideas" rel="noopener">ideas board</a>, by any contributor allowed to edit it, and deleting it';

const message = 'Sweep 436: the policy said a page can be deleted only by the contributor who created it. The DELETE handler in src/app/api/wiki/[[...path]]/route.ts also lets anyone who clears the edit bar delete a card on a shared path, and SHARED_PATHS in src/lib/tags.ts is the ideas board. Added that case. The rest of Interactive Services was checked against the code on 15 September 2026 and holds: comments deletable by their author alone, revisions and comments cascade with the page (prisma/schema.prisma), restore gated on edit rights, uploads JPEG/PNG/GIF/WebP/AVIF up to 25 MB re-encoded to WebP at 1,600 px (src/lib/images.ts).';

if (new RegExp('[\\u00a0\\u2014]').test(JSON.stringify({ FROM, TO, message }))) throw new Error('script contains a U+00A0 or an em dash');

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied, no write');
    process.exit(0);
  }
  if (page.version !== EXPECT) throw new Error(`expected v${EXPECT}, found v${page.version}`);

  const hits = blocks.reduce((n, b) => n + ((b.text ?? '').split(FROM).length - 1), 0);
  if (hits !== 1) throw new Error(`expected 1 match, found ${hits}`);
  for (const b of blocks) if (typeof b.text === 'string') b.text = b.text.split(FROM).join(TO);

  console.log(`  ${DRY ? '[dry] ' : ''}${TAG_PATH}/${SLUG}  v${page.version} -> v${VERSION}  (patch)`);
  if (DRY) process.exit(0);

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'patch', AUTHOR_ID, message, now]);
  await client.query('COMMIT');
} finally {
  client.release();
  await pool.end();
}
