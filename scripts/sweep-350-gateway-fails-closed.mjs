import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 350 (developers rotation). During the 31 August 2026 network halt the public
// Gateway stopped answering state queries entirely: every /state, /stream and
// /transaction/construction call returns HTTP 500 NotSyncedUpError once the Gateway's
// database is more than 720 seconds behind the ledger. Probed 2026-09-01T23:08:58Z.
const TAG_PATH = 'developers/infrastructure';
const SLUG = '02-radix-apis';
const SENTINEL = 'NotSyncedUpError';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2>What the Gateway Does When the Ledger Stops</h2>
<p>The Gateway is not a passive mirror of the ledger. It refuses to answer a state query once its own database has fallen too far behind, and it names the threshold in the error it returns. That behaviour became observable for the first time on 1 September 2026, during the network halt that followed the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain</a>: mainnet committed its last round at 21:19:06 UTC on 31 August, and the public Gateway at <code>mainnet.radixdlt.com</code> spent the following day answering almost nothing.</p>
<p>Probed at 23:08:58 UTC on 1 September 2026, twenty-five hours and fifty minutes after the last committed round:</p>
<table><thead><tr><th>Endpoint</th><th>Response</th></tr></thead><tbody>
<tr><td><code>/status/gateway-status</code></td><td>200 – returns the frozen ledger state itself</td></tr>
<tr><td><code>/status/network-configuration</code></td><td>200 – static network metadata</td></tr>
<tr><td><code>/transaction/preview</code></td><td>200 – full receipt, simulated against the frozen state</td></tr>
<tr><td><code>/transaction/construction</code></td><td>500 <code>NotSyncedUpError</code> (<code>request_type: Construction</code>)</td></tr>
<tr><td><code>/state/entity/details</code></td><td>500 <code>NotSyncedUpError</code> (<code>request_type: Read</code>)</td></tr>
<tr><td><code>/state/validators/list</code></td><td>500 <code>NotSyncedUpError</code></td></tr>
<tr><td><code>/stream/transactions</code></td><td>500 <code>NotSyncedUpError</code></td></tr>
</tbody></table>
<p>The error body carries the rule rather than leaving it to the documentation: <code>current_sync_delay_seconds: 92992</code> against <code>max_allowed_sync_delay_seconds: 720</code>. Twelve minutes is the whole tolerance. Past it, a read fails rather than returning a value the Gateway can no longer vouch for.</p>
<div data-callout="warning"><div><p data-callout-title>A halted network is an error, not a stale number</p><p>A dApp reading balances through the public Gateway does not degrade gracefully to yesterday's figures when consensus stops – it degrades to HTTP 500. Frontends that only handle network failures and empty result sets will surface an unexplained crash. Read <code>details.type</code> and treat <code>NotSyncedUpError</code> as its own state, with <code>current_sync_delay_seconds</code> as the number to show the user.</p></div></div>
<p>Two exceptions are worth knowing. <code>/status/gateway-status</code> keeps answering because the stale ledger state <em>is</em> its payload – it is how you measure the outage, and it is what tells you the epoch has not moved. And <code>/transaction/preview</code> keeps answering with a complete receipt, because an <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Engine</a> simulation runs against whatever state the node holds and needs no freshness guarantee. During a halt you can still dry-run a manifest against the exact ledger as it stood at the final committed round; you simply cannot build a real transaction against it, because the epoch that would go in the header is the one endpoint the Gateway will not serve.</p>`;

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
    console.log('  already applied — no write');
    process.exit(0);
  }

  const at = blocks.findIndex((b) => (b.text || '').includes('<h2><a href="https://docs.radixdlt.com/docs/network-gateway"'));
  if (at < 0) throw new Error('Gateway API section not found — anchor changed');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '1.6.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (insert at index ${at + 1}, ${blocks.length} blocks)`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Add "What the Gateway Does When the Ledger Stops": during the 31 August 2026 halt every /state, /stream and /transaction/construction call on mainnet.radixdlt.com returns HTTP 500 NotSyncedUpError past a 720-second sync ceiling, while /status/gateway-status and /transaction/preview keep answering. Probed 2026-09-01T23:08:58Z.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
