/**
 * Sweep 439 — ideas rotation. Re-measure the zero-proposal active-set validators
 * the run-426 backlog item parked, and carry the result onto the two NetOps cards
 * that quote it.
 *
 * Both cards were written from a 13 September reading at epoch 340,611 and said
 * "20 of the 100 validators in the active set have made no proposals since
 * 11 September". Re-read pinned to that same epoch the set is 19, not 20 — and the
 * stake total the pages published, 265.6 million XRD / 5.8%, matches the 19 exactly,
 * so the stake was right and the count was one over.
 *
 * Measured 2026-09-16 at epoch 341,235 (state version 558,371,873, proposer round
 * timestamp 03:05:01Z) against mainnet.radixdlt.com:
 *   /state/validators/list paged in full  — 287 entities, 186 registered, 177 with stake,
 *     registered stake 4,611,948,588 XRD, top 50 91.08%, top 10 40.04%,
 *     50th radix.stake.fun 0.438%, 100th Malu 26,680, ranks 101+ 80,520 across 86,
 *     87 registered at 1M+.
 *   /statistics/validators/uptime from 2026-09-11T12:00:00Z over the top 100 by stake —
 *     15 on zero proposals, 219,701,553 XRD, 4.76% of registered stake.
 *   Pinned to at_ledger_state epoch 340,611 the same query returns 19 on zero,
 *     265,601,158 XRD, 5.77%.
 *   The four that left the set: Radix Charts V2, DoItForDan and Allnodes resumed
 *     proposing; XRDStake.com fell to rank 101 (20,003 XRD) without ever having
 *     entered the active set. First-proposal times found by bisecting
 *     proposals_made over from_ledger_state.timestamp:
 *       Radix Charts V2  09:48–10:14 UTC 14 Sept  (1,477 made since the restart)
 *       DoItForDan       10:40–11:06 UTC 14 Sept  (926 made)
 *       Allnodes         11:23–11:49 UTC 15 Sept  (363 made)
 *   Weft node stake vault 186,865,407.01 -> 186,302,880.49 XRD since 13 Sept, -562,526.52.
 *   Vunterslaush Staking re-registered: is_registered false at epochs 339,987 and
 *     340,611, true now, 10,289,091 XRD, 669 proposals made / 9 missed. It is one of
 *     the three 10M+ validators that unregistered after the restart; the other two,
 *     Blockshard and Fundamento Cripto, are still out.
 *
 * The Gateway 403s a bare urllib; every read above carried a User-Agent.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'epoch 341,235';

const EDITS = [
  {
    tagPath: 'ideas',
    slug: 'dao-grow-validator-set',
    version: '1.3.0',
    changeType: 'minor',
    message:
      'Re-measured the post-restart validator set at epoch 341,235 (16 September). '
      + 'Three of the zero-proposal validators are proposing again — Radix Charts V2 and '
      + 'DoItForDan on 14 September, Allnodes on 15 September — and a fourth left the top '
      + 'hundred, leaving 15 on zero holding 4.8% of registered stake against 19 on '
      + '13 September. Vunterslaush Staking, one of the three 10M+ validators that '
      + 'unregistered after the restart, has re-registered and is proposing. The 13 September '
      + 'count is restated as 19: re-read pinned to epoch 340,611 the set is 19, and the '
      + '265.6m XRD / 5.8% the page already published is that set exactly.',
    find: '<h2>After the restart (September 2026)</h2>',
    html:
      '<h2>After the restart (September 2026)</h2>'
      + '<p>Mainnet restarted on 11 September 2026 after a ten-day halt. Read again on '
      + '16 September at epoch 341,235, the set is still full and still thin at the bottom. '
      + '186 validators are registered, two fewer than in August, and 177 of them carry stake. '
      + 'The 100th by stake, Malu, holds 26,680 $XRD, well under half what the 100th held in '
      + 'August, and the 86 registered validators below it hold 80,520 $XRD between them. '
      + '87 hold a million $XRD or more, against 89 in August. Of the three validators holding '
      + 'over 10 million each that <a href="/contents/resources/radix-ecosystem-operational-status" '
      + 'rel="noopener">unregistered in the first two days after the restart</a>, one has come '
      + 'back: Vunterslaush Staking re-registered with 10.3 million $XRD behind it and has made '
      + '669 proposals and missed 9. Blockshard and Fundamento Cripto are still out.</p>'
      + '<p>A registered slot is also not a running node, and that count is coming down. At '
      + 'epoch 340,611 on 13 September, 19 of the 100 validators in the active set had made no '
      + 'proposals since noon UTC on 11 September, holding 265.6 million $XRD, 5.8% of '
      + 'registered stake. Three have since brought their nodes back, each to a clean record '
      + 'from the moment it returned: '
      + '<a href="https://dashboard.radixscan.io/network-staking/validator_rdx1svxx0jetjwnptndj60sm8h7ljs0v88fl6xhwcyp6ar397agwd0ezaz" '
      + 'target="_blank" rel="noopener">Radix Charts V2</a> at about 10:00 UTC on 14 September, '
      + 'DoItForDan about an hour later, and Allnodes at about 11:30 UTC on 15 September. A '
      + 'fourth, XRDStake.com, dropped to 101st by stake without ever having entered the active '
      + 'set. Fifteen are still on zero, holding 219.7 million $XRD, 4.8% of registered stake, '
      + 'and 186.3 million of that sits on one validator, '
      + '<a href="https://dashboard.radixscan.io/network-staking/validator_rdx1sd6n65sx0thvfzfp6x0jp4qgwxtudpx575wpwqespdlva2wldul9xk" '
      + 'target="_blank" rel="noopener">the Weft Finance node</a>, sixth by stake, which has now '
      + 'missed 19,659 proposals in a row. Fourteen of the fifteen have sat in the active set for '
      + 'all 1,332 epochs since the restart and missed every proposal they were due; the '
      + 'fifteenth, betahk.io, is inside the top hundred by stake but the Gateway records it as '
      + 'never entering the active set at all. The <a href="/contents/tech/core-concepts/consensus-manager" '
      + 'rel="noopener">consensus manager</a> pays emissions only for successful proposals, so '
      + 'these earn nothing and neither does the stake behind them &ndash; and that stake is '
      + 'leaving: 562,527 $XRD has been unstaked from the Weft node since 13 September. '
      + 'Recruitment has two gaps to fill after the restart: stake behind the smallest slots, and '
      + 'operators who bring their nodes back.</p>',
  },
  {
    tagPath: 'ideas',
    slug: 'dao-validator-subsidy-future',
    version: '1.3.0',
    changeType: 'minor',
    message:
      'Re-measured concentration and the uptime gap at epoch 341,235 (16 September). '
      + 'Registered stake 4.61bn $XRD, top 50 91.1%, top 10 40.0%, 50th validator 0.438%. '
      + 'The zero-proposal set is down from 19 to 15 as three operators returned; the '
      + 'delegated stake behind the largest of them is now leaving. 13 September count '
      + 'restated as 19, per the re-read on the recruitment card.',
    find: '<h2>After the restart (September 2026)</h2>',
    html:
      '<h2>After the restart (September 2026)</h2>'
      + '<p>Read again on 16 September 2026 at epoch 341,235, five days after mainnet restarted, '
      + 'concentration has not moved off the August reading and is still above the one the RFC '
      + 'argues from. Registered validators hold 4.61 billion $XRD, 161 million less than in '
      + 'August. The top 50 hold 91.1% of it and the top 10 hold 40.0%, and the 50th validator, '
      + 'radix.stake.fun, holds 0.438% &ndash; against the roughly 85% top-50 share the RFC '
      + 'weighs the decision on, and less than half its ~1% median target.</p>'
      + '<p>The restart also produced the uptime problem pseudo-jailing is meant to handle, and '
      + 'it is clearing slowly rather than not at all. 19 of the 100 validators in the active set '
      + 'had made no proposals since 11 September when this was read at epoch 340,611; three have '
      + 'since brought their nodes back and one fell out of the top hundred, leaving 15 on zero '
      + 'and holding 4.8% of registered stake against 5.8% three days earlier. '
      + '<a href="/ideas/dao-grow-validator-set" rel="noopener">The recruitment card</a> has the '
      + 'measurement. The protocol keeps them in the set while they earn no emissions, so their '
      + 'delegators earn nothing until the operator returns or the stake moves &ndash; and the '
      + 'stake is moving: 562,527 $XRD has been unstaked from the largest of the fifteen, the '
      + 'Weft Finance node, in the three days since. That is the mechanism pseudo-jailing would '
      + 'replace with a rule, and the rate at which delegators find it on their own is the '
      + 'measure of what the rule is worth.</p>',
  },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);

    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(SENTINEL)) {
      console.log(`  ${e.slug}: already carries "${SENTINEL}" — no write`);
      continue;
    }

    const i = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes(e.find));
    if (i < 0) throw new Error(`${e.slug}: section marker not found`);

    const text = blocks[i].text;
    const start = text.indexOf(e.find);
    const after = text.indexOf('<h2>Deliverables</h2>', start);
    if (after < 0) throw new Error(`${e.slug}: Deliverables heading not found after the section`);
    blocks[i] = { ...blocks[i], text: text.slice(0, start) + e.html + text.slice(after) };

    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}`
      + `  (${text.length} -> ${blocks[i].text.length} chars in block ${i})`);
    if (DRY) { console.log('    new section:\n' + e.html.replace(/></g, '>\n<').slice(0, 4000)); continue; }

    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
    console.log('    written');
  }
});
