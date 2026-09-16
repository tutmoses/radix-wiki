// sweep 442 – developers rotation. Two pages checked against source on 16 September 2026.
//
// 1. /developers/scrypto/01-fundamentals carried two claims run 429 banked as unverified.
//    "Reentrancy: Impossible – resources move, not references" gives the wrong mechanism. The engine
//    blocks reentry by locking component state: radixdlt-scrypto v1.4.0
//    radix-engine-tests/tests/blueprints/reentrancy.rs expects OpenSubstateError::SubstateLocked when
//    either the outer or the inner call takes &mut self, and a commit when both take &self.
//    "overflow bugs are prevented at the runtime level" is not an engine rule: Decimal's Add is
//    checked_add(..).expect("Overflow") (radix-common/src/math/decimal.rs), and plain integers are
//    checked only because radix-clis/assets/template/Cargo.toml_template sets overflow-checks = true.
// 2. /developers/frontend/02-gateway-sdk said the Gateway's last release was v1.10.6 (7 April) and its
//    last commit a docs-only one on 20 May. v1.10.7 shipped 7 September 2026 (PR #842): SystemVersion
//    gains V4 and V5 in the Core API spec copy. In scrypto v1.4.0 system_callback.rs, V4 is
//    dugong_for_previous_parameters and V5 eagle_ray_for_previous_parameters; Dugong was skipped on
//    mainnet (babylon-node PR #1076). POST mainnet.radixdlt.com/status/gateway-status at 15:09 UTC
//    16 September: image_tag v1.10.7, open_api_schema_version v1.10.6. npm still 1.10.1.
//    Also fixes a missing comma in the historical-state example.
//
// Run:  node scripts/sweep-442-developers-engine-and-gateway.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const L = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;
const SCRYPTO = 'https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0';

function rep(blocks, id, find, replace) {
  const b = blocks.find((x) => x.id === id);
  if (!b) throw new Error(`block ${id} not found`);
  const n = b.text.split(find).length - 1;
  if (n !== 1) throw new Error(`block ${id}: expected 1 match, found ${n}: ${find.slice(0, 80)}`);
  b.text = b.text.replace(find, () => replace);
}

function set(blocks, id, text) {
  const b = blocks.find((x) => x.id === id);
  if (!b) throw new Error(`block ${id} not found`);
  b.text = text;
}

const GATEWAY_MAINTENANCE = [
  `<h2>Maintenance Status (checked September 2026)</h2>`,
  `<p>The SDK and the service it talks to are released separately. ${A('https://www.npmjs.com/package/@radixdlt/babylon-gateway-api-sdk', 'The client library')} has been at <strong>1.10.1</strong> since March 2025. It is a generated client over the Gateway API, and that API has not changed since: on 16 September 2026 the public mainnet Gateway reported its API schema as v1.10.6.</p>`,
  `<p>The ${A('https://github.com/radixdlt/babylon-gateway', 'Gateway service')} shipped ${A('https://github.com/radixdlt/babylon-gateway/releases/tag/v1.10.7', '<strong>v1.10.7</strong>')} on 7 September 2026, four days before the ${L('/contents/tech/releases/protocol-updates', 'Eagle Ray protocol update')} was enacted on mainnet. Its one code change ${A('https://github.com/radixdlt/babylon-gateway/pull/842', 'adds V4 and V5')} to <code>SystemVersion</code>, the value the Gateway reads from a node to learn which version of the engine's system logic is running. In the engine's source, ${A(`${SCRYPTO}/radix-engine/src/system/system_callback.rs`, 'V4 belongs to Dugong and V5 to Eagle Ray')}. Mainnet went from V3 straight to V5, because Dugong was skipped. The public mainnet Gateway runs the v1.10.7 build. The release changes nothing the SDK calls, so dApps need no client update for it.</p>`,
  `<p>Since 7 August 2026 the Gateway has been ${A('https://t.me/RadixDevelopers/65908', 'maintained on a volunteer basis with bug fixes only')}, alongside the ${L('/developers/frontend/01-radix-dapp-toolkit', 'dApp Toolkit')} and the ${L('/contents/tech/core-protocols/radix-wallet', 'Radix Wallet')}. The practical consequence is about hosting rather than code. The public Gateway this SDK defaults to is ${L('/ecosystem/radix-foundation', 'Foundation')}-operated infrastructure in maintenance mode, and it sits at the top of the ${L('/ecosystem/radix-accountability-council', 'Accountability Council')}'s inventory of services a community DAO would need to take over. If your dApp cannot tolerate that dependency, run your own Gateway or use a third-party provider – see ${L('/developers/infrastructure/02-radix-apis', 'Radix APIs')}.</p>`,
].join('\n');

