// Sweep 339 – Weft Finance: the statement, and what the ledger says about it.
//
// Sweeps 336-338 documented the 30 August exploit, named the mispriced feed and
// carried the reading to 23:07 UTC. Weft published its first statement at
// 23:49 UTC, and this run checks its three stated factors against the ledger.
// The first one does not survive.
//
//   * HUG's collateral Add service was set enabled=false, locked=true by the
//     admin badge on 6 June 2025 08:40:27 UTC, state version 303,390,813
//     (txid_rdx173qp76fzq88c5ppegddl8aeqxh8fpfgxl8rkdxdcu99dts33d0msydt86g),
//     and read exactly that at 18:02 UTC on 30 August. HUG was ON the
//     disabled-collateral list, 451 days before the exploit.
//   * HUG's FlashOperation service read enabled=true, unlocked at the same
//     instant. The manifest's steps 4-5 are flash_remove_collateral /
//     flash_add_collateral, not add_collateral.
//   * At 17:00 UTC only XRD and LSULP had Borrow enabled; the exploit took
//     both, i.e. everything the market would lend.
//   * Remediation: 23:23:32 admin sets HUG Add enabled=false locked=FALSE
//     (unlocks it; FlashOperation untouched, still enabled at 03:11 UTC 31st);
//     23:25:00 feed publishes HUG at 0.000127565 XRD (last bad print 1,275.83
//     at 23:15:00); 00:15:00 31st the feed floors ten Radix-native tokens at
//     0.0000000001 XRD (HUG, OCI, CAVIAR, WEFT, EARLY, ASTRL, FLOOP, DFP2,
//     MOX, SRG) leaving LSULP at 1.2242 and HLP at 2.3340; 03:05:29 31st the
//     admin disables LSULP Borrow and locks it, leaving XRD the only
//     borrowable asset.
//   * Pool V2: 774,245.75 XRD / 201,613.22 LSULP at 23:07; 14,894.01 /
//     1,073.47 at 00:30; 123.55 XRD, 1,073.47 LSULP, 0.21 hUSDC at 03:10.
//   * Six liquidate calls 23:35-00:25. cdp_counter still 1138 at 03:11.
//
// All read from the Radix Gateway at epoch 339,679, 31 Aug 2026 03:11 UTC.
//
//   node scripts/sweep-339-weft-flash-collateral.mjs --dry-run
//   node scripts/sweep-339-weft-flash-collateral.mjs

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'weft-finance';
const SENTINEL = 'The statement, and the disabled-collateral list';
const VERSION = '4.7.0';

const MARKET = 'component_rdx1cpy6putj5p7937clqgcgutza7k53zpha039n9u5hkk0ahh4stdmq4w';
const POOL = 'component_rdx1czmr02yl4da709ceftnm9dnmag7rthu0tu78wmtsn5us9j02d9d0xn';
const FEED = 'component_rdx1czdvvanvdy6495phfgz8uv6n2semp2cpexcg6vvty6uaycc82adgyv';
const DISABLE_TX = 'txid_rdx173qp76fzq88c5ppegddl8aeqxh8fpfgxl8rkdxdcu99dts33d0msydt86g';
const UNLOCK_TX = 'txid_rdx1rvw2hv6g9fmfzf996c77lf25r4p45c70qy8phy6hn287vtnlmhssl8yrfw';
const LSULP_TX = 'txid_rdx14qfwnsggcm72e0tnnacqr34vz4cl756zm268tyqjpvqx324kwygq9ul94e';

// The flash pair is not incidental: it is the route past a disabled entry.
const OLD_FLASH = 'The flash-collateral pair in steps 4 and 5 is an ordinary deposit route rather than the defect.';
const NEW_FLASH =
  'The flash-collateral pair in steps 4 and 5 is not incidental. Weft had disabled HUG as collateral fifteen months earlier, and that pair is the route that did not check.';

// The 23:07 reading is now one of several, not the current one.
const OLD_T1 = 'nothing has been switched off';
const NEW_T1 = 'nothing had yet been switched off';
const OLD_T2 = 'The feed has not been corrected, and it is still being written to.';
const NEW_T2 = 'The feed had not been corrected at that hour, and it was still being written to.';

