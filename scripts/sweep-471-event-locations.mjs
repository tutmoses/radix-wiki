import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Two gatherings whose venue was stated in the prose and never recorded in
// metadata. `location` is a required property on schema.org Event, so until it
// is set the page emits an Event that Google rejects and the infobox omits the
// row. Both values below are read off each page's own text, not supplied.
const TAG_PATH = 'contents/history';
const DRY = process.argv.includes('--dry-run');

const EDITS = [
  {
    slug: 'brunel-hack-25',
    // "…organized by the Brunel Society of Blockchain and held at the university campus in Uxbridge."
    location: 'Brunel University, Uxbridge',
  },
  {
    slug: 'dapp-in-a-day-workshop-5',
    // "LOCATION: SMU ESports Arena, Waldegrave Road, Twickenham, TW1 4SX"
    location: 'SMU ESports Arena, Waldegrave Road, Twickenham, TW1 4SX',
  },
];

const MESSAGE = 'Recorded the venue each page already named in its own text, so the Location row renders and the schema.org Event carries the `location` property it requires. Until now both pages emitted an Event with a startDate and no place, which is invalid structured data; Semrush flagged one of them and the other was outside its 100-page crawl.';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const { slug, location } of EDITS) {
    if (isLockedPage(TAG_PATH, slug)) throw new Error(`${slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, metadata, content::text AS txt FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, slug]);
    if (!rows.length) throw new Error(`page not found: ${slug}`);
    const page = rows[0];
    const metadata = page.metadata || {};

    if (metadata.location) {
      console.log(`  ${slug}: already has a location (${metadata.location}) - no write`);
      continue;
    }
    // The venue must be the page's own, not one supplied here: assert the
    // distinguishing part of the string appears in the stored article.
    const anchor = location.split(',')[0];
    if (!page.txt.includes(anchor)) throw new Error(`${slug}: "${anchor}" is not in the page text`);

    const next = { ...metadata, location };
    const [maj, min, pat] = String(page.version).split('.').map(Number);
    const version = `${maj}.${min}.${pat + 1}`;
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}\n      v${page.version} -> v${version}   location = ${location}`);

    if (!DRY) {
      const now = new Date().toISOString();
      await client.query('BEGIN');
      await client.query('UPDATE pages SET metadata=$1, version=$2, updated_at=$3 WHERE id=$4',
        [JSON.stringify(next), version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         SELECT $1, id, content, $2, $3, $4, $5, $6, $7 FROM pages WHERE id = $8`,
        [cuid(), page.title, version, 'patch', AUTHOR_ID, MESSAGE, now, page.id]);
      await client.query('COMMIT');
      console.log('      written');
    }
  }
} finally {
  client.release();
  await pool.end();
}
