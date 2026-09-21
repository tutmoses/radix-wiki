// sweep 466 (developers rotation) — /developers/frontend/04-dapp-definition-and-verification
//
// The page carried a section written in the future tense about an event that is
// now 23 days in the past: "Stokenet is wiped at 07:00 UTC on Saturday 29 August
// 2026". The wipe happened. Rewritten in the past tense and anchored to the
// ledger rather than to the announcement: the current Stokenet ledger's first
// timestamped round is 11:47:06 UTC on 29 August 2026 at epoch 3, read from
// /stream/transactions (order asc), and the network stood at epoch 6,876 /
// state version 11,740,045 at 08:52:38 UTC on 21 September 2026, read from
// /status/gateway-status.
//
// Two smaller corrections in the same pass:
//   - the stokenet-console.radixdlt.com HTTP 530 note was dated 14 August; the
//     host still answers 530, so the check is re-dated rather than removed.
//   - External Links named console.radixdlt.com, which now answers HTTP 302 to
//     console.radixscan.io — the host the page's own body and infobox already
//     use. Repointed, with the redirect stated.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'developers/frontend';
const SLUG = '04-dapp-definition-and-verification';
const SENTINEL = '11:47:06';

const OLD_RESET = `<h3>The 29 August 2026 Stokenet reset breaks one half of this</h3><p>Stokenet is wiped at 07:00&nbsp;UTC on <strong>Saturday 29 August 2026</strong> (<a href="https://t.me/radix_dlt/998662" target="_blank" rel="noopener">announced 18 August</a>; terms on the <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> page). The handshake described above is two-sided, and the reset takes exactly one side:</p><ul><li><strong>The ledger side is destroyed.</strong> dApp Definition accounts keep their addresses &ndash; those are derived from your keys &ndash; but the metadata that makes one a definition is stored state, so <code>account_type</code>, <code>name</code>, <code>claimed_websites</code> and <code>claimed_entities</code> are all gone. The account reverts to an ordinary one. The packages and components it claimed are gone too, and re-publishing gives them new addresses, so <code>claimed_entities</code> cannot simply be re-entered from your notes.</li><li><strong>The website side survives.</strong> <code>/.well-known/radix.json</code> lives on your own origin, not on the ledger, and nothing touches it. If you keep the same dApp Definition account, the file stays correct and needs no edit &ndash; which is a reason to reuse that account rather than create a fresh one after the reset.</li></ul><p>On-ledger <a href="/contents/tech/core-protocols/personas" rel="noopener">persona</a> data is destroyed as well, so a tester who had connected to your dApp recreates their persona before they can connect again. Mainnet definitions are untouched.</p>`;

const NEW_RESET = `<h3>The 29 August 2026 Stokenet reset took one half of this</h3><p>Stokenet was wiped at 07:00&nbsp;UTC on <strong>Saturday 29 August 2026</strong> (<a href="https://t.me/radix_dlt/998662" target="_blank" rel="noopener">announced 18 August</a>; terms on the <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> page), and the ledger serving Stokenet today begins there rather than carrying anything across. Its first timestamped round is 11:47:06&nbsp;UTC on 29 August 2026, at epoch 3, and the network stood at epoch 6,876 and state version 11,740,045 at 08:52:38&nbsp;UTC on 21 September 2026 &ndash; both read from the <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway</a>, the first from <code>/stream/transactions</code> ordered ascending and the second from <code>/status/gateway-status</code>. The handshake described above is two-sided, and the reset took exactly one side:</p><ul><li><strong>The ledger side went.</strong> dApp Definition accounts keep their addresses &ndash; those are derived from your keys &ndash; but the metadata that makes one a definition is stored state, so <code>account_type</code>, <code>name</code>, <code>claimed_websites</code> and <code>claimed_entities</code> did not survive. Such an account is an ordinary one again. The packages and components it claimed went too, and re-publishing gives them new addresses, so <code>claimed_entities</code> cannot simply be re-entered from your notes.</li><li><strong>The website side survived.</strong> <code>/.well-known/radix.json</code> lives on your own origin, not on the ledger, and nothing touched it. If you kept the same dApp Definition account, the file is still correct and needs no edit &ndash; which was the reason to reuse that account rather than create a fresh one.</li></ul><p>On-ledger <a href="/contents/tech/core-protocols/personas" rel="noopener">persona</a> data went as well, so a tester who had connected to your dApp before the reset recreates their persona first. Mainnet definitions were untouched.</p>`;

const OLD_CONSOLE_NOTE = `(<code>stokenet-console.radixdlt.com</code> returns HTTP 530, checked 14 August 2026)`;
const NEW_CONSOLE_NOTE = `(<code>stokenet-console.radixdlt.com</code> still returns HTTP 530, re-checked 21 September 2026)`;

const OLD_LINK = `<li><a href="https://console.radixdlt.com/" target="_blank" rel="noopener">Radix Developer Console</a></li>`;
const NEW_LINK = `<li><a href="https://console.radixscan.io/" target="_blank" rel="noopener">RadixScan Developer Console</a> &ndash; the Mainnet console; <code>console.radixdlt.com</code> answers HTTP 302 to it (checked 21 September 2026)</li>`;

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
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const edits = [[OLD_RESET, NEW_RESET], [OLD_CONSOLE_NOTE, NEW_CONSOLE_NOTE], [OLD_LINK, NEW_LINK]];
  for (const [from, to] of edits) {
    let hit = 0;
    for (const b of blocks) {
      if (typeof b.text === 'string' && b.text.includes(from)) { b.text = b.text.replace(from, to); hit++; }
    }
    if (hit !== 1) throw new Error(`expected 1 match, got ${hit}, for: ${from.slice(0, 70)}`);
    console.log(`  matched: ${from.slice(0, 70)}…`);
  }

  const version = '1.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'The 29 August Stokenet reset section was still written as an upcoming event. Rewritten in the past tense and anchored to the ledger: the current Stokenet ledger’s first timestamped round is 11:47:06 UTC on 29 August 2026 at epoch 3, and it stood at epoch 6,876 / state version 11,740,045 at 08:52:38 UTC on 21 September 2026. Also re-dated the stokenet-console.radixdlt.com 530 (still 530 on 21 September) and repointed the External Links console entry to console.radixscan.io, which console.radixdlt.com now 302s to.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
