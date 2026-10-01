// sweep-514-recycled-handles-reread.mjs
//
// Run 514, contents/resources rotation. The 17 September section of
// /contents/resources/recycled-telegram-handles closes by naming two things to
// re-read on the next pass: whether Telegram's restriction on four channels
// holds, and whether @WhyNotXRD is still unregistered. Both were re-read on
// 1 October 2026 through MTProto (contacts.ResolveUsername + channels.GetFullChannel
// + messages.GetHistory) and the Gateway (state/entity/details, epoch 345,651):
// nothing has changed. This records the reading and the date.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/resources';
const SLUG = 'recycled-telegram-handles';
const SENTINEL = 'Both were re-read on 1 October 2026';
const DRY = process.argv.includes('--dry-run');

const PARA = `<p>${SENTINEL} through the same API, and neither has changed. The four restrictions hold; the seven other channels still hold one subscriber and two posts each; and <code>@WhyNotXRD</code> is still unregistered, while the WHY token still publishes it in both metadata fields at mainnet epoch 345,651. The DELIVER token's <code>social_urls</code> are unchanged as well, so a wallet that renders either token's socials still sends its reader to a withdrawn channel or to a username anyone can claim.</p>`;

const INFOBOX_EDITS = [
  ['<td>11, swept 1, 20 and 30 August and 17 September 2026</td>',
   '<td>11, swept 1, 20 and 30 August, 17 September and 1 October 2026</td>'],
  ['<td>4 of 11, read 17 September 2026</td>',
   '<td>4 of 11, read 17 September and 1 October 2026</td>'],
  ['<td>1, 20 and 30 August and 17 September 2026</td>',
   '<td>1, 20 and 30 August, 17 September and 1 October 2026</td>'],
];

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

  const table = blocks[0].type === 'infobox' ? blocks[0].blocks[0] : null;
  if (!table) throw new Error('block 0 is not the infobox');
  for (const [from, to] of INFOBOX_EDITS) {
    if (!table.text.includes(from)) throw new Error(`infobox cell not found: ${from}`);
    table.text = table.text.replace(from, to);
  }

  const section = blocks.find((b) => b.text?.includes('Telegram restricted four of the eleven'));
  if (!section) throw new Error('17 September section not found');
  if (!section.text.trimEnd().endsWith('is still free.</p>')) throw new Error('17 September section does not end where expected');
  section.text = `${section.text.trimEnd()}\n${PARA}`;

  const version = '1.4.1';
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
       'Re-read the eleven handles through MTProto and the DELIVER and WHY token metadata through the Gateway on 1 October 2026, as the 17 September section asked: the four Telegram restrictions hold, the seven other channels are unchanged, @WhyNotXRD is still unregistered and both tokens still publish the same handles.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
