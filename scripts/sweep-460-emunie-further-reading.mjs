import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

// Run 460: eMunie's Further Reading was four bare URLs as their own link text, two of
// them Bitcointalk threads that now answer 403 behind Cloudflare. Name what each one is
// and send the two threads to the Wayback snapshots that still serve them.
const TAG_PATH = 'contents/tech/research';
const SLUG = 'emunie';
const BLOCK_ID = 'dbe847aa-5d20-4fc4-9bab-5bfb0beb97c0';
const SENTINEL = 'Caution Advised';

const EXT = 'target="_blank" rel="noopener noreferrer nofollow" class="link"';
const LINKS = [
  ['https://www.reddit.com/r/eMunie/', 'r/eMunie on Reddit'],
  ['https://web.archive.org/web/20180208035335/https://bitcointalk.org/index.php?topic=411366.0;all',
   '"[SCAM ALERT] eMunie – Caution Advised" – Bitcointalk, January 2014'],
  ['https://web.archive.org/web/20160320043455/https://bitcointalk.org/index.php?topic=419529.0;all',
   '"Official Rebuttal of claims made against my person and the eMunie project" – Dan Hughes on Bitcointalk, January 2014'],
  ['https://www.newsbtc.com/sponsored/in-conversation-with-emunie-founder-dan-hughes/',
   '"In Conversation with eMunie Founder Dan Hughes" – newsBTC, October 2015, a sponsored interview'],
];

const FROM = '<h2>Further Reading</h2><ul>';
const LIST = LINKS.map(([href, label]) => `<li><p><a ${EXT} href="${href}">${label}</a></p></li>`).join('');

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
  if (!block) throw new Error('further-reading block not found');
  if (block.text.includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }
  const at = block.text.indexOf(FROM);
  if (at < 0) throw new Error('Further Reading heading not found');
  const end = block.text.indexOf('</ul>', at);
  if (end < 0) throw new Error('Further Reading list is unterminated');
  const old = block.text.slice(at + FROM.length, end);
  if ((old.match(/<li>/g) || []).length !== LINKS.length)
    throw new Error(`expected ${LINKS.length} items, found ${(old.match(/<li>/g) || []).length}`);
  block.text = block.text.slice(0, at + FROM.length) + LIST + block.text.slice(end);

  const version = '1.3.4';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  for (const [href, label] of LINKS) console.log(`    ${label.slice(0, 64)}\n      ${href}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       'Further Reading listed four bare URLs as their own link text, so a reader could not tell that two of them were the January 2014 scam-allegation thread and Dan Hughes\' rebuttal to it. Name all four. Bitcointalk answers 403 behind a Cloudflare challenge, so both threads now point at Wayback snapshots that serve the whole thread, and the newsBTC interview is labelled as the sponsored placement it is. The scam allegation and the rebuttal are set out on the Dan Hughes page.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
