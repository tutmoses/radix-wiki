// scripts/sweep-380-stablecoins-on-radix.mjs — run 380 (contents/tech rotation).
//
// /contents/tech/core-concepts/stablecoins was the head of this category's
// staleness queue: last touched 3 July 2026, never verified. Its literature
// sections are 2014-2023 scholarship and cannot decay. Its one section about the
// live network could, and had: it named Root Finance and Weft Finance as
// "adjacent infrastructure" with no mention that this wiki records Root as
// dormant and Weft as exploited on 30 August 2026 through a price feed - which is
// precisely the oracle problem the page's own theory section names as one of the
// two hard problems in stabilisation design.
//
// Rewritten with figures read from the ledger rather than from the ecosystem
// directory. Both supplies are pinned reads at state version 557,840,622, the
// last state mainnet committed before the halt, taken 7 September 2026:
//   STAB   resource_rdx1t40lchq8k38eu4ztgve5svdpt0uxqmkvpy4a2ghnjcxjtdxttj9uam
//          total_supply 2642.434838928345455282
//   hUSDC  resource_rdx1thxj9m87sn5cc9ehgp9qxp6vzeqxtce90xm5cp33373tclyp4et4gv
//          total_supply 1092.793964, "Wrapped USDC bridged by Hyperlane"

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'stablecoins';
const SENTINEL = 'the oracle problem this page describes in the abstract';
const OLD_HEAD = '<h2>Stablecoins on Radix</h2>';

const NEW_SECTION =
  '<h2>Stablecoins on Radix</h2>\n' +
  '<p>Radix has one stablecoin of its own and one route by which anyone else’s reaches it, and both are small enough to state exactly. ' +
  '<a href="/ecosystem/stabilis" rel="noopener">Stabilis</a> pairs the ILIS DAO, incorporated in the Marshall Islands, with the STAB Protocol, ' +
  'which issues $STAB against Radix-native collateral. Read from the ledger at state version 557,840,622 – the last state ' +
  '<a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">mainnet committed before it halted</a> on 31 August 2026 – ' +
  'the STAB resource carries a total supply of <strong>2,642.43</strong> and its governance token ILIS a fixed 99,982,000. ' +
  'Dollar-pegged value from outside arrives wrapped: <a href="/ecosystem/instabridge" rel="noopener">Instabridge</a>, the regulated Ethereum bridge ' +
  'that carried the first wrapped USDC and USDT onto the network, is closed, and the surviving route is Hyperlane, whose hUSDC resource ' +
  '– described on-ledger as "Wrapped USDC bridged by Hyperlane" – held a total supply of <strong>1,092.79</strong> at the same state version. ' +
  '<a href="/ecosystem/etherealdao" rel="noopener">EtherealDAO</a>, which was building the EtherealUSD protocol, has closed.</p>\n' +
  '<p>The collateral infrastructure around them has thinned in the same period. ' +
  '<a href="/ecosystem/root-finance" rel="noopener">Root Finance</a> is dormant, its tracked deposits down from a peak of about $1.67M in April 2025 to roughly $2K. ' +
  '<a href="/ecosystem/weft-finance" rel="noopener">Weft Finance</a>, the larger of the two money markets, was exploited on 30 August 2026 when its price feed valued ' +
  'the memecoin HUG at roughly ten million times its market price, releasing 71M XRD of debt against collateral bought for 70.6 XRD. ' +
  'That is the oracle problem this page describes in the abstract, arriving on this network: Sams named representing a coin’s market price inside the ' +
  'system with minimal trust as one of the two hard problems any stabilisation scheme must solve, and a lending market that gets the price wrong ' +
  'fails in the same way a peg does, by letting someone mint claims the collateral does not cover.</p>\n' +
  '<p>The general vocabulary is set out in this wiki’s overview of ' +
  '<a href="/contents/tech/core-concepts/decentralized-finance-defi" rel="noopener">decentralized finance (DeFi)</a>, which names DAI, Tether (USDT) ' +
  'and USD Coin (USDC) as the reference examples of the three collateral families.</p>';

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const target = blocks.find((b) => (b.text || '').startsWith(OLD_HEAD));
  if (!target) throw new Error('Stablecoins on Radix block not found');
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v1.1.0`);
  console.log(`  section ${target.text.length} chars -> ${NEW_SECTION.length}`);
  target.text = NEW_SECTION;

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, '1.1.0', now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, '1.1.0', 'minor', AUTHOR_ID,
       'Rewrite "Stablecoins on Radix" with measured figures. STAB and hUSDC supplies read on-ledger at state version 557,840,622 (pinned, 7 September 2026); Root Finance recorded as dormant and Weft Finance’s 30 August 2026 price-feed exploit connected to the oracle problem the page already names in theory; Instabridge recorded as closed.',
       now],
    );
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
