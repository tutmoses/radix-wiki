// scripts/sweep-358-developers-hub-links.mjs
//
// Wikilinks the Developers hub prose. The article had been carrying its
// vocabulary unlinked — blueprint, subintents, mainnet, manifests, sharding —
// while the wiki holds a page for each of them. Wikipedia's rule applies: link
// the FIRST mention of a term in the article, not every one, which is why
// "blueprint" is linked in the Introduction and left plain in the two later
// sections that repeat it.
//
// The link directory blocks are deliberately untouched: their items already
// carry an external link each, and a second link per line would be clutter.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'developers';
const SENTINEL = '/contents/tech/core-concepts/blueprints-and-packages';

const W = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;

// [blockId, find, replace] — find strings are matched exactly and must occur once.
const EDITS = [
  // Introduction
  ['8aa40f36-4747-4199-b60f-6fc64087595f',
    'On Radix the engine owns the asset.',
    `On Radix the ${W('/contents/tech/core-protocols/radix-engine', 'engine')} owns the ${W('/contents/tech/core-concepts/asset-oriented-programming', 'asset')}.`],
  ['8aa40f36-4747-4199-b60f-6fc64087595f',
    'and a blueprint that tries to lose it',
    `and a ${W('/contents/tech/core-concepts/blueprints-and-packages', 'blueprint')} that tries to lose it`],

  // Where to start
  ['528b266d-032e-4d35-a4ca-10974d114109',
    'and then mainnet.',
    `and then ${W('/contents/tech/releases/radix-mainnet-babylon', 'mainnet')}.`],
  ['528b266d-032e-4d35-a4ca-10974d114109',
    'Manifests are worth real time:',
    `${W('/contents/tech/core-protocols/transaction-manifests', 'Manifests')} are worth real time:`],
  ['528b266d-032e-4d35-a4ca-10974d114109',
    'in a form the wallet can show a user',
    `in a form the ${W('/contents/tech/core-protocols/radix-wallet', 'wallet')} can show a user`],

  // Agents
  ['2925fce2-36d7-4270-9eac-3cee7d955399',
    'for software that acts on its own behalf.',
    `for ${W('/contents/tech/core-concepts/radix-for-ai-agents', 'software that acts on its own behalf')}.`],
  ['2925fce2-36d7-4270-9eac-3cee7d955399',
    'Radix&rsquo;s subintents make that pattern',
    `Radix&rsquo;s ${W('/contents/tech/core-concepts/subintents-and-pre-authorizations', 'subintents')} make that pattern`],
  ['2925fce2-36d7-4270-9eac-3cee7d955399',
    'without holding the XRD to pay the network fee.',
    `without holding the ${W('/contents/tech/core-protocols/xrd-token', 'XRD')} to pay the ${W('/developers/transactions/03-transaction-fees', 'network fee')}.`],

  // What to expect
  ['4cf09bd2-cdd3-41da-9f08-386e5962be07',
    '<p>Scrypto is Rust,',
    `<p>${W('/contents/tech/core-protocols/scrypto-programming-language', 'Scrypto')} is Rust,`],
  ['4cf09bd2-cdd3-41da-9f08-386e5962be07',
    'most of what a Solidity audit looks for',
    `most of what a ${W('/contents/tech/comparisons/radix-vs-ethereum', 'Solidity')} audit looks for`],
  ['4cf09bd2-cdd3-41da-9f08-386e5962be07',
    'no approve-and-drain,',
    `no ${W('/contents/tech/core-concepts/native-assets-vs-token-approvals', 'approve-and-drain')},`],
  ['4cf09bd2-cdd3-41da-9f08-386e5962be07',
    'a blueprint was not authorized to mint',
    `a blueprint was not ${W('/contents/tech/core-concepts/access-rules-and-auth-zones', 'authorized')} to mint`],

  // Hyperscale
  ['b88b6bb1-123a-4a22-bc3e-d77b3f2f02e7',
    'the in-progress sharded execution layer for Radix&rsquo;s Xi&rsquo;an release',
    `the in-progress ${W('/contents/tech/core-concepts/sharding', 'sharded')} execution layer for Radix&rsquo;s ${W('/contents/tech/releases/radix-mainnet-xian', 'Xi&rsquo;an')} release`],
  ['b88b6bb1-123a-4a22-bc3e-d77b3f2f02e7',
    'run a purpose-built VM written from scratch',
    `run a purpose-built ${W('/contents/tech/core-protocols/vm-layer', 'VM')} written from scratch`],
];

// The one prose fix, keyed on the block that holds the "For agents" heading.
const PROSE = [
  ['section covers the wiki&rsquo;s own coverage of this; these are the endpoints and indexes themselves.',
   'section covers these in depth; what follows are the endpoints and indexes themselves.'],
];

// A find-string carrying U+00A0 where the stored HTML has a normal space (or the
// reverse) silently matches nothing and the script still exits 0.
for (const [, find] of EDITS) {
  if ([...find].some(ch => ch.charCodeAt(0) === 0xA0)) throw new Error(`find-string carries U+00A0: ${find}`);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG, '')) throw new Error('developers hub is LOCKED');
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, '']);
  if (!rows.length) throw new Error('developers hub not found');
  const page = rows[0];

  if (JSON.stringify(page.content).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const blocks = JSON.parse(JSON.stringify(page.content));
  const byId = new Map(blocks.filter(b => b.type === 'content').map(b => [b.id, b]));
  let linksAdded = 0;

  for (const [id, find, replace] of EDITS) {
    const block = byId.get(id);
    if (!block) throw new Error(`block ${id} not found`);
    const hits = block.text.split(find).length - 1;
    if (hits !== 1) throw new Error(`"${find.slice(0, 60)}" matched ${hits}x in ${id}, expected 1`);
    block.text = block.text.replace(find, replace);
    linksAdded += replace.split('<a href=').length - 1;
  }

  for (const [find, replace] of PROSE) {
    const block = blocks.find(b => b.type === 'content' && b.text?.includes(find));
    if (!block) throw new Error(`prose fix target not found: ${find.slice(0, 50)}`);
    block.text = block.text.replace(find, replace);
  }

  const version = '2.0.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  ${DRY ? '[dry] ' : ''}${linksAdded} wikilinks added across ${new Set(EDITS.map(e => e[0])).size} blocks, 1 sentence rewritten`);
  for (const [, , replace] of EDITS) {
    for (const m of replace.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)) console.log(`      ${m[2].padEnd(38)} -> ${m[1]}`);
  }

  if (DRY) process.exit(0);

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
     'Wikilink the hub prose: blueprint, asset, engine, mainnet, manifests, wallet, subintents, XRD, network fee, Scrypto, Solidity, approve-and-drain, authorized, sharded, Xi’an, VM. First mention only, per article. Also fixes the "covers the wiki’s own coverage" sentence under For agents.', now]);
  await client.query('COMMIT');
  console.log('  committed');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
