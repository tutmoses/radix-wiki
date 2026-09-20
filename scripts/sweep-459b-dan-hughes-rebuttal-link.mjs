import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

// Run 459b: two fixes to the Controversies section run 459 landed. Hughes' rebuttal
// was a thread of his own and is citable, so name and link it rather than calling it
// "a companion thread"; and NXT's ledger started on 24 November 2013, seven weeks
// before the scam thread opened, not the two months the section claims.
const TAG_PATH = 'contents/history';
const SLUG = 'dan-hughes';
const BLOCK_ID = '45d764ca-28dc-4daf-ae4c-feaa73a47a8f';
const SENTINEL = 'Official Rebuttal of claims made against my person';

const EXT = 'target="_blank" rel="noopener noreferrer nofollow" class="link"';
const REBUTTAL = 'https://web.archive.org/web/20160320043455/https://bitcointalk.org/index.php?topic=419529.0;all';

const REPLACEMENTS = [
  ['<p>Hughes answered on 17 January, in a companion thread a supporter then quoted back into this one. To the first charge',
   `<p>Hughes answered on 17 January in a thread of his own, <a ${EXT} href="${REBUTTAL}">"Official Rebuttal of claims made against my person and the eMunie project"</a>, which a supporter quoted back into the first. To the first charge`],
  ['Supporters of NXT, a competing project launched two months before the thread opened, posted in it throughout.',
   'Supporters of NXT, a competing ledger launched in November 2013, posted in it throughout.'],
];

const DRY = process.argv.includes('--dry-run');
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
  const block = blocks.find((b) => b.id === BLOCK_ID);
  if (!block) throw new Error('controversies block not found');
  if (block.text.includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }
  for (const [from, to] of REPLACEMENTS) {
    if (!block.text.includes(from)) throw new Error(`missing: ${from.slice(0, 60)}`);
    block.text = block.text.replace(from, to);
  }

  const version = '4.1.1';
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
       'Name and link the thread Hughes answered the 2014 scam allegation in, "Official Rebuttal of claims made against my person and the eMunie project" (37 posts, Wayback snapshot of 20 March 2016; the live URL is behind Cloudflare), instead of calling it a companion thread. NXT started its ledger on 24 November 2013, seven weeks before the scam thread opened, so say November 2013 rather than two months.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
