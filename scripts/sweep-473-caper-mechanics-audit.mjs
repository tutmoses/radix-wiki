import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 473, closing the run-467 item that asked for the four mechanics on
// /ecosystem/caper that had never been checked against the contract. Three of
// the four were wrong or misleading and the fourth held.
//
//   Fixed supply of 100 billion tokens per caper: CORRECT. common/src/lib.rs
//   declares CURVE_CAP = 100,000,000,000 as the "total fixed supply minted at
//   every caper's genesis", identical for every caper and asserted by the state
//   tier as an invariant no logic version can violate. The page keeps it.
//
//   Cashtag mint price: WRONG, by a factor of ten at every length. The page
//   said 10^(6-x). create_caper in logic/src/lib.rs sets char_limit = 7 and
//   charges 10^(7 - char_count), a line unchanged since 2026-07-21 and so
//   older than every September redeploy; caper.network's own getting-started
//   page publishes the same ladder (10 XRD at six characters up to 1,000,000
//   at one). A three-character cashtag costs 10,000 XRD, not 1,000.
//
//   Supermajority threshold: the formula was right and the framing was not.
//   1.5/option_count is a share of the BORDA POINTS cast, not of the voters. A
//   full ranked ballot of x options awards x(x-1)/2 points of which one option
//   can take at most x-1, so the ceiling on any option's share is 2/x and the
//   threshold is three-quarters of it at every x. "Three-option votes require
//   50% support" reads as a simple majority and is not what settle_proposal
//   measures. The slate is also 2-5 options and always carries a "Do nothing"
//   entry that cannot win, neither of which the page said.
//
//   Founder price vesting: DOES NOT EXIST. No vesting, milestone or price gate
//   appears anywhere in contracts/; founder_take_pair in core/src/caper_dao.rs
//   authorises on the founder badge alone and asserts only that the amount has
//   accrued. Caper's own what-a-founder-can-take says it in as many words.
//
//   Vampire curves: live, and the page describes them correctly (origin_token
//   on create_caper, record_migration, the is_vampire deficit path). No edit.

const TAG_PATH = 'ecosystem';
const SLUG = 'caper';
const NEW_VERSION = '2.4.0';
const SENTINEL = 'ten raised to the power of seven minus';
const DRY = process.argv.includes('--dry-run');

const EDITS = [
  {
    name: 'cashtag price ladder',
    find: 'The cost to mint a caper is calculated as 10^(6-x) XRD, where x represents the number of digits in the desired cashtag. This pricing structure means that shorter, more valuable cashtags require significantly higher initial investment, with a three-character cashtag like &quot;$CPR&quot; costing 1,000 XRD tokens.',
    replace:
      'The registration fee is ten raised to the power of seven minus the number of characters in the cashtag, so a six-character cashtag costs 10 XRD and every character dropped multiplies the fee by ten: 100 XRD at five characters, 1,000 at four, 10,000 at three, 100,000 at two and 1,000,000 at one. A cashtag runs one to six characters and is uppercase A to Z or digits 0 to 9, and the contract rejects a payment that is even slightly off the figure its length sets. Two cashtags are reserved: XRD, because a governance token whose symbol is locked to its cashtag would be indistinguishable from the network’s own currency, and CAPER, which only the protocol administrator can mint. <a href="https://caper.network/wiki/foundations/getting-started" target="_blank" rel="noopener">Caper publishes the ladder</a>, and the <code>create_caper</code> method asserts the payment against it.',
  },
  {
    name: 'supermajority framing',
    find: 'Governance decisions require supermajority approval based on the formula: threshold = (1/x) × 1.5, where x represents the number of ballot options. This approach means binary votes require 75% approval, three-option votes require 50% support for the winning option, and four-option votes require 37.5% support. The supermajority requirement reflects the principle that proposals should not pass when they represent maximum controversy, ensuring broad community support before implementation.',
    replace:
      'A ballot carries between two and five options, and one of them is always a &quot;Do nothing&quot; entry, so the smallest slate is a single answer standing against a rejection. The leading option passes only if it takes 1.5 divided by the number of options of the weight cast, and only if it is not the &quot;Do nothing&quot; entry, which is barred from winning even when it clears the bar. That share is measured against the ranked points cast rather than against the voters: a full ranked ballot of x options awards x(x-1)/2 points, of which any one option can take at most x-1, so the most an option can score is 2/x and the threshold of 1.5/x is three-quarters of that ceiling at every length of slate. In figures, two options need 75% of the points cast, three need 50%, four need 37.5% and five need 30%. <a href="https://caper.network/wiki/governance/proposals" target="_blank" rel="noopener">Caper states the threshold and the shape of the slate</a>.',
  },
  {
    name: 'founder vesting removal',
    find: 'Project founders participating in price vesting programs experience gradual access to their reserved token allocations as their capers achieve predetermined value milestones. This staged release process aligns founder incentives with long-term project success while providing mechanisms for sustainable funding acquisition throughout organizational development phases.',
    replace:
      'No vesting schedule holds a founder’s allocation back, because there is no allocation to hold. The founder’s claim accrues trade by trade out of the slice taken on each purchase and sale, into two vaults the caper keeps for it, and the founder withdraws from those vaults through <code>withdraw_founder</code>, which checks that the caller presents that caper’s founder badge and that the amount asked for is no more than has already accrued. There is no milestone, no cliff and no price gate on the way out. <a href="https://caper.network/wiki/foundations/what-a-founder-can-take" target="_blank" rel="noopener">Caper puts it the same way</a>: what stops a founder emptying the reserve is not a vesting schedule but the absence of any method that would do it. The badge is a transferable bearer token, so the stream it collects can change hands without a proposal.',
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  // The &nbsp; trap: a find-string carrying U+00A0 silently matches nothing.
  for (const e of EDITS) {
    if ([...e.find, ...e.replace].some((ch) => ch.charCodeAt(0) === 160)) throw new Error(`U+00A0 in edit "${e.name}"`);
  }

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  const block = blocks.find((b) => typeof b.text === 'string' && b.text.includes('Cashtag System'));
  if (!block) throw new Error('cashtag block not found');

  if (block.text.includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }

  for (const e of EDITS) {
    const hits = block.text.split(e.find).length - 1;
    if (hits !== 1) throw new Error(`edit "${e.name}" matched ${hits} times, expected 1`);
    block.text = block.text.replace(e.find, e.replace);
    console.log(`  ok  ${e.name}`);
  }

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
        'Three of the four unchecked mechanics were wrong. The cashtag registration fee is ten to the power of seven minus the length, not six, so a three-character cashtag costs 10,000 XRD rather than 1,000; the supermajority threshold is a share of the ranked points cast, whose ceiling is 2 divided by the number of options, rather than a share of voters, and the slate is two to five options always including a Do nothing entry that cannot win; and founder price vesting does not exist, the founder badge alone authorising a withdrawal of whatever has accrued. The 100 billion fixed supply and the vampire curves checked out and stand. Sources: caper.network getting-started, governance/proposals and what-a-founder-can-take, against create_caper, settle_proposal, apply_borda and founder_take_pair in the contracts.',
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
