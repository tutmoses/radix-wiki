import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const TAG_PATH = 'blog';
const SLUG = 'radix-is-florence';
const EXPECT = '2.4.0';
const VERSION = '2.4.1';
const SENTINEL = '2022-biggest-year-ever-for-crypto-hacking';
const FROM = 'set against $3bn of 2022 hacks. Read that against';
const TO = `set against $3bn of 2022 hacks. <a href="https://www.chainalysis.com/blog/${SENTINEL}/" target="_blank" rel="noopener">Chainalysis</a> counts $3.8bn stolen from crypto businesses that year, 82% of it from DeFi protocols and, within that, 64% from cross-chain bridges. Read that against`;
const message = 'Sweep 448: the dated-claim row now sources the 2022 hack total the essay cites. Chainalysis counts $3.8bn stolen from crypto businesses in 2022, 82.1% of it from DeFi protocols, and 64% of the DeFi total from cross-chain bridges. The essay text is unchanged.';

if (new RegExp('[\\u00a0\\u2014]').test(TO + message)) throw new Error('script contains a U+00A0 or an em dash');

const textNodes = (blocks) => blocks.flatMap((b) => [...(typeof b.text === 'string' ? [b] : []), ...(b.blocks ? textNodes(b.blocks) : [])]);

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

  const hits = textNodes(blocks).filter((n) => n.text.includes(FROM));
  if (hits.length !== 1) throw new Error(`expected 1 match, found ${hits.length}`);
  hits[0].text = hits[0].text.replace(FROM, TO);

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
