// scripts/sweep-344-fox-on-the-halt.mjs — run 344 (community rotation)
//
// The community rotation's stalest substantive page, unedited since 18 August. On the
// night mainnet was halted, the person writing Radix's sharded successor said three
// things in public: that he was going to cash so Hyperscale development continues either
// way, that he would not think about a new network yet, and that nobody should move
// assets to Radix until the issue is patched because it is not limited to hAssets.
// Authorship of all three confirmed at the t.me embed, which names the message author.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'community';
const SLUG = 'flightofthefox';
const SENTINEL = 'not limited in scope to hAssets';
const DRY = process.argv.includes('--dry-run');

const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const SECTION = {
  id: uid(),
  type: 'content',
  text:
    '<h2>The night of the halt (31 August 2026)</h2>' +
    '<p>Radix mainnet was <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted by its node runners at 21:19 UTC on 31 August 2026</a>, ' +
    'after an afternoon in which a flaw in the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> was used to take assets out of vaults their owners had not opened. ' +
    'The engine in question is the one hyperscale-rs integrates today, and the channel spent the evening on it. Three of his own messages are worth recording, ' +
    'each timed and each confirmed as his at the message\'s public embed.</p>' +
    '<p>At 19:08 UTC, asked whether this was the end of Hyperscale and Radix, he ' +
    A('https://t.me/hyperscale_rs/11277', 'answered') + ': "that\'s not what i\'m saying. i\'m going to cash to make sure hyperscale development can continue in the short and medium term irrespective of what else happens." ' +
    'Five minutes later, asked whether he would start a new network if Radix did not recover, he ' +
    A('https://t.me/hyperscale_rs/11281', 'declined the question for now') + ': "there is enough happening at the minute without thinking about that... let\'s figure out what\'s going on first." ' +
    'At 21:02 UTC, seventeen minutes before the network stopped, he ' + A('https://t.me/hyperscale_rs/11286', 'gave the plainest advisory anyone gave that evening') + ': ' +
    '"i do not recommend any hyperscalers move any assets to radix until validators patch this issue. it is not limited in scope to hAssets." ' +
    'The second clause preceded by an hour the Foundation\'s own statement that any token or NFT on the network had been within reach of the same method.</p>' +
    '<p>Both halves bear on what this article is about. The funding remark answers, for the first time under real pressure, the key-man question the RFC put to the community itself; ' +
    'the advisory is the Xi\'an candidate\'s author telling people not to use the network his work is meant to succeed.</p>',
};

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
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied – no write');
    process.exit(0);
  }

  const links = blocks.findIndex((b) => (b.text || '').includes('<h2>External links</h2>'));
  if (links === -1) throw new Error('external links not found');
  blocks.splice(links, 0, SECTION);

  const version = '1.2.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}, inserted at ${links}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Adds his three public statements on the night of the 31 August network halt - funding continuity, no new network yet, and the advisory that the issue is not limited to hAssets - each timed and authorship-confirmed at the t.me embed.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
