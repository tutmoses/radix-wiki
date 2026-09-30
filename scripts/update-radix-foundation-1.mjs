import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'radix-foundation';
const AFTER = '0606c406-58d0-413a-b5e5-1eb9757dac0f'; // Transition to Community Governance (2026)
const SENTINEL = 'Treasury on the Ledger';

const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const acct = (addr) => a(`https://dashboard.radixdlt.com/account/${addr}`, `<code>${addr.slice(0, 16)}…${addr.slice(-6)}</code>`);
const VOTE = 'https://www.radixdlt.com/blog/token-holder-consultation-repurposing-the-stablecoin-reserve';

const text = `<h2>${SENTINEL}</h2>
<p>The Foundation does not label its accounts, but its XRD can be followed on the ledger from the transactions that moved it. Seven accounts traced this way held 2.83bn XRD on 30 September 2026, all of it unstaked. Three hold what is left of the Stable Coin Reserve and four hold the Foundation's general treasury. The traced general accounts hold 929m XRD, against the roughly 1.3bn that Dan Hughes gave for the Foundation's own holding in July 2025, a figure that left out the pots it held as custodian (${a('https://t.me/Trade_Radix/133557', 'Telegram')}, ${a('https://t.me/Trade_Radix/133558', 'Telegram')}), so they may not be all of it.</p>
<h3>Stable Coin Reserve</h3>
<p>The 2.4bn XRD Stable Coin Reserve sat in a single account, ${acct('account_rdx1683u2tm2v5uyn8xsd9g79zvcnztduvqg7w9rfep3ua0pqyaaqqwlmc')}, from the Babylon migration until token holders voted in May 2025 to split it into 1bn for an incentives campaign, 1bn for a Growth Fund of listings, bridges and venture support, and 400m held "in reserve for potential extension or burn" (${a(VOTE, 'Radix Blog')}). The account paid it out in exactly those amounts:</p>
<table><tbody>
<tr><th>Pot</th><th>Moved</th><th>Account</th><th>XRD, 30 Sep 2026</th></tr>
<tr><td>Growth Fund</td><td>1bn on 16 June 2025; the unspent 643.6m moved on 28 October 2025</td><td>${acct('account_rdx128am6eq5w7ang9fggsz3d2j04584ydauetuakzdlmuxmyv37yg3cff')}</td><td>646.4m</td></tr>
<tr><td>Radix Rewards</td><td>1bn, 24–27 October 2025</td><td>${acct('account_rdx12xrlkqdwx0nvwe2wkweulffawn3meyr6eww2ahmsw8hjrpe09la0xu')}</td><td>852.4m</td></tr>
<tr><td>Held back</td><td>400m, 22–23 October 2025</td><td>${acct('account_rdx12y0qx86nc8jpf9fa7hg87vgejrtyr8xhrv93937tud35cqludf49v8')}</td><td>400.0m</td></tr>
</tbody></table>
<p>The Rewards account paid 114,347,194 XRD into a pool on 2 February 2026, the day before the <a href="/contents/history/radix-rewards" rel="noopener">Radix Rewards</a> payout of 114,347,195 XRD for Seasons 0 and 1 began vesting; it took 6.4m back in March and sent 39.7m to another account in May. The Growth Fund paid out about 356m XRD in its first four months, and 60m of that came back in December 2025. The 400m account has not moved.</p>
<h3>General treasury</h3>
<p>The Foundation put 333.33m XRD into the Radix Endowment Fund on 2 September 2024 from an account that also held stake with four validators named "Radix Foundation"; RDX put in the other 1,166.67m (see <a href="/contents/tech/core-protocols/xrd-token" rel="noopener">$XRD Token</a>). That account and the Foundation's endowment share lead to three of the four general accounts:</p>
<table><tbody>
<tr><th>Account</th><th>Funded from</th><th>XRD, 30 Sep 2026</th></tr>
<tr><td>${acct('account_rdx129pu9d5pj787a6u4c28vrz3ctht0aj3yf5qll68dsdrfghga0dk302')}</td><td>488.6m on 24 October 2025 from an account that had held XRD since the Olympia network</td><td>445.8m</td></tr>
<tr><td>${acct('account_rdx12xe8gduc7vqxxl8qg0f020h4h4jvaxtmnar75g8jztaxuyk4v0raun')}</td><td>217m of the returned endowment share, and 164m from two other accounts, October 2025 to March 2026</td><td>269.3m</td></tr>
<tr><td>${acct('account_rdx12yfzhjtdrj2z8g85au3skmshuwp4tey336c89sgf3gvw3ft4rgkxr6')}</td><td>212.1m on 24 October 2025 from the endowment contributor; in June 2026 it withdrew 54.6m of stake from two Foundation validators</td><td>117.9m</td></tr>
<tr><td>${acct('account_rdx1284mt7an6zas49p280nw7peg9620pupt4wzu2dg8usknk82a0djefv')}</td><td>The endowment share, 340.6m after staking returns, on 27 January 2026</td><td>95.5m</td></tr>
</tbody></table>
<p>The first account was identified to radix.wiki as the Foundation's, and the ledger ties it to the others only by timing: it was funded in the same week as the reserve pots and the third account. When the Foundation hands its treasury to the community's legal entity, these accounts are where the transfer should be visible.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(`<h2>${SENTINEL}</h2>`))) {
    console.log('  already applied – no write');
    process.exit(0);
  }
  const i = blocks.findIndex((b) => b.id === AFTER);
  if (i < 0) throw new Error('anchor block not found');
  blocks.splice(i + 1, 0, { id: uid(), type: 'content', text });

  const version = '4.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}, +1 block after index ${i}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'New section tracing the Foundation treasury on the ledger: the 2.4bn Stable Coin Reserve split 1bn/1bn/400m as the May 2025 vote set out (Rewards pot paid the 114,347,195 XRD Season 0-1 payout on 2 Feb 2026), and four general-treasury accounts linked through the Foundation validators and its 333.33m Endowment Fund share. Balances read 30 Sep 2026.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
