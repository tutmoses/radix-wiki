import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 474. The most-read page on the wiki said the stolen assets were all out
// of reach on Ethereum. On 22 September the Foundation opened temperature
// check #7 (consultation.mountain-top.live/tc/7): the attacker's largest hUSDC
// transfer to Ethereum was still in flight when the Hyperlane routes were
// halted and is permanently stuck, so about 442,985 USDC of collateral was
// never released and may be recovered. The page's own ledger figures already
// held the gap: 458,914.885741 hUSDC burned, 15,929.25 USDC delivered to the
// attacker's address, difference 442,985.64. The page read that gap as "a
// different recipient". Three edits: the Where the assets went sentence, a new
// section after the Foundation's report, the recovery paragraph under What is
// unresolved, plus one infobox row.

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const NEW_VERSION = '3.4.0';
const SENTINEL = 'id="the-trapped-usdc"';
const DRY = process.argv.includes('--dry-run');
const TC = 'https://consultation.mountain-top.live/tc/7';

const EDITS = [
  {
    name: 'infobox recovery row',
    where: (b) => b.includes('<strong>Exit</strong>'),
    find: 'destination domain 1</td></tr>',
    replace: `destination domain 1</td></tr><tr><td><strong>Recovery</strong></td><td>About 443k USDC held back by an unfinished bridge transfer; its allocation is <a href="${TC}" target="_blank" rel="noopener">temperature check #7</a>, 22 to 27 September 2026</td></tr>`,
  },
  {
    name: 'where the assets went',
    where: (b) => b.includes('<h2>Where the assets went</h2>'),
    find: 'The USDC does not match, and the gap is informative rather than mysterious: 15,929.25 USDC reached this address against 458,914.89 hUSDC burned on Radix, so the largest sweep of the afternoon was directed at a different recipient.',
    replace: `The USDC does not match: 15,929.25 USDC reached this address against 458,914.89 hUSDC burned on Radix. The rest never reached anyone. The attacker's largest hUSDC transfer to Ethereum was still in flight when the Hyperlane routes were halted, and the Foundation says it is now permanently stuck; <a href="#the-trapped-usdc">the trapped USDC</a> covers what happens to it.`,
  },
  {
    name: 'unresolved: recovery',
    where: (b) => b.includes('<h2>What is unresolved</h2>'),
    find: 'The second is recovery. The assets left the network within the hour, and what is left of them sits on Ethereum in an account nobody on Radix can reach. Containment moved to the receiving chain and to the exchanges, which is where it stays.',
    replace: `The second is recovery. Most of the assets left the network within the hour and were sold on the chains they reached, where Radix cannot follow them. The exception is about 443k USDC stuck in the unfinished bridge transfer, which the Foundation is trying to recover and has put to <a href="#the-trapped-usdc">a community vote</a> that closes on 27 September.`,
  },
];

const NEW_SECTION = `<h2 id="the-trapped-usdc">The trapped USDC (22 September 2026)</h2><p>About 443k USDC of the stolen value may come back. On 22 September the Radix Foundation opened <a href="${TC}" target="_blank" rel="noopener">temperature check #7</a> on the Radix Consultation site, the first, non-binding stage of <a href="/contents/tech/core-concepts/radix-governance" rel="noopener">Radix governance</a>, and asked the community how the money should be allocated if it is recovered. According to the proposal, the attacker's outbound hUSDC transfer to Ethereum had not completed when Hyperlane's routes were shut down on 31 August. The hUSDC was burned on Radix, but the USDC collateral that would have paid it out was never released; it sits in Hyperlane's deployments on Ethereum, Base, Solana and BNB Chain. The proposal puts the stuck amount at 442,985 USDC, which matches this page's ledger reading to within a dollar: 458,914.89 hUSDC burned, less the 15,929.25 USDC that reached the attacker's address.</p><p>Recovery has not happened yet. The Foundation believes it can move the collateral to a wallet it controls but says it cannot guarantee it, and if it fails the vote is moot. It will not reopen the Hyperlane routes until the assets are secured. It has matched the burned hUSDC to the accounts that held it at the last state before the theft, state version 557,756,613, and says no balance is left unaccounted for. The Foundation will not vote and will carry out whichever option wins. The three options:</p><ol><li>Reimburse the accounts that held hUSDC at that snapshot, directly or through a liquidity position, in proportion to their holding. hUSDC was backed one to one and its collateral survived, so this makes those holders whole.</li><li>Divide it among everyone who held any of the six wrapped assets, weighted by the dollar value of their loss. The proposal puts the wrapped assets on Radix at about 1.3m USD at the time, a figure it marks as still to be confirmed, so each victim would get back about a third of their loss.</li><li>Pay it into the Radix DAO treasury, for ordinary DAO governance to allocate later.</li></ol><p>Under the first two options the USDC would be bridged back, reissued as hUSDC and deposited straight into the end-user accounts, not into the protocols whose pools held it. Voting runs from 22 to 27 September. If the temperature check passes, the options go forward to a governance proposal, where the allocation is decided.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  for (const s of [NEW_SECTION, ...EDITS.flatMap((e) => [e.find, e.replace])]) {
    if ([...s].some((ch) => ch.charCodeAt(0) === 160 || ch.charCodeAt(0) === 0x2014)) throw new Error('U+00A0 or em dash in script text');
  }

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));

  if (JSON.stringify(blocks).includes(SENTINEL.replace(/"/g, '\\"'))) {
    console.log('  already applied – no write');
    process.exit(0);
  }

  const leaves = blocks.flatMap((b) => (b.type === 'infobox' ? b.blocks : [b])).filter((b) => typeof b.text === 'string');
  for (const e of EDITS) {
    const block = leaves.find((b) => e.where(b.text));
    if (!block) throw new Error(`block for "${e.name}" not found`);
    const hits = block.text.split(e.find).length - 1;
    if (hits !== 1) throw new Error(`edit "${e.name}" matched ${hits} times, expected 1`);
    block.text = block.text.replace(e.find, e.replace);
    console.log(`  ok  ${e.name}`);
  }

  const reportIdx = blocks.findIndex((b) => b.text?.includes('id="the-foundations-report"'));
  if (reportIdx < 0) throw new Error('report block not found');
  blocks.splice(reportIdx + 1, 0, { id: uid(), type: 'content', text: NEW_SECTION });
  console.log(`  ok  new section after block ${reportIdx}`);

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${NEW_VERSION}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json,
      NEW_VERSION,
      now,
      page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(),
        page.id,
        json,
        page.title,
        NEW_VERSION,
        'minor',
        AUTHOR_ID,
        'Added The trapped USDC: about 443k USDC of collateral was never released because the attacker\'s largest hUSDC transfer to Ethereum was stuck when the routes were halted, and the Foundation put its allocation to temperature check #7 on 22 September (consultation.mountain-top.live/tc/7). Corrected Where the assets went, which read the gap as a different recipient, and the recovery paragraph under What is unresolved; added an infobox row.',
        now,
      ],
    );
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
