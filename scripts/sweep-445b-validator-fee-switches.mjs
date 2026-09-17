// sweep 445b – ecosystem rotation, three validator pages whose queued fee changes the
// 1–11 September halt had frozen, re-read from the Gateway at epoch 341,523
// (03:07 UTC 17 September 2026, state version ~558,510,500).
//
// leafnode: the 100% fee queued for epoch 341,223 is now in force. The request still reads
//   new_fee_factor 1 / epoch_effective 341,223 and the stored validator_fee_factor 0.01 –
//   the lazy reconciliation documented on /contents/tech/core-concepts/validator-nodes.
//   25,576,431.56 XRD, rank 41 of 186 registered (sorted stake_vault), active this epoch;
//   pending-withdrawal vault 550,250.34 XRD.
// avaunt-staking: the page dated the 25% fee to 9–10 September, which the halt voided. The
//   request still names epoch 342,482 (~80 h out, about 20 September) and the owner-stake
//   release 346,514 (~4 October). 138,838,023.38 XRD, rank 9 of 186, 3.01% of active stake.
//   StakeSafe's two 25% requests (339,608 / 339,609) passed before the halt.
// supreme-stake: control changed hands. The owner badge [83388a3f…7dc] was exercised from
//   account_rdx168lsh…d02ayy (13 badge transactions, back to at least August 2024), which
//   unregistered the node at 15:23 UTC 11 September and sent the badge to
//   account_rdx129capd…w3n0 at 01:03 UTC 12 September, with no payment in that transaction.
//   The new holder re-registered (05:20), queued update_fee 0.2 (05:58, effective 344,149),
//   set name "Daffy (Supreme)", icon on radbullx's CDN and info_url radbullx.com (07:59), and
//   began unlocking 543,652.31 owner stake units (11:47). That update_fee folded the old 5%
//   request into the stored field, which now reads 0.05. 51,500,302.61 XRD, rank 34 of 186.
//
//   node scripts/sweep-445b-validator-fee-switches.mjs --dry-run

import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;
const tx = (id, text) => ext(`https://dashboard.radixdlt.com/transaction/${id}/summary`, text);
const GATEWAY = ext('https://mainnet.radixdlt.com/state/validators/list', 'Radix Gateway');
const VNODES = int('/contents/tech/core-concepts/validator-nodes', 'Validator Nodes');
const HALT = int('/contents/history/hyperlane-asset-drain-2026', 'restarted on 11 September 2026');

