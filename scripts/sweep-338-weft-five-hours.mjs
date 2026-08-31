// Sweep 338 – Weft Finance: the five-hour reading.
//
// Sweep 336 documented the 30 August exploit and 337 named its cause. Both
// closed on a reading taken at 19:40-20:00 UTC. This one carries the state
// forward to 23:05-23:07 UTC, epoch 339,630, and the finding is that nothing
// upstream has moved:
//
//   * Default PriceFeed refreshed HUG at 23:05:00 UTC and published
//     1275.048956797137538379 XRD, against an Ociswap market of
//     0.000127565039984134 XRD. Still ~10 million times.
//   * LendingMarket market_service_status: CreateCDP / UpdateCDP / BurnCDP all
//     enabled=true, locked=false. can_borrow / can_create_cdp /
//     can_flash_borrow still allow_all. cdp_counter still 1138, the position
//     the exploit opened.
//   * Lending Pool V2 vaults: 774,245.746005164429306437 XRD,
//     201,613.219535768596047052 LSULP, 34.746831 hUSDC.
//     The page's prior LSULP reading was 3,624,492.41 at epoch 339,588.
//   * Eight transactions touched the market component between 19:40 and 23:07;
//     every one moved assets out to a user account, none changed configuration.
//   * No statement: from:weft_finance returns 0 posts over the 7-day search
//     window, and t.me/WeftFinance carries only holder questions.
//
//   node scripts/sweep-338-weft-five-hours.mjs --dry-run
//   node scripts/sweep-338-weft-five-hours.mjs

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'weft-finance';
const SENTINEL = 'Five hours on';
const VERSION = '4.6.0';

const MARKET = 'component_rdx1cpy6putj5p7937clqgcgutza7k53zpha039n9u5hkk0ahh4stdmq4w';
const POOL = 'component_rdx1czmr02yl4da709ceftnm9dnmag7rthu0tu78wmtsn5us9j02d9d0xn';
const FEED = 'component_rdx1czdvvanvdy6495phfgz8uv6n2semp2cpexcg6vvty6uaycc82adgyv';

// Tense fix: the 19:40 reading is now one of two, not the current one.
const OLD_TENSE = 'Read at 19:40 UTC on 30 August there is no on-ledger remediation';
const NEW_TENSE = 'Read at 19:40 UTC on 30 August there was no on-ledger remediation';

const APPEND =
  '<h3>Five hours on</h3>' +
  `<p>Read again at 23:07 UTC on 30 August, <strong>epoch&nbsp;339,630</strong>, nothing has been switched off. <code>CreateCDP</code>, <code>UpdateCDP</code> and <code>BurnCDP</code> all report <code>enabled</code> and unlocked on the <a href="https://dashboard.radixdlt.com/component/${MARKET}" target="_blank" rel="noopener">lending market</a>, and <code>can_borrow</code>, <code>can_create_cdp</code> and <code>can_flash_borrow</code> are still <code>allow_all</code>. The market&rsquo;s <code>cdp_counter</code> stands at <strong>1,138</strong>, the position the exploit opened: no one has opened another in the five hours since.</p>` +
  `<p>The feed has not been corrected, and it is still being written to. At <strong>23:05:00&nbsp;UTC</strong> the <a href="https://dashboard.radixdlt.com/component/${FEED}" target="_blank" rel="noopener">Default PriceFeed</a> refreshed HUG and published <strong>1,275.05&nbsp;XRD</strong> per token, two minutes before this reading. HUG traded at <strong>0.000127565&nbsp;XRD</strong> on <a href="/ecosystem/ociswap" rel="noopener">Ociswap</a> at the same moment, so the published price is about <strong>ten million times</strong> the market. The market&rsquo;s <code>price_expiration_period</code> is 14,400 seconds, so the posted price that released 71 million XRD of debt is current rather than expired.</p>` +
  `<p>What has changed is the pool, and the change is lenders leaving. The <a href="https://dashboard.radixdlt.com/component/${POOL}" target="_blank" rel="noopener">Weft Lending Pool V2</a> held <strong>3,624,492.41&nbsp;LSULP</strong> at epoch&nbsp;339,588 and <strong>201,613.22</strong> at epoch&nbsp;339,630, alongside <strong>774,245.75&nbsp;XRD</strong> and <strong>34.75&nbsp;hUSDC</strong>. Eight transactions touched the market component between 19:40 and 23:07&nbsp;UTC; every one moved assets out to a user account, and none changed a configuration.</p>` +
  '<p>No statement had been published by 23:00 UTC. A search of the seven days to that reading returns nothing from <a href="https://x.com/weft_finance" target="_blank" rel="noopener">@weft_finance</a>, and the project&rsquo;s <a href="https://t.me/WeftFinance" target="_blank" rel="noopener">Telegram channel</a> carries only questions from holders.</p>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  for (const s of [OLD_TENSE, SENTINEL]) {
    if (/\u00A0/.test(s)) throw new Error('find-string carries U+00A0');
  }

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }

  const exploit = blocks.find((b) => b.text?.includes('The 30 August 2026 exploit'));
  if (!exploit) throw new Error('exploit section not found – run sweeps 336/337 first');
  if (!exploit.text.includes(OLD_TENSE)) throw new Error('tense find-string not matched');

  exploit.text = exploit.text.replace(OLD_TENSE, NEW_TENSE) + APPEND;
  console.log('  matched: 19:40 tense; appended: Five hours on');

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json, VERSION, now, page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
        'Carry the exploit reading forward to 23:07 UTC, epoch 339,630. The Default PriceFeed refreshed HUG at 23:05:00 and published 1,275.05 XRD against an Ociswap market of 0.000127565; CreateCDP, UpdateCDP and BurnCDP remain enabled and unlocked and cdp_counter is still 1138; the Lending Pool V2 fell from 3,624,492.41 LSULP at epoch 339,588 to 201,613.22, holding 774,245.75 XRD and 34.75 hUSDC; all eight market-component transactions after 19:40 moved assets out to user accounts and none changed configuration; no statement on X or Telegram.',
        now,
      ],
    );
    await client.query('COMMIT');
    console.log('  committed');
  }
} finally {
  client.release();
  await pool.end();
}