const EDITS = [
  {
    tagPath: 'developers/scrypto',
    slug: '01-fundamentals',
    version: '1.5.0',
    changeType: 'minor',
    sentinel: 'SubstateLocked',
    message: 'Reentrancy and overflow checked against radixdlt-scrypto v1.4.0. The engine blocks reentry by locking component state (SubstateLocked when either call writes; two reads are allowed), not because resources move. Overflow is caught by Decimal arithmetic and by overflow-checks in the package template, not by the engine.',
    apply(blocks) {
      rep(blocks, 'ed3124a4-a19c-4cd6-8822-5ca0d79d2281',
        '<td>Impossible – resources move, not references</td>',
        `<td>Blocked by the engine: a call back into a component fails with ${A(`${SCRYPTO}/radix-engine-tests/tests/blueprints/reentrancy.rs`, '<code>SubstateLocked</code>')} if either call writes its state; two calls that only read are allowed</td>`);
      rep(blocks, '9fc2a22f-5211-4cbf-95f8-6dde70bbee63',
        '<li><strong>The engine enforces safety</strong> – reentrancy, double-spend, and overflow bugs are prevented at the runtime level</li>',
        `<li><strong>The engine enforces resource safety</strong> – a resource cannot be copied, and a component cannot be re-entered while its state is being written</li><li><strong>Overflow is caught by the code, not the engine</strong> – ${A(`${SCRYPTO}/radix-common/src/math/decimal.rs`, '<code>Decimal</code> arithmetic')} panics on overflow, and the ${A(`${SCRYPTO}/radix-clis/assets/template/Cargo.toml_template`, 'package template')} that <code>scrypto new-package</code> writes sets <code>overflow-checks = true</code> for plain integers, a setting a package can turn off</li>`);
    },
  },
  {
    tagPath: 'developers/frontend',
    slug: '02-gateway-sdk',
    version: '1.4.0',
    changeType: 'minor',
    sentinel: 'releases/tag/v1.10.7',
    message: 'Gateway v1.10.7 (7 September 2026) added the SystemVersion values for Dugong (V4) and Eagle Ray (V5); the public mainnet Gateway runs it, and its API schema is still v1.10.6, so the 1.10.1 SDK needs no update. Fixed a missing comma in the historical-state example.',
    apply(blocks) {
      set(blocks, '5535a546-319d-470d-aba4-126cfa1e1439', GATEWAY_MAINTENANCE);
      rep(blocks, '95a30310-608f-4cda-93d6-96562e78f530',
        "addresses: ['account_rdx1...']\n",
        "addresses: ['account_rdx1...'],\n");
    },
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }
    const blocks = JSON.parse(JSON.stringify(page.content));
    e.apply(blocks);
    const json = JSON.stringify(blocks);
    if (!json.includes(e.sentinel)) throw new Error(`${e.slug}: sentinel missing after apply`);
    console.log(`  ${DRY ? '[dry] ' : ''}${e.tagPath}/${e.slug}  v${page.version} -> v${e.version}  (${JSON.stringify(page.content).length} -> ${json.length} chars)`);
    if (DRY) continue;
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content = $1, version = $2, updated_at = $3 WHERE id = $4', [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
