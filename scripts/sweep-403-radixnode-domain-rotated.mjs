// Sweep 403 — the squatted radixnode.io domain has changed destination.
//
// The page's link-rot note, written 30 July 2026, names ninjafloki.io as where
// the lapsed domain now redirects. Read at 23:15 UTC on 10 September 2026 the
// 301 points somewhere else: luongsontv60.org, a Vietnamese free football
// streaming site. The warning is unchanged and the reason for it is stronger —
// the destination rotates, so naming one host dates the note.
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'radixnodeio';
const VERSION = '2.3.1';
const SENTINEL = 'luongsontv60.org';
const DRY = process.argv.includes('--dry-run');

const OLD = 'It resolves and returns HTTP 200, but redirects to <code>ninjafloki.io</code>, an unrelated sports-streaming site.';
const NEW = 'It resolves and returns HTTP 301, and where it sends a reader keeps changing: to <code>ninjafloki.io</code> when this was first checked on 30 July 2026, and to <code>luongsontv60.org</code>, a Vietnamese free football-streaming site, when re-checked at 23:15&nbsp;UTC on 10 September 2026. Both are unrelated to Radix, and a note naming one of them dates itself.';

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    return;
  }

  const target = blocks.find((b) => b.text?.includes(OLD));
  if (!target) throw new Error('link-rot note not matched — inspect the stored text before rerunning');
  target.text = target.text.replace(OLD, NEW);

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (note rewritten on ${target.id})`);
  if (DRY) return;

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'patch', AUTHOR_ID,
     'The lapsed radixnode.io domain now 301s to luongsontv60.org rather than ninjafloki.io (read 23:15 UTC, 10 September 2026). The note now records that the destination rotates instead of naming a single host.',
     now]);
  await client.query('COMMIT');
  console.log('  written');
});
