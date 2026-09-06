// scripts/sweep-375-gateway-pinned-reads.mjs
//
// Since 31 August the wiki has recorded, correctly, that the Gateway answers HTTP
// 500 for state, history and construction while mainnet is halted, and the main
// Telegram channel has asked twice how a holder is supposed to find out whether
// they lost funds (backlog item from run 365, radix_dlt 1001881 and 1001898).
// Measured on 6 September the refusal turns out to cover only questions about the
// present. babylon-gateway's LedgerStateQuerier returns early - before the lag
// comparison - whenever the request pinned a ledger state instead of resolving the
// top of the ledger, so every read endpoint answers 200 when the call carries
// at_ledger_state. Construction still refuses, because its request has no such
// field to carry.
//
// Two edits: the mechanism on the Gateway API page, which already documents the
// guard and had the unpinned half only; and the usable answer on the drain page,
// which is where the readers asking the question actually arrive (517 of the
// wiki's 1,314 visitors over 7d).
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const SV = '557840622';

// ---------------------------------------------------------------- edit 1
const GW = { tagPath: 'contents/tech/core-protocols', slug: 'radix-gateway-api', version: '1.5.0' };
const GW_SENTINEL = 'id="pinned-reads"';
const GW_ANCHOR = 'which is what makes <code>/status/gateway-status</code> the place to check whether the network is moving.</p>';

const GW_ADDITION = `
<h3 id="pinned-reads">Reading around the guard</h3>
<p>The refusal covers questions about the present, and only those. <code>GetValidLedgerStateForReadRequest</code> resolves the ledger state the caller asked for before it does anything else, and the lag comparison sits behind an early return: <code>if (!ledgerStateReport.TopOfLedgerResolved) return ledgerState;</code>. <code>TopOfLedgerResolved</code> is set true on one branch only, the one taken when the request named no ledger state and the Gateway had to read its own head. A request that pins a state version, an epoch, an epoch and round, or a timestamp never reaches the threshold and cannot throw <a href="https://github.com/radixdlt/babylon-gateway/blob/main/src/RadixDlt.NetworkGateway.GatewayApi/Exceptions/NotSyncedUpException.cs" target="_blank" rel="noopener"><code>NotSyncedUpException</code></a>.</p>
<p>The halt makes that visible. Each endpoint below was called twice within two seconds at <strong>07:07:56 UTC on 6 September 2026</strong>, at a reported <code>current_sync_delay_seconds</code> of 467,332 against 720 &mdash; once as an ordinary request, once with <code>"at_ledger_state": {"state_version": ${Number(SV).toLocaleString('en-US')}}</code>, the last state version the ledger reached:</p>
<table><tbody><tr><th>Endpoint</th><th>Unpinned</th><th>Pinned</th></tr><tr><td><code>/state/entity/details</code></td><td>500</td><td><strong>200</strong></td></tr><tr><td><code>/state/validators/list</code></td><td>500</td><td><strong>200</strong>, 287 validators with stake vaults</td></tr><tr><td><code>/stream/transactions</code></td><td>500</td><td><strong>200</strong></td></tr><tr><td><code>/transaction/construction</code></td><td>500</td><td>500</td></tr></tbody></table>
<p>Construction is the exception and the source says why it is not an inconsistency: <code>GetValidLedgerStateForConstructionRequest</code> carries the identical early return, but the <code>/transaction/construction</code> request has no <code>at_ledger_state</code> field to fill, so the value is ignored, the Gateway resolves its own head, and the <code>Construction</code> guard fires as before. Nothing here lets a stopped network be transacted on; it lets a stopped network be read.</p>
<p>So the practical division during a halt is not between working and broken endpoints but between two questions. <em>What is true now</em> has no answer and the Gateway declines to invent one. <em>What was true at state version ${Number(SV).toLocaleString('en-US')}</em> has an answer, it is the last one the ledger produced, and the same public Gateway will serve it &mdash; balances, resource holdings and transaction history included. A dApp fails during a halt because it asks the first question; a caller willing to name a ledger state gets the second.</p>`;

// ---------------------------------------------------------------- edit 2
const DR = { tagPath: 'contents/history', slug: 'hyperlane-asset-drain-2026', version: '2.13.0' };
const DR_SENTINEL = 'id="reading-your-own-account"';

