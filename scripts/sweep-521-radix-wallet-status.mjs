// Sweep 521: Radix Wallet "Development status" re-read 2 Oct 2026. iOS's latest
// release is 1.22.1 (App Store, 11 Jun), not the 1.18.4 GitHub Releases still shows;
// the 30/31 Jul mnemonic fix has reached neither store; the Gateway shipped v1.10.7.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/core-protocols';
const SLUG = 'radix-wallet';
const BLOCK_ID = '8c3cff2c-b30a-4a8e-8855-0c53061bdc56';
const SENTINEL = 'Read on 2 October 2026';

const text = `<h2>Development status</h2>
<p>The wallet is no longer under active feature development. The <a href="https://www.radixdlt.com/blog/foundation-update-moving-to-maintenance-mode" target="_blank" rel="noopener">Radix Foundation moved to maintenance mode</a> on 28 April 2026, and the public repositories and app stores record what that has meant for the wallet and for the service it depends on. Read on 2 October 2026:</p>
<table><tbody>
<tr><th>Component</th><th>Most recent commit</th><th>Latest published release</th></tr>
<tr><td><a href="https://github.com/radixdlt/babylon-wallet-ios" target="_blank" rel="noopener">babylon-wallet-ios</a></td><td>30 July 2026 – <a href="https://github.com/radixdlt/babylon-wallet-ios/pull/1513" target="_blank" rel="noopener">"Handle missing local mnemonics during factor source access"</a></td><td>1.22.1 on the <a href="https://apps.apple.com/us/app/radix-wallet/id6448950995" target="_blank" rel="noopener">App Store</a> (11 June 2026)</td></tr>
<tr><td><a href="https://github.com/radixdlt/babylon-wallet-android" target="_blank" rel="noopener">babylon-wallet-android</a></td><td>31 July 2026 – <a href="https://github.com/radixdlt/babylon-wallet-android/pull/1447" target="_blank" rel="noopener">the same fix, landed a day later on Android</a></td><td><a href="https://github.com/radixdlt/babylon-wallet-android/releases/tag/1.22.1" target="_blank" rel="noopener">1.22.1</a> (9 June 2026)</td></tr>
<tr><td><a href="https://github.com/radixdlt/babylon-gateway" target="_blank" rel="noopener">babylon-gateway</a></td><td>7 September 2026 – <a href="https://github.com/radixdlt/babylon-gateway/pull/842" target="_blank" rel="noopener">two new SystemVersion values for the Eagle Ray update</a></td><td><a href="https://github.com/radixdlt/babylon-gateway/releases/tag/v1.10.7" target="_blank" rel="noopener">v1.10.7</a> (7 September 2026)</td></tr>
</tbody></table>
<p>The iOS repository's GitHub Releases list stops at 1.18.4 (November 2025), but its source <a href="https://github.com/radixdlt/babylon-wallet-ios/commit/01fb96d" target="_blank" rel="noopener">moved to 1.22.1 on 9 June 2026</a>, and the App Store has served that version since 11 June, so both apps carry the same version number. The missing-mnemonic fix of 30 and 31 July is merged on both repositories and has shipped in neither app: no release has followed it.</p>
<p>The <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway API</a>, which the wallet reads balances and transaction history through, took one code change, released as v1.10.7 four days before the <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray protocol update</a> was enacted on 11 September 2026. It lets the Gateway recognise the engine's two newest system versions, and it changes nothing a wallet or dApp calls (<a href="/developers/frontend/02-gateway-sdk" rel="noopener">Gateway SDK</a> has the detail). None of the three repositories is archived, and both apps remain published and installable.</p>
<p>Asked in the Radix Developer Discussion group on 7 August 2026 whether further wallet releases were planned, a contributor answered that there are none: the wallet is being kept going on a volunteer basis with bug fixes only, and the same holds for the Gateway, <a href="https://t.me/RadixDevelopers/65908" target="_blank" rel="noopener">"until a future direction is set by the community"</a> and decided by a proposal. The route to that decision was described in the same thread as <a href="https://t.me/RadixDevelopers/65907" target="_blank" rel="noopener">three stages</a>: a draft discussion on <a href="/ecosystem/radixtalk" rel="noopener">RadixTalk</a>; a temperature check on the Radix Consultation app; then a governance proposal that settles what is done and who does it. By 2 October no proposal on the wallet's future had reached a vote; the Radix DAO card <a href="/ideas/dao-steward-radix-wallet" rel="noopener">Assume stewardship of the Radix Wallet and core stack</a> tracks it, and <a href="/contents/tech/core-concepts/radix-governance" rel="noopener">Radix Governance</a> covers how the process is meant to work. Contributors remain free to open pull requests against either wallet repository in the meantime.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied – no write'); process.exit(0); }
  const i = blocks.findIndex((b) => b.id === BLOCK_ID);
  if (i < 0 || !blocks[i].text.includes('Read on 7 August 2026')) throw new Error('target block not found');
  blocks[i] = { ...blocks[i], text };
  const version = '1.6.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${blocks[i].text.length} chars)`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Development status re-read 2 Oct 2026: iOS latest release is 1.22.1 (App Store, 11 Jun 2026; source bumped 9 Jun), not the 1.18.4 GitHub Releases still lists; the 30/31 Jul missing-mnemonic fix is merged but shipped in neither app; the Gateway released v1.10.7 on 7 Sep (PR #842, SystemVersion V4/V5 for Eagle Ray), so "no code change since May" was out of date. Links the dao-steward-radix-wallet card.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
