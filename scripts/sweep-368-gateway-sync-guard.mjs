import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/core-protocols';
const SLUG = 'radix-gateway-api';
const SENTINEL = 'What the Gateway does when it falls behind';

const OLD_INFOBOX_ROW = '<tr><td><strong>Target SLA</strong></td><td>99.9% uptime, <1s query latency</td></tr>';
const NEW_INFOBOX_ROW = OLD_INFOBOX_ROW +
  '<tr><td><strong>Staleness guard</strong></td><td>HTTP 500 <code>NotSyncedUpError</code> beyond 720s of ledger lag (mainnet)</td></tr>';

const SECTION = [
  '<h2 id="ledger-lag">' + SENTINEL + '</h2>',
  '<p>The Gateway answers from its own index rather than from a node’s live state, so it can fall behind the network. Rather than serve a stale answer it refuses to answer at all. <a href="https://github.com/radixdlt/babylon-gateway/blob/main/src/RadixDlt.NetworkGateway.PostgresIntegration/Services/LedgerStateQuerier.cs" target="_blank" rel="noopener"><code>LedgerStateQuerier</code></a> compares the timestamp of its own head against the clock and throws <a href="https://github.com/radixdlt/babylon-gateway/blob/main/src/RadixDlt.NetworkGateway.GatewayApi/Exceptions/NotSyncedUpException.cs" target="_blank" rel="noopener"><code>NotSyncedUpException</code></a> when the gap is too wide. The caller gets HTTP 500 with a <code>NotSyncedUpError</code> body naming <code>current_sync_delay_seconds</code> and <code>max_allowed_sync_delay_seconds</code>.</p>',
  '<p>The guard has two halves, separately configurable, both on by default at 30 seconds (<a href="https://github.com/radixdlt/babylon-gateway/blob/main/docs/configuration.md" target="_blank" rel="noopener">Gateway configuration reference</a>). <code>PreventReadRequestsIfDbLedgerIsBehind</code> covers the state and stream endpoints. <code>PreventConstructionRequestsIfDbLedgerIsBehind</code> covers <code>/transaction/construction</code>, and the source gives its reason: a construction request built against a stale index would use historic stake records, which gets an unstake calculation wrong. The Radix Foundation’s public mainnet Gateway runs both thresholds at 720 seconds.</p>',
  '<h3>What that looks like from a dApp</h3>',
  '<p>The mainnet <a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">halt that began on 31 August 2026</a> holds the guard open long enough to read it. Every endpoint below was called once at 03:10 UTC on 5 September 2026:</p>',
  '<table><tbody><tr><th>Endpoint</th><th>Response</th></tr>' +
    '<tr><td><code>/status/gateway-status</code></td><td>200, returning the frozen head: state version 557,840,622, epoch 339,896, round 102</td></tr>' +
    '<tr><td><code>/status/network-configuration</code></td><td>200</td></tr>' +
    '<tr><td><code>/state/entity/details</code></td><td>500, <code>request_type</code> <code>Read</code></td></tr>' +
    '<tr><td><code>/state/validators/list</code></td><td>500, <code>request_type</code> <code>Read</code></td></tr>' +
    '<tr><td><code>/stream/transactions</code></td><td>500, <code>request_type</code> <code>Read</code></td></tr>' +
    '<tr><td><code>/transaction/construction</code></td><td>500, <code>request_type</code> <code>Construction</code></td></tr>' +
    '</tbody></table>',
  '<p>All four failures reported <code>current_sync_delay_seconds</code> 366,663 against <code>max_allowed_sync_delay_seconds</code> 720. A wallet or dApp on this Gateway therefore connects, resolves the network, and then fails on every balance, history and submission call, with nothing wrong with the account or the key: the index will not answer for a ledger whose top it cannot see. The two status endpoints stay up throughout, which is what makes <code>/status/gateway-status</code> the place to check whether the network is moving.</p>',
].join('\n');

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  for (const [name, s] of [['NEW_INFOBOX_ROW', NEW_INFOBOX_ROW], ['SECTION', SECTION]]) {
    if (/\u00A0/.test(s)) throw new Error(`${name} contains U+00A0`);
    if (/—/.test(s)) throw new Error(`${name} contains an em dash`);
  }

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  const flat = JSON.stringify(blocks);
  if (flat.includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const ib = blocks[0].blocks?.[0];
  if (!ib || !ib.text.includes(OLD_INFOBOX_ROW)) throw new Error('infobox row not found');
  ib.text = ib.text.replace(OLD_INFOBOX_ROW, NEW_INFOBOX_ROW);
  blocks.push({ id: uid(), type: 'content', text: SECTION });

  const version = '1.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  blocks ${page.content.length} -> ${blocks.length}, new section ${SECTION.length} bytes`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       "New section on the Gateway's ledger-lag guard, which is what a dApp actually hits during the mainnet halt. Sourced to LedgerStateQuerier and NotSyncedUpException in radixdlt/babylon-gateway and to the configuration reference (PreventReadRequestsIfDbLedgerIsBehind and PreventConstructionRequestsIfDbLedgerIsBehind, both default true at 30s; mainnet runs 720s). Endpoint table measured in one pass at 03:10 UTC on 5 September 2026: both /status endpoints 200, every state, stream and construction call HTTP 500 at current_sync_delay_seconds 366,663.", now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
