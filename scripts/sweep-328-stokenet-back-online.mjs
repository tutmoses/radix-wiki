import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/releases';
const SLUG = 'stokenet';
const SENTINEL = 'Back online, 29 August 2026';

const NEW_SECTION = `
<h3>Back online, 29 August 2026</h3>
<p>The network came back the same afternoon. A developer reported it reachable at <a href="https://t.me/RadixDevelopers/66078" target="_blank" rel="noopener">12:02&nbsp;UTC</a>, and fifty minutes later <a href="/community/daffy" rel="noopener">Daffy</a> <a href="https://t.me/RadixDevelopers/66079" target="_blank" rel="noopener">declared Stokenet back online</a> &ndash; having waited for a fourth validator, run by <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a>&rsquo;s Timan, to come up. He invited the channel to <a href="https://t.me/RadixDevelopers/66084" target="_blank" rel="noopener">try deploying packages</a> and noted that the <a href="https://t.me/RadixDevelopers/66083" target="_blank" rel="noopener">genesis transactions are visible</a> on the fresh ledger. Total downtime was a little under six hours against the &ldquo;several hours&rdquo; forecast.</p>
<p>Read directly from the Gateway at <strong>15:05&nbsp;UTC on 29 August 2026</strong>, <code>babylon-stokenet-gateway.radixdlt.com</code> answers <strong>HTTP&nbsp;200</strong> on node release <code>v1.10.6</code> &ndash; the same release it served before the reset &ndash; at <strong>epoch 51</strong> and state version <strong>137,506</strong>. Set against the pre-reset read of epoch 254,681 and state version 424,218,910 eleven days earlier, that is the whole of the discarded history in two numbers.</p>
<h4>The restarted validator set</h4>
<p>Four validators are registered and no more, each carrying the placeholder metadata a fresh genesis writes &ndash; name <code>Default validator 1</code> through <code>4</code>, <code>info_url</code> pointing at <code>radixdlt.com</code> &ndash; and each holding about <strong>1,000,035,860 test XRD</strong> at a <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">fee factor</a> of 1, which is 100%. Their addresses and secp256k1 keys, read at the same moment, are the record this page can offer against the next reset:</p>
<table>
<tbody>
<tr><td><strong>Default validator 1</strong></td><td><code>validator_tdx_2_1sdtnujyn3720ymg8lakydkvc5tw4q3zecdj95akdwt9de362mvtd94</code></td></tr>
<tr><td><strong>Default validator 2</strong></td><td><code>validator_tdx_2_1sdvlm4e2x0mjr7mxkpfejz8m0tfwk0j937lxsw74t9lw3evhj5tlwk</code></td></tr>
<tr><td><strong>Default validator 3</strong></td><td><code>validator_tdx_2_1svr6rmtd9ts5zx8d3euwmmp6mmjdtcj2q7zlmd8xjrn4qx7q5snkas</code></td></tr>
<tr><td><strong>Default validator 4</strong></td><td><code>validator_tdx_2_1sdlkptcwjpajqawnuya8r2mgl3eqt89hw27ww6du8kxmx3thmyu8l4</code></td></tr>
</tbody>
</table>
<p>Whether these are the keys the 18 August announcement promised or the new ones the 10:00&nbsp;UTC update described cannot be settled from the ledger, because the ledger that held the old set was discarded. The one pre-reset Stokenet validator address still recoverable anywhere &ndash; <code>validator_tdx_2_1svff7mk&hellip;</code>, from a <a href="https://web.archive.org/web/20250830104810/https://stokenet-dashboard.radixdlt.com/network-staking/validator_tdx_2_1svff7mkddhm9dy325f3ckx72cxqsl49ewy74667pchqfkxl7wxpa8r/stake" target="_blank" rel="noopener">dashboard page archived on 30 August 2025</a> &ndash; returns no entity on the reset ledger, and is not one of the four above. That is consistent with a new set of keys without proving it, since it cannot be shown to have been one of the four the announcement meant. Daffy has said he will <a href="https://t.me/RadixDevelopers/66080" target="_blank" rel="noopener">write up the details</a>, and that write-up is what will resolve it.</p>
<h4>The ledger restarts before Bottlenose</h4>
<p>The first thing developers found is the sharpest fact of the day. Publishing works: a package went on the reset ledger at <strong>epoch 33</strong>, 13:56&nbsp;UTC, about an hour after the network came back, and the <em>Digital Ownership Licence</em> resource and component deployed from it are live and readable. But anything referencing the <strong>AccountLocker</strong> native package is <a href="https://t.me/RadixDevelopers/66088" target="_blank" rel="noopener">rejected with <code>ReferencedNodeDoesNotExist</code></a>, as though it were not on the ledger.</p>
<p>It is not. Read at 15:09&nbsp;UTC, <code>package_tdx_2_1pkgxxxxxxxxxlckerxxxxxxxxxx000208064247xxxxxxxxx8jnpz0</code> returns no entity, while the account, pool and transaction-tracker native packages all return normally. AccountLocker arrived with <a href="/contents/tech/releases/protocol-updates" rel="noopener">Bottlenose</a>, so the reset network has restarted at the protocol state that preceded it, and the protocol updates have to be enacted again on the new ledger before the packages they introduced exist. The Gateway does not yet reflect this: its own <code>/status/network-configuration</code> still advertises <code>locker_package</code> at the address that answers with nothing. Until those updates land, a well-known address is not a guarantee that the entity behind it is there &ndash; which is a narrower version of the &ldquo;all well-known addresses unchanged&rdquo; promise in the terms above than the terms imply.</p>
`.trim();

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

  // 1. rewrite the operational note at the head of block 1 (reset is over)
  const intro = blocks.find((b) => (b.text || '').includes('Operational note, 29 August 2026'));
  if (!intro) throw new Error('operational note block not found');
  const noteStart = intro.text.indexOf('<p><em>Operational note');
  const noteEnd = intro.text.indexOf('</em></p>', noteStart);
  if (noteStart !== 0 || noteEnd < 0) throw new Error('operational note bounds not found');
  const newNote = '<p><em>Operational note, 29 August 2026: the full Stokenet reset is <strong>done</strong>. The network went down at 07:00&nbsp;UTC on Saturday 29 August 2026 and was declared back online at 12:52&nbsp;UTC, on a fresh genesis with four validators. Every balance, transaction and deployed package from before is gone; the network ID, the Gateway URL and your account addresses are unchanged. Note that the ledger has restarted at a protocol state before Bottlenose, so the AccountLocker native package does not yet exist. The terms, the reset-day record and what a developer has to redo are in the &ldquo;Full reset&rdquo; section below.</em></p>';
  intro.text = newNote + intro.text.slice(noteEnd + '</em></p>'.length);

  // 2. append the new subsection to the reset section
  const reset = blocks.find((b) => (b.text || '').includes('Full reset &ndash; 29 August 2026'));
  if (!reset) throw new Error('reset section block not found');
  reset.text = reset.text.trimEnd() + '\n' + NEW_SECTION + '\n';

  const version = '1.6.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  blocks.forEach((b, i) => {
    const before = page.content[i].text || '';
    const after = b.text || '';
    if (before !== after) console.log(`  block[${i}] ${b.type}: ${before.length} -> ${after.length} B`);
  });
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Stokenet is back: declared online 12:52 UTC 29 Aug, verified live at epoch 51 / state version 137,506 on v1.10.6. Records the four restarted validators with addresses and keys, and the finding that the reset ledger starts before Bottlenose - the AccountLocker package returns no entity while the Gateway still advertises its well-known address. First redeployed package committed at epoch 33.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
