// sweep 438c - corrects the last sentence sweep 438 wrote on /ecosystem/ociswap. It said DefiLlama
// "carries total value locked and no volume series, so the figure does not reach it", inferred from
// api.llama.fi/protocol/ociswap, which returns a tvl series and nothing else. DefiLlama's volume
// lives on a different endpoint and the protocol page does show it. Opened in the browser pane,
// 15 September 2026: defillama.com/protocol/ociswap gives "DEX Volume 30d $63,486" and TVL $71,826.
// api.llama.fi/summary/dexs/ociswap the same day: total24h 2,864, total7d 7,585, total30d 63,486,
// totalAllTime 90,548,404.21, chains ["Radix"]. Ociswap's own endpoint gives USD 7d
// 7964062686389.640664 and USD total 197407369519864.620450, so DefiLlama is building its own series
// rather than reading the exchange's aggregate. The conclusion stands; the reason was wrong.
//
// Run:  node scripts/sweep-438c-ociswap-defillama-fix.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');

const TAG_PATH = 'ecosystem';
const SLUG = 'ociswap';
const VERSION = '3.2.1';
const SENTINEL = 'builds its own Ociswap volume series';

const MESSAGE =
  'Corrects the sentence sweep 438 wrote an hour earlier. It said DefiLlama carries no volume series for Ociswap, inferred from api.llama.fi/protocol/ociswap, which returns tvl alone. DefiLlama publishes volume on a separate endpoint and shows it on the protocol page: opened in a browser on 15 September 2026, defillama.com/protocol/ociswap gives DEX Volume 30d of 63,486 USD, and api.llama.fi/summary/dexs/ociswap gives 7,585 USD over seven days and 90,548,404 USD over the protocol life. The point the sentence was making holds and is now made from the figures: DefiLlama builds its own series rather than reading the exchange aggregate.';

const FROM = '<a href="https://defillama.com/protocol/ociswap" target="_blank" rel="noopener">DefiLlama’s Ociswap entry</a> carries total value locked and no volume series, so the figure does not reach it.';
const TO = '<a href="https://defillama.com/protocol/ociswap" target="_blank" rel="noopener">DefiLlama</a>, which builds its own Ociswap volume series rather than reading this endpoint, gives the exchange 7,585 USD of trading over the same seven days and 90.5m USD over its whole life, against the 7.96 trillion USD and 197 trillion USD the endpoint reports for the two periods.';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error(`${TAG_PATH}/${SLUG} not found`);
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  ociswap: already applied - no write');
    process.exit(0);
  }
  const block = blocks.find((b) => b.type === 'content' && typeof b.text === 'string' && b.text.includes(FROM));
  if (!block) throw new Error('sweep-438 defillama sentence not found');
  block.text = block.text.replace(FROM, TO);

  if ([0x2014, 0xa0].some((c) => TO.includes(String.fromCharCode(c)))) throw new Error('em dash or non-breaking space in new content');

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  console.log(`\n- ${FROM}\n+ ${TO}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content = $1, version = $2, updated_at = $3 WHERE id = $4',
      [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'patch', AUTHOR_ID, MESSAGE, now]);
    await client.query('COMMIT');
    console.log('\n  written');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
