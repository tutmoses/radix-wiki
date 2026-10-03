// Sweep 525: /blog/radix-is-what-web3-noobs-think-they-bought, 3 Oct 2026. Blog staleness head
// (verified 1 Sep). The infobox "Dated claim" row said Xi'an "is now expected to replace the
// Radix Engine with a purpose-built VM under the hyperscale-rs programme". That stopped being
// true on 3 Sep 2026, when the hyperscale-rs developer withdrew from Radix funding and the RFC
// terms lapsed; /contents/tech/releases/radix-mainnet-xian (v3.1.1) now says Xi'an has no
// current release date and Radix is one candidate network among several. The essay text is
// the author's and stays as written; only the editorial row moves.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'blog';
const SLUG = 'radix-is-what-web3-noobs-think-they-bought';
const SENTINEL = 'Xi&rsquo;an has no current release date';
const OLD = 'The execution layer it describes has since moved: Xi&rsquo;an is now expected to replace the Radix Engine with a purpose-built VM under the <a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a> programme';
const NEW = 'The execution layer it describes has since moved: in August 2026 <a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a>, then the candidate to deliver <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi&rsquo;an</a>, dropped the Radix Engine for a purpose-built VM, and in September its developer withdrew from Radix funding. Xi&rsquo;an has no current release date';

const DRY = process.argv.includes('--dry-run');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) { console.log('  already applied, no write'); process.exit(0); }
  const blocks = JSON.parse(JSON.stringify(page.content));
  const box = blocks[0].blocks[0];
  if (!box.text.includes(OLD)) throw new Error('dated-claim text not found');
  box.text = box.text.replace(OLD, NEW);
  if (/—| /.test(NEW)) throw new Error('em dash or nbsp in new text');

  const version = '2.6.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (DRY) console.log(box.text);
  if (!DRY) {
    const json = JSON.stringify(blocks);
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
        'Sweep 525: the infobox Dated claim row said Xi\'an is now expected to replace the Radix Engine under hyperscale-rs. The developer withdrew from Radix funding on 3 Sep 2026 and Xi\'an has no current release date (see radix-mainnet-xian). Row updated; essay text unchanged.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
