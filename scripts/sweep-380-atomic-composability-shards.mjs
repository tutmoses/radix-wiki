// scripts/sweep-380-atomic-composability-shards.mjs — run 380 (contents/tech rotation).
//
// /contents/tech/core-concepts/atomic-composability told readers, in the present
// tense, that "Cerberus braids consensus across any number of shards for a single
// transaction, maintaining atomicity at any scale". This wiki's own
// /contents/tech/core-protocols/cerberus-consensus-protocol (v6.1.1) states the
// opposite of the running network: Babylon mainnet runs Cerberus unsharded, one
// shard group covering the whole ledger, "and the braiding machinery is inactive
// because there is nothing to braid"; braiding "has never run in production"; and
// the Xi'an production candidate uses a HotStuff-2 two-chain commit per shard
// rather than braiding. Two pages in the same category, contradicting each other,
// on the page a reader reaches first.
//
// This rewrites the Cross-Shard Atomicity section so the page distinguishes what
// the network does today from what the specification describes.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'atomic-composability';
const SENTINEL = 'Braiding has never run in production';
const OLD_HEAD = '<h3>Cross-Shard Atomicity</h3>';

const NEW_SECTION =
  '<h3>Cross-Shard Atomicity</h3>\n' +
  '<p>The atomicity described above is a property of the network as it runs today, in which ' +
  '<a href="/contents/tech/core-protocols/cerberus-consensus-protocol">Cerberus</a> operates <strong>unsharded</strong>: ' +
  'a single shard group covering the whole ledger, where every transaction is settled by one consensus instance and ' +
  'nothing has to be coordinated across shards at all.</p>\n' +
  '<p>Cerberus was specified to carry the same guarantee into a sharded network, by braiding consensus across only the ' +
  'shards a transaction touches rather than settling cross-shard operations through an asynchronous bridge. That remains ' +
  'a specification. Braiding has never run in production, on Radix or anywhere else, and the ' +
  '<a href="/contents/tech/releases/radix-mainnet-xian">Xi’an</a> production candidate does not implement it either ' +
  '– it commits per shard with a two-chain HotStuff-2 protocol, its lead developer having argued that braiding makes ' +
  'shards co-dependent for liveness. Cross-shard atomic composability on Radix is therefore a design target rather than ' +
  'a property of a live network, and any claim that Radix already preserves atomicity "at any scale" is a claim about ' +
  'the whitepaper, not about mainnet.</p>';

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const target = blocks.find((b) => (b.text || '').includes(OLD_HEAD));
  if (!target) throw new Error('Cross-Shard Atomicity heading not found');
  const cut = target.text.indexOf(OLD_HEAD);
  if (target.text.slice(cut).includes('<h2>')) throw new Error('unexpected content after the section');
  target.text = target.text.slice(0, cut) + NEW_SECTION;

  const version = '2.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  replaced ${page.content.find((b) => (b.text || '').includes(OLD_HEAD)).text.length - cut} chars with ${NEW_SECTION.length}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Correct the Cross-Shard Atomicity section, which contradicted this wiki’s own Cerberus page. Babylon mainnet runs Cerberus unsharded, braiding has never run in production, and the Xi’an candidate commits per shard with two-chain HotStuff-2. Rewritten to separate what the network does today from what the specification describes.',
       now],
    );
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