const DR_BLOCK = `<h2 id="reading-your-own-account">Reading your own account while the Gateway refuses</h2>
<p>The question most often asked in the Radix chat since the halt is not about the exploit. It is whether an individual account lost anything, and the ordinary way to find out does not work: <a href="https://dashboard.radixdlt.com" target="_blank" rel="noopener">dashboard.radixdlt.com</a> loads and then fails, because it reads the <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway API</a>, and the Gateway will not answer a question about the present while it is five days behind the network.</p>
<p>It will answer a question about the past. The <a href="/contents/tech/core-protocols/radix-gateway-api#pinned-reads" rel="noopener">guard is skipped for any request that names a ledger state</a>, so a read pinned to state version <strong>${Number(SV).toLocaleString('en-US')}</strong> &mdash; the last one the ledger reached, at 21:19:06.179 UTC on 31 August &mdash; returns 200 from the same endpoint that returns 500 unpinned. Verified at 07:07:56 UTC on 6 September 2026:</p>
<pre><code>curl -X POST https://mainnet.radixdlt.com/state/entity/details \\
  -H 'Content-Type: application/json' \\
  -d '{"addresses":["account_rdx1..."],
       "at_ledger_state":{"state_version":${SV}}}'</code></pre>
<p>The same pin works on <code>/stream/transactions</code>, which with an <code>affected_global_entities_filter</code> set to the account returns that account's own transaction history up to the halt &mdash; the record of whether anything left it, and when. Both calls need no key.</p>
<p>Two limits are worth stating plainly. This is the final pre-halt state and nothing more: it is the answer to <em>what did I hold when the network stopped</em>, not to <em>what do I hold now</em>, and the two will be the same only because nothing can move until the network restarts. And it reads; it does not write. <code>/transaction/construction</code> refuses pinned and unpinned alike, so no transaction can be built or submitted, which is the halt working as intended rather than a gap in it.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

async function load({ tagPath, slug }) {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
  if (!rows.length) throw new Error(`page not found: ${tagPath}/${slug}`);
  return rows[0];
}

async function commit(page, blocks, version, changeType, message) {
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (DRY) return;
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, changeType, AUTHOR_ID, message, now]);
  await client.query('COMMIT');
}

try {
  // ---- edit 1: the mechanism
  const gw = await load(GW);
  const gwBlocks = JSON.parse(JSON.stringify(gw.content));
  if (gwBlocks.some((b) => (b.text || '').includes(GW_SENTINEL))) {
    console.log('  gateway-api: already applied - no write');
  } else {
    const target = gwBlocks.find((b) => (b.text || '').includes(GW_ANCHOR));
    if (!target) throw new Error('gateway-api anchor not found - inspect before rerunning');
    target.text = target.text.replace(GW_ANCHOR, GW_ANCHOR + GW_ADDITION);
    await commit(gw, gwBlocks, GW.version, 'minor',
      'The NotSyncedUp guard covers only requests that resolve the top of the ledger: LedgerStateQuerier returns before the lag comparison when the caller pinned at_ledger_state. Measured 07:07:56 UTC 6 September at a 467,332s delay, /state/entity/details, /state/validators/list and /stream/transactions all answer 200 pinned to state version 557,840,622 while answering 500 unpinned; /transaction/construction refuses both, because its request carries no at_ledger_state field.');
  }

  // ---- edit 2: the usable answer, on the page readers reach
  const dr = await load(DR);
  const drBlocks = JSON.parse(JSON.stringify(dr.content));
  if (drBlocks.some((b) => (b.text || '').includes(DR_SENTINEL))) {
    console.log('  drain: already applied - no write');
  } else {
    const at = drBlocks.findIndex((b) => (b.text || '').includes('<h2>Where the assets went</h2>'));
    if (at < 0) throw new Error('drain insertion point not found - inspect before rerunning');
    drBlocks.splice(at, 0, { id: uid(), type: 'content', text: DR_BLOCK });

    const box = drBlocks[0];
    const inner = box.blocks?.[0];
    if (!inner) throw new Error('drain infobox not found');
    const oldRow = 'Still halted when re-read at 15:03:41 UTC, 5 September, one hundred and thirteen hours and forty-four minutes after the last round';
    if (!inner.text.includes(oldRow)) throw new Error('drain infobox status row not found - inspect before rerunning');
    inner.text = inner.text.replace(oldRow,
      'Still halted when re-read at 07:07:56 UTC, 6 September, one hundred and twenty-nine hours and forty-nine minutes after the last round');

    await commit(dr, drBlocks, DR.version, 'minor',
      'Adds the answer to the question the main Telegram channel has asked repeatedly since the halt: how an individual account can be read while dashboard.radixdlt.com fails. A Gateway read pinned to at_ledger_state 557,840,622 returns 200 where the unpinned read returns 500, for balances and for the account\'s own transaction history; construction refuses either way. Verified 07:07:56 UTC 6 September 2026. Infobox network-status row re-read to the same call.');
  }
} finally {
  client.release();
  await pool.end();
}
