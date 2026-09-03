// scripts/sweep-360-wikilink-false-positives.mjs
//
// Nine of the 154 links from sweep 359 landed on the wrong sense of a word.
// The term map cannot tell a Radix `component` from a web component, a Radix
// `resource` from the HTTP resource an x402 client requests, or a Radix `badge`
// from the crates.io build badges in a README — and `\b` boundaries let it link
// the tail of a crate name, so `radixdlt-rola` rendered as radixdlt-[rola].
//
// Each is unlinked here by exact context. Where the page uses the term correctly
// somewhere else, the link moves there rather than being lost; where it does not
// (the term only ever appears in the wrong sense on that page), it just goes.
//
// The same contexts are added to sweep 359's NEGATIVE_CONTEXTS so a later run
// over changed content cannot reintroduce them.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;

// [tagPath, slug, [ [find, replace], ... ], note]
const FIXES = [
  ['developers/ai-agents', 'ai-agents-and-x402', [
    [`requests a ${A('/contents/tech/core-concepts/resources', 'resource')}; the server replies`,
     'requests a resource; the server replies'],
  ], 'HTTP resource, not a Radix resource'],

  ['developers/ai-agents', 'igentix', [
    [`the server returns the ${A('/contents/tech/core-concepts/resources', 'resource')}.`,
     'the server returns the resource.'],
  ], 'HTTP resource, not a Radix resource'],

  ['developers/ai-agents', 'radix-context', [
    // This page writes its dashes as literal U+2013, not &ndash; — the entity
    // form silently matched nothing and the script still exited 0.
    [`<strong>radix-${A('/contents/tech/core-concepts/subintents-and-pre-authorizations', 'SubIntents')}</strong> \u2013 Composable partial transactions`,
     `<strong>radix-SubIntents</strong> \u2013 ${A('/contents/tech/core-concepts/subintents-and-pre-authorizations', 'composable partial transactions')}`],
  ], 'was splitting the context-file name; link moves to the description'],

  ['developers/frontend', '01-radix-dapp-toolkit', [
    [`a framework-agnostic web ${A('/contents/tech/core-concepts/components', 'component')} that handles`,
     'a framework-agnostic web component that handles'],
    ['read balances, component state, and transaction status',
     `read balances, ${A('/contents/tech/core-concepts/components', 'component')} state, and transaction status`],
  ], 'web component (custom element); link moves to "component state"'],

  ['developers/infrastructure', '01-running-a-node', [
    [`<th>${A('/contents/tech/core-concepts/resources', 'Resource')}</th><th>Minimum</th>`,
     '<th>Resource</th><th>Minimum</th>'],
  ], 'hardware-requirements table header'],

  ['developers/infrastructure', 'radixdlt-rust-sdk', [
    [`<strong>radixdlt-${A('/developers/frontend/03-rola-authentication', 'rola')}</strong>`,
     '<strong>radixdlt-rola</strong>'],
    ['verifies responses (notably ROLA proofs)',
     `verifies responses (notably ${A('/developers/frontend/03-rola-authentication', 'ROLA')} proofs)`],
    [`the crates.io and docs.rs ${A('/contents/tech/core-concepts/badges', 'badges')} above it`,
     'the crates.io and docs.rs badges above it'],
  ], 'crate-name split, and README build badges'],

  ['developers/scrypto', '02-resources-and-nfts', [
    [`like showing an ID ${A('/contents/tech/core-concepts/badges', 'badge')} without handing it over`,
     'like showing an ID badge without handing it over'],
  ], 'physical ID badge in an analogy'],

  ['developers/frontend', '04-dapp-definition-and-verification', [
    [`receives HTML instead of the ${A('/contents/tech/core-protocols/transaction-manifests', 'manifest')}.`,
     'receives HTML instead of the manifest.'],
  ], 'the dApp-definition JSON, not a transaction manifest'],
];

for (const [, , pairs] of FIXES) {
  for (const [find] of pairs) {
    if ([...find].some(ch => ch.charCodeAt(0) === 0xA0)) throw new Error(`find-string carries U+00A0: ${find}`);
  }
}

const walk = (blocks, fn) => blocks?.forEach(b => {
  if (b.type === 'infobox') return walk(b.blocks, fn);
  if (b.type === 'columns') return b.columns?.forEach(c => walk(c.blocks, fn));
  if (typeof b.text === 'string') fn(b);
});

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  const now = new Date().toISOString();
  let pagesTouched = 0, applied = 0, alreadyDone = 0;

  for (const [tagPath, slug, pairs, note] of FIXES) {
    if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
    if (!rows.length) throw new Error(`${tagPath}/${slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));

    const done = [];
    for (const [find, replace] of pairs) {
      let hits = 0;
      walk(blocks, (b) => {
        const n = b.text.split(find).length - 1;
        if (!n) return;
        hits += n;
        b.text = b.text.split(find).join(replace);
      });
      if (hits === 0) { alreadyDone++; continue; }
      if (hits > 1) throw new Error(`"${find.slice(0, 50)}" matched ${hits}x in ${tagPath}/${slug}`);
      done.push(find);
    }
    if (!done.length) continue;

    const [maj, min, patch] = page.version.split('.').map(Number);
    const version = `${maj}.${min}.${patch + 1}`;
    pagesTouched++; applied += done.length;
    console.log(`  ${DRY ? '[dry] ' : ''}/${tagPath}/${slug}  v${page.version} -> v${version}  ${done.length} fix${done.length === 1 ? '' : 'es'}  (${note})`);

    if (DRY) continue;
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       `Correct a wikilink on the wrong sense of a word: ${note}.`, now]);
    await client.query('COMMIT');
  }

  console.log(`\n  ${DRY ? '[dry] ' : ''}${applied} corrections across ${pagesTouched} pages${alreadyDone ? `, ${alreadyDone} already applied` : ''}`);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
