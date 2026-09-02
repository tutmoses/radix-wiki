// scripts/sweep-352-buckets-vaults-deepen.mjs — run 352 (contents/tech rotation, staleness head)
//
// /contents/tech/core-concepts/buckets-proofs-and-vaults is the stalest page in the
// category (updated_at 30 June 2026) and one of the thinnest: a facts table and a single
// three-paragraph overview. It is also, since 31 August, the page whose subject matter
// decided an incident — the vault is a node with its own access rules, gated by roles
// defined on the resource rather than by the account holding it, and that is exactly the
// boundary the August 2026 drain crossed. Deepen the mechanics, cite the source, and
// give the page an External Links section it never had.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'buckets-proofs-and-vaults';
const SENTINEL = 'roles-not-accounts';
const DRY = process.argv.includes('--dry-run');

const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const SCRYPTO = 'https://github.com/radixdlt/radixdlt-scrypto/blob/v1.3.1';

const MECHANICS = {
  id: uid(),
  type: 'content',
  text:
    '<h2 id="roles-not-accounts">A vault answers to the resource, not to its holder</h2>' +
    '<p>The three containers are usually taught as storage classes, which understates what a vault is. ' +
    'A vault is a node in the engine\'s own state tree, created and owned by a component, holding exactly one ' +
    '<a href="/contents/tech/core-concepts/asset-oriented-programming" rel="noopener">resource</a> type. ' +
    'Its methods are not free functions on the owning component. They are blueprint methods, and each one is gated by a role that is defined on the <em>resource</em>. ' +
    'In ' + A(`${SCRYPTO}/radix-engine/src/blueprints/resource/fungible/fungible_vault.rs#L266-L273`, 'the fungible vault blueprint') +
    ' the map is explicit: <code>take</code>, <code>take_advanced</code> and <code>lock_fee</code> require the withdrawer role, <code>put</code> the depositor role, ' +
    '<code>recall</code> the recaller role, <code>burn</code> the burner role, and <code>freeze</code> and <code>unfreeze</code> the freezer role.</p>' +
    '<p>On a freely transferable token most of those roles are set open at creation, because a token nobody may withdraw is not a token. ' +
    'What protects a user\'s balance is therefore not the vault. It is the ' +
    '<a href="/contents/tech/core-protocols/smart-accounts" rel="noopener">account component</a> that holds the vault, whose own ' +
    '<a href="/contents/tech/core-concepts/access-rules-and-auth-zones" rel="noopener">access rules</a> put the owner badge in front of <code>withdraw</code>. ' +
    'A manifest reaches the vault by going through the account, and the account is where the check lives. ' +
    'The vault is the container; the component around it is the lock. Distinguishing the two matters for anyone writing a blueprint that stores other people\'s assets, ' +
    'because a vault handed out or reachable by another route carries no protection of its own.</p>' +
    '<p>Buckets are the other half of the same design. A bucket exists only for the length of a ' +
    '<a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">transaction</a>, cannot be written into component state, and must be empty or returned to a vault before the transaction finalizes. ' +
    'That single rule is what makes the ' + A('https://docs.radixdlt.com/docs/buckets-and-vaults', 'conservation guarantee') + ' checkable by the engine instead of by an auditor: ' +
    'a transaction that would lose, duplicate or strand a token fails at commit rather than succeeding quietly, and there is no path by which tokens become permanently stuck in a contract that forgot to implement a withdrawal. ' +
    'Proofs sit outside this flow entirely. A proof is evidence that some quantity of a resource is held, placed in an ' +
    '<a href="/contents/tech/core-concepts/access-rules-and-auth-zones" rel="noopener">auth zone</a> for the duration of a call and then dropped. ' +
    'It moves nothing, so presenting a badge to a method that demands one costs neither the badge nor a transfer.</p>',
};

const INCIDENT = {
  id: uid(),
  type: 'content',
  text:
    '<h2>When the boundary failed (August 2026)</h2>' +
    '<p>The distinction above stopped being academic on 31 August 2026. ' +
    'In the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain and network halt</a>, transactions took resources out of vaults belonging to other people ' +
    'without ever going through the accounts that held them. The engine\'s reference check accepted a vault named directly in a manifest as a valid direct-access reference on the strength of its blueprint alone, ' +
    'and once the caller held that reference, <code>take</code> was gated only by the resource\'s withdrawer role, which on a freely transferable token is open. ' +
    'The account\'s access rules were never consulted because the account was never called. ' +
    'The full account of the defect, with the source references, is on the ' +
    '<a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> page.</p>' +
    '<p>Nothing in the container model itself was broken by this. Conservation held, buckets still balanced, and no token was duplicated or destroyed. ' +
    'What failed was the assumption that a vault is only ever reachable through the component that owns it, which is the assumption everything above rests on.</p>',
};

const LINKS = {
  id: uid(),
  type: 'content',
  text:
    '<h2>External Links</h2><ul>' +
    '<li>' + A('https://docs.radixdlt.com/docs/resources', 'Radix Docs: Resources') + '</li>' +
    '<li>' + A('https://docs.radixdlt.com/docs/buckets-and-vaults', 'Radix Docs: Buckets and Vaults') + '</li>' +
    '<li>' + A('https://docs.radixdlt.com/docs/auth', 'Radix Docs: Auth, proofs and access rules') + '</li>' +
    '<li>' + A(`${SCRYPTO}/radix-engine/src/blueprints/resource/fungible/fungible_vault.rs`, 'radixdlt-scrypto v1.3.1: fungible_vault.rs') + '</li>' +
    '</ul>',
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
  if (!blocks.some((b) => (b.text || '').includes('<h2>Overview</h2>'))) throw new Error('Overview section not found');

  blocks.push(MECHANICS, INCIDENT, LINKS);

  const version = '1.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}`);
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
       'Deepens the stalest page in contents/tech from one overview block to four: a vault is a node whose methods are gated by roles defined on the resource (fungible_vault.rs L266-273), the account component around it is what actually protects a balance, the bucket rule is what makes conservation engine-checkable, and the August 2026 drain crossed exactly that boundary. Adds an External Links section.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