const EDITS = [
  {
    slug: 'leafnode',
    version: '4.3.0',
    sentinel: 'The 100% fee in force (16 September 2026)',
    swaps: [
      [/<td>1%, with a (<a [^>]*>)100% fee<\/a> queued for epoch&nbsp;341223, which the halted ledger has not reached<\/td>/,
       (_, a) => `<td>${a}100%</a> since epoch&nbsp;341,223 (16 September 2026); the stored field still reads 1%</td>`],
      ['<td>25,719,752.92 XRD active, rank 45 of 100; a further 8,550,966.92 XRD unstaking (epoch&nbsp;337470, 23 Aug 2026)</td>',
       '<td>25,576,432 XRD, rank 41 of 186 registered; 550,250 XRD awaiting withdrawal (17 Sep 2026)</td>'],
      [/Status note, 23 August 2026: Leaf Node deregistered on 10 August 2026 and re-registered on 16 August; it is validating again, ranked 45th of the 100 validators in the active set, with a 100% fee queued for early September and its website still offline\./,
       'Status note, 17 September 2026: Leaf Node deregistered on 10 August 2026 and re-registered on 16 August. It is validating, and since 16 September it has charged a 100% fee, so its delegators earn nothing; its website is still offline.'],
    ],
    append: `<h2>The 100% fee in force (16 September 2026)</h2><p>The fee switch has taken effect. Epoch 341,223 arrived on 16 September 2026, and from that epoch Leaf Node keeps the whole of the emission its delegators&#39; stake earns. Read from the ${GATEWAY} at epoch 341,523 on 17 September, the request still reads <code>new_fee_factor</code> 1 with <code>epoch_effective</code> 341,223, and the stored <code>validator_fee_factor</code> still reads 0.01. The engine updates the stored field only when the owner next changes the fee, so any tool that shows the stored field reports 1% (see ${VNODES}).</p><p>The validator is registered and in the active set, ranked 41st of the 186 registered validators, with <strong>25,576,432 XRD</strong> delegated, 143,321 XRD less than on 23 August. Delegators can unstake at any time; stake left in place earns nothing.</p>`,
    message: 'The 100% fee queued for epoch 341,223 took effect on 16 September 2026 (read at epoch 341,523; stored fee field still 0.01, request 1). Infobox fee and stake rows, the status note, and a new dated section. 25,576,432 XRD, rank 41 of 186 registered.',
  },
  {
    slug: 'avaunt-staking',
    version: '3.1.0',
    sentinel: 'The new fee date (17 September 2026)',
    swaps: [
      [/At the network(?:&#39;|')s measured pace of roughly 288 epochs a day, the fee rise lands around <strong>9&ndash;10 September 2026<\/strong> and the owner-stake release around 23&ndash;24 September\./,
       'At the pace the network kept before the halt described below, the fee rise was due around 9&ndash;10 September 2026 and the owner-stake release around 23&ndash;24 September.'],
      [/to a 25% fee in mid-September\./, 'to a 25% fee.'],
      [/StakeSafe(&#39;|'|&rsquo;)s own two validators have the identical 25% queued at epochs 339,608 and 339,609, days away;/,
       (_, q) => `StakeSafe${q}s own two validators went to the same 25% at epochs 339,608 and 339,609, around 30 August;`],
    ],
    afterSentinelOf: 'Nothing about the fee rise was in the announcement',
    insert: `<h3>The new fee date (17 September 2026)</h3><p>The 25% fee has not taken effect yet. The network produced no epochs for ten days before it ${HALT}, so the dates above slipped. Read from the ${GATEWAY} at epoch 341,523 on 17 September, the request still names epoch 342,482, which at five minutes an epoch falls around <strong>20 September 2026</strong>; the owner-stake release at epoch 346,514 falls around 4 October. The validator still charges 2% and holds <strong>138,838,023 XRD</strong>, 3.0% of the stake in the active set and rank 9 of the 186 registered validators. 3.3m XRD has been withdrawn since 28 August.</p>`,
    message: 'The 1-11 September halt voided the page\'s 9-10 September date for the 25% fee. Read at epoch 341,523 (17 September 2026): the request still names epoch 342,482, about 20 September; owner-stake release about 4 October; 138,838,023 XRD, rank 9 of 186. StakeSafe\'s own 25% requests passed around 30 August.',
  },
  {
    slug: 'supreme-stake',
    version: '3.1.0',
    sentinel: 'New owner and new name (September 2026)',
    swaps: [
      ['<td>🟢 Active – registered, accepting delegations</td>',
       '<td>🟢 Active – registered, accepting delegations; renamed &ldquo;Daffy (Supreme)&rdquo; on 12 Sep 2026</td>'],
      ['<td>≈66.0 million XRD (rank #27)</td>', '<td>≈51.5 million XRD (rank 34, 17 Sep 2026)</td>'],
      ['<td>5% (raised from an original 1.5%)</td>', '<td>5%, rising to 20% at epoch 344,149 (about 26 Sep 2026)</td>'],
      ['is, on the numbers below, one of the thirty largest validators on the network.</p>',
       'is, on the numbers below, one of the forty largest validators on the network. In September 2026 control of the validator passed to a new account, which renamed it.</p>'],
      [/<h2>Fee<\/h2><p>The validator fee is <strong>5%<\/strong>[\s\S]*?5% is the figure delegators actually pay\.<\/p>/,
       `<h2>Fee</h2><p>The validator fee is <strong>5%</strong>, raised from the 1.5% it charged originally. Until 12 September 2026 the component&rsquo;s stored <code>validator_fee_factor</code> still read 0.015, while the 5% sat in a <code>validator_fee_change_request</code> whose epoch had long passed. The engine charges such a request and updates the stored field only when the owner next changes the fee; the mechanism is described under ${VNODES}. The fee change queued on 12 September did that, so the stored field now reads 0.05 and the new request holds <strong>20%</strong> from epoch 344,149. At epoch 341,523, 61 of the network&rsquo;s 186 registered validators charge a fee that differs from their stored field.</p>`],
    ],
    beforeSentinelOf: '<h2>External Links</h2>',
    insert: `<h2>New owner and new name (September 2026)</h2><p>Supreme Stake&rsquo;s validator changed hands the day after the network restarted. Control of a Radix validator sits with its owner badge, a non-fungible token held in an ordinary account, so the handover shows in where that badge went and what it signed. Read from the ${GATEWAY} on 17 September 2026:</p><ul><li><strong>11 September, 15:23 UTC</strong>: the account that had used the badge since at least August 2024, <code>account_rdx168lsh&hellip;d02ayy</code>, unregistered the validator.</li><li><strong>12 September, 01:03 UTC</strong>: the same account ${tx('txid_rdx1t25fl2yuqpcn4ylvg2vzw5l9l5p6lsznx7fa2ausqy0tjuc624lq27mej0', 'sent the badge')} to <code>account_rdx129capd&hellip;w3n0</code>. No payment moved in that transaction.</li><li><strong>05:20 UTC</strong>: the new holder rotated the node&rsquo;s key and ${tx('txid_rdx1s2eqw8edvljt3plupp9ewqerm2z2aquz6a4dsthmwyqakqta46yshngv4n', 'registered the validator again')}.</li><li><strong>05:58 UTC</strong>: it ${tx('txid_rdx1540huv37tc25x2tjhucxvtyh4pjjecyfl5eel7u3x4zv5zukheys4d9nsq', 'queued a fee of 20%')}, effective at epoch 344,149.</li><li><strong>07:59 UTC</strong>: it ${tx('txid_rdx1jg4t3eq2fmggut8ykw4csy7j7eu6mwjz8pqfj7m2gu0ptlyx8ehs58kcfj', 'renamed the validator')} &ldquo;Daffy (Supreme)&rdquo; and pointed its <code>info_url</code> at radbullx.com, a site titled Rad Bull X.</li><li><strong>11:47 UTC</strong>: it ${tx('txid_rdx1n0jeryruakfd6gsd06wvkkchftg7tkm5jtkvrzvrk07yclrp4pyqj6sszy', 'began unlocking')} 543,652 owner stake units.</li></ul><p>At epoch 341,523 the validator is registered and in the active set with <strong>51,500,303 XRD</strong>, rank 34 of the 186 registered validators, and charges 5%. The 20% applies from epoch 344,149, around 26 September 2026 at five minutes an epoch, and delegators who do not want the new rate can unstake before then. Delegated stake has fallen by 14.9m XRD since 14 August. No announcement of the new owner has been found; this account is the ledger&rsquo;s.</p>`,
    message: 'Control changed hands: the owner badge moved to a new account on 12 September 2026 (no payment in that transaction), which re-registered the node, queued a 20% fee from epoch 344,149 (about 26 September), renamed it "Daffy (Supreme)" with info_url radbullx.com, and began unlocking 543,652 owner stake units. Fee section rewritten (stored field now 0.05); infobox stake 51.5m XRD, rank 34 of 186, read at epoch 341,523.',
  },
];

function swapOnce(blocks, [from, to]) {
  let hits = 0;
  const visit = (list) => list.map((b) => {
    let next = b;
    if (typeof b.text === 'string') {
      const has = from instanceof RegExp ? from.test(b.text) : b.text.includes(from);
      if (has) { hits++; next = { ...b, text: b.text.replace(from, to) }; }
    }
    if (Array.isArray(b.blocks)) next = { ...next, blocks: visit(b.blocks) };
    return next;
  });
  const out = visit(blocks);
  if (hits !== 1) throw new Error(`expected 1 match, got ${hits}: ${String(from).slice(0, 60)}`);
  return out;
}

const indexOfText = (blocks, needle) => {
  const hits = blocks.map((b, i) => (b.text?.includes(needle) ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) throw new Error(`expected 1 block containing ${needle.slice(0, 40)}, got ${hits.length}`);
  return hits[0];
};

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage('ecosystem', e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      "SELECT id, title, version, content FROM pages WHERE tag_path = 'ecosystem' AND slug = $1", [e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied - no write`);
      continue;
    }
    let blocks = JSON.parse(JSON.stringify(page.content));
    for (const s of e.swaps) blocks = swapOnce(blocks, s);
    if (e.append) blocks.push({ id: uid(), type: 'content', text: e.append });
    if (e.afterSentinelOf) blocks[indexOfText(blocks, e.afterSentinelOf)].text += e.insert;
    if (e.beforeSentinelOf) blocks.splice(indexOfText(blocks, e.beforeSentinelOf), 0, { id: uid(), type: 'content', text: e.insert });
    const json = JSON.stringify(blocks);
    const [NBSP, EMDASH] = [0xa0, 0x2014].map((c) => String.fromCharCode(c));
    if (json.includes(NBSP) || (json.includes(EMDASH) && !JSON.stringify(page.content).includes(EMDASH))) {
      throw new Error(`${e.slug}: U+00A0 or a new em dash in output`);
    }
    if (!json.includes(e.sentinel)) throw new Error(`${e.slug}: sentinel missing after edits`);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (${e.swaps.length} swaps, ${blocks.length - page.content.length} new blocks)`);
    if (DRY) continue;

    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, 'minor', AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
    console.log('    written and stamped');
  }
});
