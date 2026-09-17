// sweep 449 – /ecosystem/weft-finance, "Validator offline since the restart" (added by run 432 on 15 September).
//
// Everything below read on 17 September 2026 from the Radix Gateway (mainnet.radixdlt.com), validator
// validator_rdx1sd6n65sx0thvfzfp6x0jp4qgwxtudpx575wpwqespdlva2wldul9xk:
//   /statistics/validators/uptime, current state (17:24 UTC, epoch 341,695):
//     from 2026-09-11T00:00Z (the halted ledger, epoch 339,897)  made 0  missed 28,006  epochs 1,797
//     from 2026-09-14T21:00Z  made 0 missed 14,833;  from 2026-09-16T17:00Z  made 0 missed 5,290;
//     from 2026-09-17T12:00Z  made 0 missed 1,167
//   the same, pinned with at_ledger_state:
//     2026-08-16T00:00Z -> halt (21:19:48.939 UTC 31 Aug)  made 309,123  missed 83
//     2026-08-31T18:00Z -> halt                             made 2,025    missed 4
//     2026-08-01T00:00Z -> 2026-08-31T20:00Z                made 556,774  missed 299
//     2026-09-10T00:00Z -> 2026-09-11T12:00Z                made 0        missed 18   (after the 11:35 restart)
//   Run 432's "306,548 made, 100 missed in the fifteen days before the halt" subtracted the since-noon
//   count from a from-16-August window, so its 100 carries the 18 missed between 11:35 and noon on
//   11 September. Replaced with the pinned reading.
//   XRD per stake unit (stake vault / pool-unit total_supply), at_ledger_state:
//     WEFT       11 Sep 13:00 1.174307 (195,292,042 XRD)  15 Sep 21:00 1.174307 (186,302,880)  17 Sep 17:00 1.174307 (186,151,416)
//     MattiaNode 11 Sep 13:00 1.226173                    15 Sep 21:00 1.227109                17 Sep 17:00 1.227503
//   /state/validators/list: registered, accepting stake, fee 1%, rank 6 of 186 registered, active-set
//     stake_percentage 4.03. Metadata unchanged (name WEFT, "Weft Finance validator node", info_url
//     docs.weft.finance).
//   Unstake delay: Weft claim NFT minted at epoch 341,663 carries claim_epoch 343,679, i.e. 2,016 epochs.
// Telegram WeftFinance, 9-17 September (radix-studio scout-telegram.mjs): t.me/WeftFinance/32904-32906,
//   16 September 13:13-13:16 UTC, embed author "Atoumbre | Weft" (t.me/atoumbre_weft), no forward
//   header: the team had some days off, has not abandoned the project, plans to restart the validator,
//   and will share details of its next move "this Friday" (18 September). No team post earlier in the window.
// X: xread --search 'from:weft_finance' returns 0 in the seven days to 17 September.
// weft.finance (200, 17 September) still carries "Stake XRD with Weft Validator" with this address.
//
// Also converts the page's six em dashes to en dashes and its seven literal U+00A0 (each after a
// check-mark emoji in the roadmap list) to plain spaces.
//
//   node scripts/sweep-449-weft-validator-downtime.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG = 'ecosystem';
const SLUG = 'weft-finance';
const VERSION = '4.11.0';
const BLOCK_ID = 'e248f39c-72f7-448e-9178-ec1f7189227e';
const SENTINEL = 't.me/WeftFinance/32906';
const EMDASH = String.fromCharCode(0x2014);
const NBSP = String.fromCharCode(0xa0);

const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;