const APPEND =
  `<h3>${SENTINEL}</h3>` +
  `<p>Weft published its first account of the incident at <strong>23:49&nbsp;UTC on 30 August</strong>, in its <a href="https://t.me/WeftFinance" target="_blank" rel="noopener">Telegram channel</a>, five hours and forty-six minutes after the borrow. It names three concurrent factors: that HUG collateral was &ldquo;missing from the disabled-collateral list&rdquo;, that one oracle source returned an incorrect price after the other sources failed, and that the protocol accepted that price. It commits to a two-week interest-free period and to setting all ecosystem token prices to 0.0000000001&nbsp;XRD.</p>` +
  `<p>The ledger does not support the first factor. The <a href="https://dashboard.radixdlt.com/component/${MARKET}" target="_blank" rel="noopener">lending market</a> keeps four collateral services per resource &ndash; <code>Add</code>, <code>Remove</code>, <code>FlashOperation</code> and <code>RemoveForLiquidation</code> &ndash; each with its own <code>enabled</code> and <code>locked</code> flags. HUG&rsquo;s <code>Add</code> service was set to <code>enabled=false</code>, <code>locked=true</code> by the protocol&rsquo;s admin badge on <strong>6 June 2025 at 08:40:27&nbsp;UTC</strong> (<a href="https://dashboard.radixdlt.com/transaction/${DISABLE_TX}" target="_blank" rel="noopener">transaction</a>), at state version 303,390,813. Read back at 18:02&nbsp;UTC on 30 August, the minute of the borrow, the entry still carried that write and no other. HUG was on the disabled list, and had been for 451 days.</p>` +
  `<p>What was open is the neighbouring service. At that same instant HUG&rsquo;s <code>FlashOperation</code> read <code>enabled=true</code> and unlocked, and steps 4 and 5 of the manifest are <code>flash_remove_collateral</code> and <code>flash_add_collateral</code> rather than <code>add_collateral</code>. The transaction committed while the <code>Add</code> entry read disabled and locked, so whatever the flash path checks, it is not that entry. The asset was listed and switched off; the door it came through was a different one.</p>` +
  `<p>The same reading explains the size of the loss. An hour before the borrow only <strong>XRD</strong> and <strong>LSULP</strong> had their <code>Borrow</code> service enabled: xUSDC, xUSDT, xETH and xwBTC were disabled and locked, and the five Hyperlane assets were disabled. The attacker drew 47,280,000&nbsp;LSULP and 13,100,500&nbsp;XRD, which is everything the market would lend.</p>` +
  '<h3>The remediation, hour by hour</h3>' +
  '<ul>' +
  `<li><strong>23:23:32&nbsp;UTC, 30 August.</strong> The admin badge calls <code>admin_update_service_status</code> on HUG&rsquo;s collateral entry (<a href="https://dashboard.radixdlt.com/transaction/${UNLOCK_TX}" target="_blank" rel="noopener">transaction</a>), setting <code>Add</code> to <code>enabled=false</code> with <code>locked=false</code>. The asset stays disabled and the entry, locked since June 2025, is now unlocked. <code>FlashOperation</code> was not touched, and still read <code>enabled=true</code> at 03:11&nbsp;UTC on 31 August.</li>` +
  `<li><strong>23:25:00&nbsp;UTC.</strong> The <a href="https://dashboard.radixdlt.com/component/${FEED}" target="_blank" rel="noopener">Default PriceFeed</a> publishes HUG at <strong>0.000127565&nbsp;XRD</strong>, the market rate. Its last overstated print was 1,275.83&nbsp;XRD at 23:15:00, so the ten-million-fold error stood for five hours and twelve minutes after the borrow.</li>` +
  '<li><strong>23:49&nbsp;UTC.</strong> The statement above.</li>' +
  '<li><strong>00:15:00&nbsp;UTC, 31 August.</strong> The feed floors ten Radix-native tokens at <strong>0.0000000001&nbsp;XRD</strong> in one batch &ndash; HUG, OCI, CAVIAR, WEFT, EARLY, ASTRL, FLOOP, DFP2, MOX and SRG &ndash; the measure the statement had promised for &ldquo;tomorrow&rdquo;. It includes Weft&rsquo;s own token. LSULP was left at 1.2242&nbsp;XRD and HLP at 2.3340.</li>' +
  `<li><strong>03:05:29&nbsp;UTC.</strong> The admin badge disables LSULP&rsquo;s <code>Borrow</code> service and locks it (<a href="https://dashboard.radixdlt.com/transaction/${LSULP_TX}" target="_blank" rel="noopener">transaction</a>). XRD is now the only asset the market will lend.</li>` +
  '</ul>' +
  `<p>The pool the borrow drew from is empty. The <a href="https://dashboard.radixdlt.com/component/${POOL}" target="_blank" rel="noopener">Weft Lending Pool V2</a> held <strong>774,245.75&nbsp;XRD</strong> and <strong>201,613.22&nbsp;LSULP</strong> at 23:07&nbsp;UTC on 30 August, 14,894.01 and 1,073.47 at 00:30, and <strong>123.55&nbsp;XRD</strong>, 1,073.47&nbsp;LSULP and 0.21&nbsp;hUSDC when read at 03:10&nbsp;UTC on 31 August. Lenders withdrew what the attacker had not borrowed. Six liquidations ran against the market between 23:35 and 00:25&nbsp;UTC, and the <code>cdp_counter</code> still stands at <strong>1,138</strong> &ndash; the position the exploit opened, and no other in the nine hours since. Figures read from the <a href="https://docs.radixdlt.com/docs/network-gateway" target="_blank" rel="noopener">Radix Gateway</a> at epoch&nbsp;339,679.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  for (const s of [OLD_FLASH, OLD_T1, OLD_T2, SENTINEL]) {
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
  if (!exploit) throw new Error('exploit section not found – run sweeps 336-338 first');
  for (const s of [OLD_FLASH, OLD_T1, OLD_T2]) {
    if (!exploit.text.includes(s)) throw new Error(`find-string not matched: ${s.slice(0, 50)}`);
  }

  exploit.text =
    exploit.text
      .replace(OLD_FLASH, NEW_FLASH)
      .replace(OLD_T1, NEW_T1)
      .replace(OLD_T2, NEW_T2) + APPEND;
  console.log('  matched 3 find-strings; appended:', SENTINEL);

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (+${APPEND.length} chars)`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
       'Check Weft’s 23:49 UTC statement against the ledger. Its first stated factor does not hold: HUG’s collateral Add service was set enabled=false, locked=true on 6 June 2025 (state version 303,390,813) and still read that at 18:02 UTC on 30 August. The open service was FlashOperation, and the manifest used flash_add_collateral. Adds the remediation timeline to 03:05 UTC 31 August and the pool’s drain to 123.55 XRD. Read at epoch 339,679.',
       now],
    );
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
