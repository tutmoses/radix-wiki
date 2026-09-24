import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-vm';
const EXPECT = '1.0.0';
const VERSION = '1.1.0';
const SENTINEL = 'transformed at genesis';
const EXT = 'target="_blank" rel="noopener"';
const ANCHOR = 'while replacing the layers beneath them.</p>';

const para = `<p>Asked in the channel on 24 September how Babylon would move onto the new engine, the lead developer <a href="https://t.me/hyperscale_rs/12978" ${EXT}>answered</a> that all ledger data, accounts and assets included, would be ${SENTINEL}, and that developers might need to rebuild their contracts, which he expected to need some social coordination but not to be difficult. He <a href="https://t.me/hyperscale_rs/12983" ${EXT}>said</a> there is no point sizing the migration until the engine is closer to stable, and that building on Babylon in the meantime <a href="https://t.me/hyperscale_rs/12990" ${EXT}>still makes sense</a>, since most of a dApp's code is not contract code.</p>`;

const message = 'Sweep 478: Relationship to the Radix Engine and Scrypto gains the lead developer\'s 24 September answer in the hyperscale_rs channel on migration (t.me/hyperscale_rs/12978, 12983, 12990): ledger data including accounts and assets transformed at genesis, contracts possibly rebuilt, no sizing until the engine stabilises, and building on Babylon meanwhile still worthwhile.';

if (new RegExp('[\\u00a0\\u2014]').test(para + message)) throw new Error('script contains a U+00A0 or an em dash');

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

  const hits = blocks.filter((b) => typeof b.text === 'string' && b.text.includes(ANCHOR));
  if (hits.length !== 1) throw new Error(`expected 1 anchor, found ${hits.length}`);
  hits[0].text = hits[0].text.replace(ANCHOR, `${ANCHOR}\n${para}`);

  console.log(`  ${DRY ? '[dry] ' : ''}${TAG_PATH}/${SLUG}  v${page.version} -> v${VERSION}  (minor, +${para.length} chars)`);
  if (DRY) process.exit(0);

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, message, now]);
  await client.query('COMMIT');
} finally {
  client.release();
  await pool.end();
}