const SECTION =
  '<h2>Validator offline since the restart</h2>'
  + `<p>Weft also runs a validator, which its on-ledger metadata names the ${ext('https://dashboard.radixdlt.com/network-staking/validator_rdx1sd6n65sx0thvfzfp6x0jp4qgwxtudpx575wpwqespdlva2wldul9xk', 'Weft Finance validator node')}. `
  + 'On 17 September 2026 it held 186.2m XRD of delegated stake, the sixth-largest of the 186 validators registered on Radix and 4% of the stake in the active set, the 100 validators that run consensus.</p>'
  + `<p>The node ran normally up to the halt that followed the ${int('/contents/history/hyperlane-asset-drain-2026', 'Hyperlane asset drain')}. `
  + 'From 16 August until the ledger stopped at 21:19 UTC on 31 August it made 309,123 proposals and missed 83, including 2,025 made and 4 missed after 18:00 UTC that day. '
  + 'It has made none since mainnet restarted at 11:35 UTC on 11 September. '
  + `The ${ext('https://docs.radixdlt.com/docs/network-gateway', 'Radix Gateway')} uptime statistics count 28,006 proposals missed and none made between the restart and 17:24 UTC on 17 September, over the 1,797 epochs the node spent in the active set in that time.</p>`
  + `<p>Its delegators have earned nothing since. ${int('/contents/tech/core-concepts/staking', 'Staking rewards')} are added to a validator’s stake, so each of its stake units redeems for a little more XRD every epoch the node validates. `
  + `A Weft stake unit redeemed for 1.174307 XRD at 13:00 UTC on 11 September and for the same amount at 17:00 UTC on 17 September; over the same six days a ${int('/ecosystem/mattianode', 'MattiaNode')} unit rose from 1.226173 to 1.227503 XRD. `
  + 'Delegators unstaked 9m XRD from Weft’s node in the first four days after the restart, taking it from 195.3m to 186.3m, and a further 151,000 XRD in the two days after that.</p>'
  + `<p>Weft’s team posted on 16 September for the first time since the restart. In ${ext('https://t.me/WeftFinance/32906', 'Weft’s Telegram group')} at 13:16 UTC, co-founder Atoumbré Kouassi wrote that the team had taken some days off, had not abandoned the project, and plans to restart the validator. `
  + `The message came two days after a member ${ext('https://t.me/WeftFinance/32896', 'asked in the same group')} for the node to be shut down and unregistered if the project had been left, so that delegators would know to move. `
  + `The node had not restarted by the Gateway reading above, a day later. Weft had posted nothing on ${ext('https://x.com/weft_finance', 'X')} in the seven days to then, and ${ext('https://weft.finance', 'weft.finance')} still invites visitors to stake with the node.</p>`
  + '<p>A delegator who moves unstakes from the node, waits 2,016 epochs, about seven days, and stakes the XRD with another validator; one who stays earns nothing until the node proposes again. '
  + 'Kouassi said the team would share details of its next move on Friday 18 September.</p>';

const MESSAGE =
  'Validator section re-read on 17 September 2026. Weft co-founder Atoumbré Kouassi said in the Weft Telegram group on 16 September '
  + '(t.me/WeftFinance/32906) that the team has not abandoned the project and plans to restart the validator, with details due on Friday 18 September. '
  + 'The node is still at zero: Radix Gateway /statistics/validators/uptime reads 0 made and 28,006 missed from the 11 September restart to 17:24 UTC on '
  + '17 September, over 1,797 epochs. Pre-halt figure corrected from 306,548 made / 100 missed to a pinned read of 309,123 made / 83 missed from 16 August '
  + 'to the 21:19 UTC halt on 31 August (the old 100 included 18 missed after the restart), with 2,025 made / 4 missed after 18:00 UTC that day. '
  + 'Stake unit unchanged at 1.174307 XRD since 11 September (MattiaNode 1.226173 -> 1.227503); stake 186.15m XRD. No post from @weft_finance in seven days; '
  + 'weft.finance still asks visitors to stake with the node. Six em dashes and seven non-breaking spaces elsewhere on the page converted.';

const clean = (list) => list.map((b) => ({
  ...b,
  ...(typeof b.text === 'string'
    ? { text: b.text.replaceAll(` ${EMDASH} `, ' – ').replaceAll(EMDASH, ' – ').replaceAll(NBSP, ' ') }
    : {}),
  ...(Array.isArray(b.blocks) ? { blocks: clean(b.blocks) } : {}),
}));

if (SECTION.includes(EMDASH) || SECTION.includes(NBSP) || SECTION.includes('&nbsp;')) throw new Error('section carries an em dash or non-breaking space');

await withClient(async (client) => {
  if (isLockedPage(TAG, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const before = JSON.stringify(page.content);
  if (before.includes(SENTINEL)) {
    console.log('  already applied - no write');
    return;
  }

  let blocks = JSON.parse(before);
  const target = blocks.find((b) => b.id === BLOCK_ID);
  if (!target) throw new Error('validator block missing');
  if (!target.text.startsWith('<h2>Validator offline since the restart</h2>') || !target.text.includes('14,415 proposals missed'))
    throw new Error('validator block no longer matches the 15 September text; re-read before editing');
  const dashes = before.split(EMDASH).length - 1;
  const spaces = before.split(NBSP).length - 1;
  target.text = SECTION;
  blocks = clean(blocks);
  assertLinkShapes(blocks, SLUG);

  const json = JSON.stringify(blocks);
  if (json.includes(EMDASH) || json.includes(NBSP)) throw new Error('em dash or U+00A0 left in output');
  if (!json.includes(SENTINEL)) throw new Error('sentinel missing after edit');

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (${json.length - before.length} chars; ${dashes} em dashes, ${spaces} U+00A0 converted)`);
  if (DRY) {
    console.log(`\n${SECTION.replace(/<\/p>/g, '</p>\n')}`);
    return;
  }

  const now = new Date().toISOString();
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now]);
  await client.query('COMMIT');
  console.log('  written');
});
