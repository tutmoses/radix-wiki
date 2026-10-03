// Sweep 528: the "Where it stands (7 August 2026)" section of the wallet-stewardship
// card had two rows overtaken (run 521 finding): babylon-gateway released v1.10.7 on
// 7 Sep (PR #842, the Eagle Ray SystemVersion values) and iOS ships 1.22.1 on the App
// Store (11 Jun 2026). Re-read 3 Oct 2026 through the GitHub API, npm and the iTunes
// lookup: no repository moved since 7 Sep, the 30/31 Jul missing-mnemonic fix is in no
// store release, the dApp Toolkit is still 2.3.0 of 2 Mar. Section re-dated to 3 Oct,
// infobox Latest row with it.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ideas';
const SLUG = 'dao-steward-radix-wallet';
const SENTINEL = 'Where it stands (3 October 2026)';
const DRY = process.argv.includes('--dry-run');

const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const GH = 'https://github.com/radixdlt';

const SECTION = `<h2>${SENTINEL}</h2>
<p>The three components named in the deliverables below are not held on the same terms, and none of them is funded. Asked in the Radix Developer Discussion group on 7 August 2026 whether further wallet releases were planned, a contributor answered that there are none: the wallet is kept going on a volunteer basis with bug fixes only, and the same holds for the Gateway, ${A('https://t.me/RadixDevelopers/65908', '"until a future direction is set by the community"')} and decided by a proposal. The public repositories and app stores, read on 3 October 2026:</p>
<table><tbody>
<tr><th>Component</th><th>Most recent commit</th><th>Latest published release</th></tr>
<tr><td>${A(`${GH}/babylon-wallet-ios`, 'babylon-wallet-ios')}</td><td>30 July 2026 – ${A(`${GH}/babylon-wallet-ios/pull/1513`, 'a missing-mnemonic defect fix')}</td><td>1.22.1 on the ${A('https://apps.apple.com/us/app/radix-wallet/id6448950995', 'App Store')} (11 June 2026)</td></tr>
<tr><td>${A(`${GH}/babylon-wallet-android`, 'babylon-wallet-android')}</td><td>31 July 2026 – ${A(`${GH}/babylon-wallet-android/pull/1447`, 'the same fix, a day later')}</td><td>${A(`${GH}/babylon-wallet-android/releases/tag/1.22.1`, '1.22.1')} (9 June 2026)</td></tr>
<tr><td>${A(`${GH}/babylon-gateway`, 'babylon-gateway')}</td><td>7 September 2026 – ${A(`${GH}/babylon-gateway/pull/842`, 'two new system-version values for the Eagle Ray update')}</td><td>${A(`${GH}/babylon-gateway/releases/tag/v1.10.7`, 'v1.10.7')} (7 September 2026)</td></tr>
<tr><td>${A(`${GH}/radix-dapp-toolkit`, 'radix-dapp-toolkit')}</td><td>2 March 2026 – ${A(`${GH}/radix-dapp-toolkit/pull/324`, 'the subintent-header release merge')}</td><td>v2.3.0 (2 March 2026)</td></tr>
</tbody></table>
<p>Both wallet apps carry version 1.22.1, although the iOS repository's GitHub Releases list stops at 1.18.4. The missing-mnemonic fix merged on both repositories at the end of July has shipped in neither app, because no release has followed it. The <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway</a> took one code change, released four days before the <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray protocol update</a> was enacted on 11 September, so that it recognises the engine's two newest system versions; nothing a wallet or dApp calls changed. The <strong>Radix dApp Toolkit</strong>, the library dApps use to connect to the Radix Wallet, has no volunteer holding it: nothing has landed on <code>main</code> since March, and ${A('https://www.npmjs.com/package/@radixdlt/radix-dapp-toolkit', 'npm still serves 2.3.0')}. None of the four repositories is archived, and both wallet apps remain published and installable.</p>
<p>The route onward was described in the same thread as ${A('https://t.me/RadixDevelopers/65907', 'three stages')}: a draft discussion on <a href="/ecosystem/radixtalk" rel="noopener">RadixTalk</a>; a temperature check on the Radix Consultation app; then a governance proposal settling what is done and who does it. By 3 October no proposal on the wallet's future had reached a vote, so the card stays at Discussion. Fuller background at <a href="/contents/tech/core-protocols/radix-wallet" rel="noopener">Radix Wallet</a> and <a href="/contents/tech/core-concepts/radix-governance" rel="noopener">Radix Governance</a>.</p>`;

const LATEST_FROM = '7 Aug 2026 – wallet &amp; Gateway in volunteer, bug-fix-only maintenance; the dApp Toolkit untouched since March';
const LATEST_TO = '3 Oct 2026 – wallet &amp; Gateway in volunteer, bug-fix-only maintenance; Gateway v1.10.7 for Eagle Ray; the dApp Toolkit untouched since March';

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

  const body = blocks.find((b) => b.type === 'content' && b.text?.includes('<h2>Where it stands (7 August 2026)</h2>'));
  if (!body) throw new Error('section block not found');
  const start = body.text.indexOf('<h2>Where it stands (7 August 2026)</h2>');
  const end = body.text.indexOf('<h2>Deliverables</h2>');
  if (end < start) throw new Error('section bounds not found');
  body.text = body.text.slice(0, start) + SECTION + body.text.slice(end);

  const box = blocks.find((b) => b.type === 'infobox')?.blocks?.find((b) => b.text?.includes(LATEST_FROM));
  if (!box) throw new Error('infobox Latest row not found');
  box.text = box.text.replace(LATEST_FROM, LATEST_TO);

  const version = '1.2.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 528: "Where it stands" re-dated 7 Aug -> 3 Oct 2026 from the GitHub API, npm and the App Store: babylon-gateway v1.10.7 (7 Sep, PR #842, Eagle Ray system versions), iOS 1.22.1 on the App Store since 11 Jun, the July missing-mnemonic fix in no store release, dApp Toolkit still 2.3.0. Infobox Latest row with it.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
