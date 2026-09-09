import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 393, contents/tech rotation, staleness head. /contents/tech/core-concepts/
// byzantine-fault-tolerance was last touched on 22 July 2026 and carries no
// last_verified_at at all. It is also one of the last pages on this wiki that
// still states braiding in the present tense: "uniquely braids consensus across
// shards" and "This lets Radix keep the classic one-third fault tolerance while
// preserving atomic composability across a sharded state space". Fifteen other
// pages carry the correction - mainnet runs Cerberus unsharded, which makes it
// the original HotStuff with nothing to braid, and no implementation of the
// braided protocol has ever run. This page missed that pass.

const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'byzantine-fault-tolerance';
const SENTINEL = 'the braiding machinery has nothing to braid';
const DRY = process.argv.includes('--dry-run');

const OLD_1 = 'Radix\'s <a href="/contents/tech/core-protocols/cerberus-consensus-protocol">Cerberus</a> is a BFT protocol that uniquely braids consensus across shards, achieving both fault tolerance and <a href="/contents/tech/core-concepts/atomic-composability">atomic composability</a> in a sharded environment.';
const NEW_1 = 'Radix\'s <a href="/contents/tech/core-protocols/cerberus-consensus-protocol">Cerberus</a> is a BFT protocol specified to braid consensus across shards, so that fault tolerance and <a href="/contents/tech/core-concepts/atomic-composability">atomic composability</a> survive sharding together. Mainnet runs it as a single unsharded instance, where the braiding machinery has nothing to braid.';

const OLD_2 = 'its innovation is <em>braiding</em> many parallel consensus instances so that a single transaction touching multiple shards is agreed atomically. This lets Radix keep the classic one-third fault tolerance while preserving <a href="/contents/tech/core-concepts/atomic-composability">atomic composability</a> across a sharded state space – the property most sharded designs give up.';
const NEW_2 = 'its stated innovation is <em>braiding</em> many parallel consensus instances so that a single transaction touching multiple shards is agreed atomically. The intent is to keep the classic one-third fault tolerance while preserving <a href="/contents/tech/core-concepts/atomic-composability">atomic composability</a> across a sharded state space – the property most sharded designs give up.</p>\n<p>That second half remains a specification. Mainnet runs one shard group covering the whole ledger, which the node’s own <a href="https://github.com/radixdlt/babylon-node/blob/main/README.md" target="_blank" rel="noopener">README</a> describes as <q>a variant implementation of the HotStuff BFT-style consensus</q>, and the braided cross-shard protocol has never run in production on Radix or anywhere else. The <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi’an</a> production candidate does not braid either: it commits per shard with a two-chain HotStuff-2 protocol, its lead developer having argued that braiding makes shards co-dependent for liveness. The one-third bound described above is the part that holds in every case; it is a property of the BFT family, not of braiding.';

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

  const over = blocks.find((b) => b.type === 'content' && b.text?.includes(OLD_1));
  if (!over) throw new Error('overview sentence not found');
  over.text = over.text.replace(OLD_1, NEW_1);

  const rad = blocks.find((b) => b.type === 'content' && b.text?.includes(OLD_2));
  if (!rad) throw new Error('Radix section sentence not found');
  rad.text = rad.text.replace(OLD_2, NEW_2);

  const version = '1.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  block ${over.id}: ${page.content.find((b) => b.id === over.id).text.length} -> ${over.text.length} chars`);
  console.log(`  block ${rad.id}: ${page.content.find((b) => b.id === rad.id).text.length} -> ${rad.text.length} chars`);

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
       'Braiding put back into the tense the rest of the wiki uses. The page claimed Cerberus "uniquely braids consensus across shards" and that this "lets Radix keep" fault tolerance and atomic composability under sharding; mainnet runs Cerberus as one unsharded instance, equivalent to the original HotStuff, and the braided cross-shard protocol has never run in production, on Radix or elsewhere. Adds the node README as the source for the unsharded equivalence and notes that Xi\'an commits per shard with HotStuff-2 rather than braiding. The one-third bound, which is the page\'s subject, is unaffected.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
