// scripts/sweep-378-delay-x-handle-gone.mjs
//
// Run 375b added the token's on-ledger social_urls handle and closed the sentence
// with "the ledger cannot be asked the second question" - whether anyone is still
// behind it. The ledger cannot, but the web can, and this run's ecosystem link
// check asked: x.com/delayonradix answers HTTP 404.
//
// Written as the measurement rather than as a verdict. X's own 404 body says the
// account "may be private, deleted, or only available on the app", so this page
// says the profile is not reachable, not that it was deleted. The control matters
// and is recorded: x.com/radixdlt and x.com/RadixWiki both answered 200 to the
// same request in the same minute, so this is not X blocking the checker.
//
//   node scripts/sweep-378-delay-x-handle-gone.mjs --dry-run
//   node scripts/sweep-378-delay-x-handle-gone.mjs
//
// Idempotent: exits clean if the sentinel is already present.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'delay';
const VERSION = '1.2.1';
const SENTINEL = 'User Profile Not Found';
const DRY = process.argv.includes('--dry-run');

const OLD =
  'That field records what was written to the ledger, not whether anyone still posts there, and the ledger cannot be asked the second question.';
const NEW =
  'That field records what was written to the ledger, not whether anyone still posts there, and the ledger cannot be asked the second question. '
  + 'The web can. Requested at 19:12 UTC on 6 September 2026, <a href="https://x.com/delayonradix" target="_blank" rel="noopener">x.com/delayonradix</a> '
  + 'answered <strong>HTTP 404</strong> on X&rsquo;s &ldquo;User Profile Not Found&rdquo; page, while <code>x.com/radixdlt</code> answered 200 to the same request '
  + 'in the same minute &mdash; so the profile is genuinely absent rather than a bot wall. X&rsquo;s own body says such an account &ldquo;may be private, deleted, '
  + 'or only available on the app&rdquo;, which is as far as this goes: the one channel the ledger names for DELAY cannot be read on the web, and the ledger has no way to update the pointer.';

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
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const target = blocks.find((b) => (b.text || '').includes(OLD));
  if (!target) throw new Error('anchor sentence not found');
  target.text = target.text.replace(OLD, NEW);
  assertLinkShapes(blocks);

  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  if (DRY) { console.log('  ' + NEW.slice(0, 300) + ' ...'); process.exit(0); }

  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'patch', AUTHOR_ID,
      'Answer the question run 375b left open. The X handle the resource metadata names answers HTTP 404 on '
      + 'X’s own "User Profile Not Found" page, with x.com/radixdlt returning 200 to the same request in the '
      + 'same minute as a control, so this is absence and not a bot wall. Recorded as the measurement: X allows '
      + 'private, deleted or app-only, and the page claims no more than that.', now]);
  await client.query('COMMIT');
  console.log('  written');
} catch (e) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('  FAILED:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
