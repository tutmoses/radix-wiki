/**
 * Sweep 504 – ideas rotation. The NetOps recruitment card's staleness head
 * (dao-grow-validator-set, last edited 16 September) re-measured, with the new
 * pressure on the operators who are running: seven queued fee rises and the
 * Community Council Node's announced shutdown.
 *
 * Measured 2026-09-28 at epoch 344,883 (state version 560,210,156, proposer round
 * timestamp 19:06:20Z) against mainnet.radixdlt.com, every read with a User-Agent:
 *   /state/validators/list paged in full – 288 entities, 186 registered, 177 with stake,
 *     registered stake 4,683,157,289 XRD, 87 at 1M+, 100th "$pepe" 41,656,
 *     ranks 101+ 107,193 across 86.
 *   effective_fee_factor – stake-weighted fee 22.57% now, 25.03% with the seven
 *     pending entries applied at today's stake. Pending: Radix Charts V2 0.025 -> 0.15
 *     at 345,107; DoItForDan 0.05 -> 0.15 at 345,108; Radstakes 0.25 -> 0.40,
 *     RadixStake 0.149 -> 0.2989, Sirius and Polaris 0 -> 0.25 at 347,421;
 *     RadixTalk 0.015 -> 0.50 at 348,297. The first two are new since run 498.
 *   /statistics/validators/uptime from 2026-09-21T19:00Z over the top 100 by stake –
 *     14 with zero proposals made, 218,011,048 XRD, 4.66% of registered stake;
 *     WEFT 184,638,974 XRD, 0 made / 38,997 missed, 2,016 epochs active.
 *   Community Council Node validator_rdx1svheuu... registered, 22,157,802 XRD, fee 1.0.
 *     Shutdown announced by Tadkis in t.me/radix_dlt/1005328 at 10:03 UTC 28 Sep
 *     (author read via ?embed=1&mode=tme).
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ideas';
const SLUG = 'dao-grow-validator-set';
const VERSION = '1.4.0';
const SENTINEL = 'epoch 344,883';
const FIND = '<h2>Deliverables</h2>';

const dash = (addr, label) =>
  `<a href="https://dashboard.radixscan.io/network-staking/${addr}" target="_blank" rel="noopener">${label}</a>`;

const HTML =
  '<h2>Operators raising fees (late September 2026)</h2>'
  + '<p>Read on 28 September at epoch 344,883, the set has held its post-restart shape: 186 '
  + 'validators registered, 177 with stake and 87 with a million $XRD or more. The 100th by '
  + 'stake holds 41,656 $XRD and the 86 below it hold 107,193 between them. Over the seven days '
  + 'to 28 September, 14 validators in the top hundred made no proposals, holding 218m $XRD, '
  + '4.7% of registered stake, and 185m of that is still on '
  + dash('validator_rdx1sd6n65sx0thvfzfp6x0jp4qgwxtudpx575wpwqespdlva2wldul9xk', 'the Weft Finance node')
  + ', which missed all 38,997 proposals it was due that week.</p>'
  + '<p>The operators who are running are raising their fees. Seven validators holding 490m '
  + '$XRD between them have queued a higher fee on-ledger, which the protocol applies at a '
  + 'fixed future epoch so delegators can move first. Once all seven apply, the stake-weighted '
  + 'fee across the set rises from 22.6% to 25.0% at today\'s stake; it was 20.6% on 7 August. On 28 September Tadkis '
  + '<a href="https://t.me/radix_dlt/1005328" target="_blank" rel="noopener">announced the '
  + 'shutdown</a> of the '
  + dash('validator_rdx1svheuuvqlmp4l2mhx99m7xldk8tk2lu8kfjgdvxaes9xevpuww63se', 'Community Council Node')
  + ', which charges a 100% fee to fund the Community Council\'s marketing, business development '
  + 'and events: at the current price its income no longer covers the Council\'s work or the '
  + 'node\'s own infrastructure. It was still registered at epoch 344,883 with 22m $XRD behind '
  + 'it. The <a href="/contents/history/validator-subsidy-sunset" rel="noopener">end of the '
  + 'Foundation\'s validator subsidy</a> left fee income as an operator\'s only revenue, so '
  + 'recruitment now also has to keep the operators already in the set.</p>'
  + '<table><thead><tr><th>Validator</th><th>Stake (28 Sep)</th><th>Fee now</th>'
  + '<th>Queued fee</th><th>From epoch</th></tr></thead><tbody>'
  + `<tr><td>${dash('validator_rdx1svxx0jetjwnptndj60sm8h7ljs0v88fl6xhwcyp6ar397agwd0ezaz', 'Radix Charts V2')}</td><td>24m</td><td>2.5%</td><td>15%</td><td>345,107 (29 Sep)</td></tr>`
  + `<tr><td>${dash('validator_rdx1swtu7kg5p75g2j2r9x87kvcmjlhx48vw60w8l0qu84qdcfkyzhsdlw', 'DoItForDan')}</td><td>10m</td><td>5%</td><td>15%</td><td>345,108 (29 Sep)</td></tr>`
  + '<tr><td><a href="/ecosystem/radstakes" rel="noopener">Radstakes</a></td><td>93m</td><td>25%</td><td>40%</td><td>347,421 (about 7 Oct)</td></tr>'
  + '<tr><td><a href="/ecosystem/radixstake" rel="noopener">RadixStake</a></td><td>108m</td><td>14.9%</td><td>29.9%</td><td>347,421 (about 7 Oct)</td></tr>'
  + '<tr><td><a href="/ecosystem/caviarnine" rel="noopener">Sirius</a></td><td>106m</td><td>0%</td><td>25%</td><td>347,421 (about 7 Oct)</td></tr>'
  + '<tr><td><a href="/ecosystem/caviarnine" rel="noopener">Polaris</a></td><td>76m</td><td>0%</td><td>25%</td><td>347,421 (about 7 Oct)</td></tr>'
  + '<tr><td><a href="/ecosystem/radixtalk" rel="noopener">RadixTalk</a></td><td>73m</td><td>1.5%</td><td>50%</td><td>348,297 (about 10 Oct)</td></tr>'
  + '</tbody></table>'
  + '<p>Figures read from the Radix Gateway\'s validator list and uptime statistics at epoch '
  + '344,883. The <a href="/ideas/dao-validator-subsidy-future" rel="noopener">subsidy card</a> '
  + 'covers whether the DAO should pay operators directly.</p>';

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log(`  already carries "${SENTINEL}" – no write`);
    return;
  }
  const i = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes(FIND));
  if (i < 0) throw new Error('Deliverables marker not found');
  blocks[i].text = blocks[i].text.replace(FIND, HTML + FIND);

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  if (DRY) { console.log(HTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')); return; }

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
      'Run 504: re-measured the set at epoch 344,883 (28 Sep): 186 registered, 177 staked, 87 at 1M+; '
      + '14 top-100 validators on zero proposals over 7 days (218m XRD, 4.7%), 185m on the Weft node. '
      + 'New section on operators raising fees: seven queued fee rises on 490m XRD (stake-weighted fee '
      + '22.6% -> 25.0%), two of them (Radix Charts V2, DoItForDan) new since 27 Sep, and the Community '
      + 'Council Node shutdown announced by Tadkis in t.me/radix_dlt/1005328.',
      now]);
  await client.query('COMMIT');
});
