// sweep 432 – ecosystem rotation. Three validator pages, every figure read from the Radix Gateway at
// epoch 340,947 (state version ~558,232,500, 03:06 UTC 15 September 2026).
//
// 1. /ecosystem/weft-finance (v4.9.3). Run 426 banked it: the Weft Finance validator
//    (validator_rdx1sd6n65sx0thvfzfp6x0jp4qgwxtudpx575wpwqespdlva2wldul9xk) made no proposals after the
//    restart; "if still zero, add a dated line". Still zero: /statistics/validators/uptime from
//    2026-09-11T12:00Z reads proposals_made 0, missed 14,415; from 2026-08-16T03:00Z made 306,548, missed
//    14,515, so 100 missed before the halt. XRD per stake unit (stake vault / pool unit total_supply),
//    read at_ledger_state 2026-09-11T13:00Z, 2026-09-13T03:00Z and now: 1.174306743118275 all three
//    times (no emissions); MattiaNode's rose 1.2261726 -> 1.2265152 -> 1.2269485. Weft stake vault
//    195,292,041.89 -> 186,302,880.49. Rank 6 of 186 registered; active-set stake_percentage 4.0456.
//    X: xread --search 'from:weft_finance' and '@weft_finance OR weft_finance' both 0 in 7 days (control
//    from:radixdlt 7). Telegram WeftFinance scanned 5 days: no team post; t.me/WeftFinance/32896,
//    14 September 11:00 UTC, a member asks the team to shut the node down and unregister it.
// 2. /ecosystem/mattianode (v2.2.0, 10 August). Stake 54,899,270.00, rank 33 of 186, fee 0.015, no
//    pending change; 16 Aug-15 Sep made 100,640 missed 2; since restart made 4,914 missed 0. info_url now
//    https://stake.mattia.wiki/, which redirects to docs.mattia.wiki/radix/node/. That page (200, read
//    15 September) states the hardware (AMD Ryzen, 48 GB RAM, NVMe, synced backup node), self-hosting in
//    Italy off AWS/Azure/Google Cloud, GSE-certified renewable supply, Grafana/UptimeRobot/PagerDuty, the
//    2013 / Genesis Community / Foundation KYC line, the Ociswap 10% and Delphibets 25% bonuses, and the
//    Olympia address rv1qvjz...plkxy7 linked to explorer.radixdlt.com, which no longer resolves. The body's
//    unsourced 1 TB WD SN750 / 1 Gbit fiber / UPS / 4G LTE detail, the RadixTalk moderator claim, the
//    Desktop/Web Wallet steps and the generic Mission/Benefits/Security filler are dropped.
// 3. /ecosystem/radup (v3.0.1, 13 August, never verified). radup.io now 200 / 19,007 B, a Cloudflare
//    Pages site titled "RadUp.io – Radix Validator Node" giving the Babylon address and the Olympia-era
//    promises, fee answer pointing at the dashboard. www.radup.io (the on-ledger info_url) still 522.
//    Stake 25,268,253.10, rank 42 of 186 (was 36,315,647.36, rank 36, 6 August); fee stored 0.0195 with a
//    change to 0.15 effective epoch 312126; 16 Aug-15 Sep made 60,698 missed 16; since restart missed 0.
//
// Run:  node scripts/sweep-432-weft-validator-mattianode-radup.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const L = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;

const GATEWAY = 'https://docs.radixdlt.com/docs/network-gateway';
const DRAIN = '/contents/history/hyperlane-asset-drain-2026';
const STAKING = '/contents/tech/core-concepts/staking';
const WEFT_VAL = 'https://dashboard.radixdlt.com/network-staking/validator_rdx1sd6n65sx0thvfzfp6x0jp4qgwxtudpx575wpwqespdlva2wldul9xk';
const MATTIA_VAL = 'https://dashboard.radixdlt.com/network-staking/validator_rdx1s0qzv2vmxydpnglk36mczrdwczpsskuzek2cs5nnld6j533rzatmln';
const MATTIA_DOCS = 'https://docs.mattia.wiki/radix/node/';
const RADUP_VAL = 'https://dashboard.radixdlt.com/network-staking/validator_rdx1s0drhvkx30k62zu0usnzxzwuh0qcsqwlc2n2kfyexlyghqpctuy2fx';
const RADUP_WAYBACK = 'https://web.archive.org/web/20250401154431/https://www.radup.io/';
const RADUP_FEE_WAYBACK = 'https://web.archive.org/web/20250114224306/https://www.radup.io/our-fee';

const row = (k, v) => `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`;

const EDITS = [
  {
    tagPath: 'ecosystem', slug: 'weft-finance', version: '4.10.0', changeType: 'minor', verified: false,
    sentinel: '<h2>Validator offline since the restart</h2>',
    message: 'New section: the Weft Finance validator, sixth-largest on Radix with 186.3m XRD delegated, has made no proposal since mainnet restarted on 11 September (14,415 missed to epoch 340,947), and its stake units have redeemed for the same 1.174307 XRD since, so delegators earn nothing. Read from the Radix Gateway on 15 September 2026.',
    apply(blocks) {
      const i = blocks.findIndex((b) => b.id === 'b2da6579-2b78-497c-b997-5b609756b7f8');
      if (i < 0) throw new Error('weft exploit block missing');
      blocks.splice(i + 1, 0, {
        id: uid(), type: 'content',
        text: [
          `<h2>Validator offline since the restart</h2>`,
          `<p>Weft also runs a validator, which its on-ledger metadata names the ${A(WEFT_VAL, 'Weft Finance validator node')}. On 15 September 2026 it held 186.3m XRD of delegated stake, the sixth-largest of the 186 validators registered on Radix and about 4% of the stake in the active set, the 100 validators that run consensus.</p>`,
          `<p>The node has made no proposal since mainnet restarted on 11 September, after the halt that followed the ${L(DRAIN, 'Hyperlane asset drain')}. The ${A(GATEWAY, 'Radix Gateway')} uptime statistics count 14,415 proposals missed and none made between noon UTC that day and epoch 340,947 on 15 September. In the fifteen days before the halt it made 306,548 proposals and missed 100.</p>`,
          `<p>Its delegators have earned nothing since. ${L(STAKING, 'Staking rewards')} are added to a validator’s stake, so each of its stake units redeems for a little more XRD every epoch the node validates. A Weft stake unit redeemed for 1.174307 XRD at 13:00 UTC on 11 September and for the same amount on 15 September; over the same four days a ${L('/ecosystem/mattianode', 'MattiaNode')} unit rose from 1.22617 to 1.22695 XRD. Delegators unstaked about 9m XRD from Weft’s node in that time, down from 195.3m.</p>`,
          `<p>Weft had posted nothing about the node on X in the week to 15 September. In ${A('https://t.me/WeftFinance/32896', 'Weft’s Telegram group on 14 September')}, a member asked the team to shut the node down and unregister it if the project had been left, so that delegators know to move. A delegator who moves unstakes from the node, waits 2,016 epochs, about seven days, and stakes the XRD with another validator.</p>`,
        ].join('\n'),
      });
    },
  },
  {
    tagPath: 'ecosystem', slug: 'mattianode', version: '3.0.0', changeType: 'major', verified: true,
    sentinel: 'mainnet epoch 340,947, 15 September 2026',
    message: 'Rewritten from the operator’s page and the ledger. Stake 54.9m XRD (rank 33 of 186), fee 1.5% with no change pending, 2 proposals missed of 100,642 from 16 August to 15 September, read at epoch 340,947. Setup now cited to docs.mattia.wiki; unsourced hardware detail, the RadixTalk moderator claim, Desktop Wallet steps and generic filler removed; the page’s Olympia address and dead explorer link noted.',
    apply(blocks) {
      const info = blocks.find((b) => b.type === 'infobox')?.blocks[0];
      if (!info) throw new Error('mattianode infobox missing');
      info.text = `<table><tbody><tr><th colspan="2">MattiaNode</th></tr>` + [
        row('Type', 'Radix validator node'),
        row('Status', '🟢 Active – registered, accepting delegations'),
        row('Operator', 'Mattia'),
        row('Validator address', A(MATTIA_VAL, '<code>validator_rdx1s0qz&hellip;rzatmln</code>')),
        row('Total stake', '54.9m XRD (rank 33 of 186 registered)'),
        row('Validator fee', '1.5% (no pending fee change)'),
        row('Proposals', '100,640 made, 2 missed (16 August to 15 September 2026)'),
        row('Location', 'Italy, self-hosted (not on AWS, Azure or Google Cloud)'),
        row('Website', A(MATTIA_DOCS, 'docs.mattia.wiki/radix/node')),
        row('On-ledger', `Read from the ${A(GATEWAY, 'Radix Gateway')} at mainnet epoch 340,947, 15 September 2026`),
      ].join('') + `</tbody></table>`;

      const body = blocks.find((b) => b.id === 'block-mattianode-1');
      if (!body) throw new Error('mattianode body missing');
      body.text = [
        `<p><strong>MattiaNode</strong> is a validator on the Radix network, run by a community member who goes by Mattia. ${A(MATTIA_DOCS, 'The node’s page')} says its operator has invested in Radix since 2013, belongs to the Radix Genesis Community and has completed KYC with the Radix Foundation.</p>`,
        `<h2>Setup</h2>`,
        `<p>According to ${A(MATTIA_DOCS, 'the operator’s page')}, the node is self-hosted in Italy rather than on AWS, Azure or Google Cloud, on an AMD Ryzen machine with 48 GB of RAM and NVMe storage. A second server stays in sync, ready to take over during an outage. Grafana and UptimeRobot monitor the node, PagerDuty calls the operator when something fails, and the internet connection is redundant. The page says GSE, the Italian state company that certifies energy sources, certifies the electricity as coming from renewable plants.</p>`,
        `<p>Validators running outside the large cloud providers spread the network across more operators and locations; the ${L('/contents/tech/core-concepts/validator-nodes', 'validator nodes')} page covers how validators are chosen and paid.</p>`,
        `<h2>Staking with MattiaNode</h2>`,
        `<p>XRD is staked to the node from the Radix Wallet or from ${A(MATTIA_VAL, 'its page on the Radix Dashboard')}. The wallet receives liquid stake units (LSUs), tokens that redeem for the delegated XRD plus the rewards added to it, and unstaking returns the XRD after a delay of 2,016 epochs, about seven days (${L(STAKING, 'staking')}).</p>`,
        `<p>The operator’s page advertises two partner bonuses for delegators: 10% more OCI from ${L('/ecosystem/ociswap', 'Ociswap')} and 25% more DPH from ${L('/ecosystem/delphibets', 'Delphibets')}, each claimed by registering with a Telegram bot. It still gives the node’s Olympia-era address, <code>rv1qvjz&hellip;plkxy7</code>, and links it to explorer.radixdlt.com, which no longer resolves. That address does not work on ${L('/contents/tech/releases/radix-mainnet-babylon', 'Babylon')}, the network Radix has run since July 2023; the Babylon address is in the infobox.</p>`,
      ].join('\n');

      const ledger = blocks.find((b) => b.id === 'sweep218-mattianode-ledger');
      if (!ledger) throw new Error('mattianode ledger block missing');
      ledger.text = [
        `<h2>On-ledger record (September 2026)</h2>`,
        `<p>Read from the ${A(GATEWAY, 'Radix Gateway')} on 15 September 2026, the ${A(MATTIA_VAL, 'MattiaNode validator')} is registered and accepts delegated stake. It holds the 33rd-largest stake of the 186 registered validators, the same rank as on 10 August, although the stake itself has fallen from 59.3m XRD. Its fee factor is 0.015 with no fee change pending, so the 1.5% it stores is the 1.5% it charges; the ${L('/contents/tech/core-concepts/validator-nodes', 'validator nodes')} page explains why those two can differ.</p>`,
        `<p>From 16 August to 15 September the node missed 2 of its 100,642 proposals. Nobody proposed anything from 21:19 UTC on 31 August to 11:35 UTC on 11 September, while mainnet was halted after the ${L(DRAIN, 'Hyperlane asset drain')}, and since the restart the node has made 4,914 proposals without a miss. Each of its stake units redeemed for 1.22617 XRD at 13:00 UTC on 11 September and 1.22695 XRD on 15 September, the rewards it earned for its delegators in between.</p>`,
        `<p>The validator’s on-ledger <code>info_url</code> now reads <code>https://stake.mattia.wiki/</code>, which redirects to the operator’s page. Stake units are <code>resource_rdx1t5j&hellip;s7rj6f2w</code> and unstake claims <code>resource_rdx1n2y&hellip;a8a8372yw</code>.</p>`,
      ].join('\n');
    },
  },
  {
    tagPath: 'ecosystem', slug: 'radup', version: '4.0.0', changeType: 'major', verified: true,
    sentinel: 'the address the validator’s on-ledger metadata links',
    message: 'Rewritten as a live validator. radup.io is back online (read 15 September 2026) with a one-page site repeating the Olympia-era no-fee-increase promise, while www.radup.io, the on-ledger info_url, still returns 522. Ledger refreshed at epoch 340,947: stake 25.3m XRD (rank 42 of 186, was 36.3m and 36th on 6 August), fee 15% since epoch 312126, 16 proposals missed of 60,714 since 16 August. Past-tense Olympia body and Desktop Wallet steps replaced.',
    apply(blocks) {
      const info = blocks.find((b) => b.type === 'infobox')?.blocks[0];
      if (!info) throw new Error('radup infobox missing');
      info.text = `<table>` + [
        row('Category', 'Validator / Staking'),
        row('Network', `${L('/contents/tech/releases/radix-mainnet-babylon', 'Radix')} (mainnet)`),
        row('Type', 'XRD staking validator node'),
        row('Status', '🟢 Active (validator registered)'),
        row('Validator', A(RADUP_VAL, '<code>validator_rdx1s0d&hellip;ctuy2fx</code>')),
        row('Stake', '25.3m XRD (rank 42 of 186 registered, 15 September 2026)'),
        row('Fee', '15% since epoch 312126 (stored factor 1.95%)'),
        row('Proposals', '60,698 made, 16 missed (16 August to 15 September 2026)'),
        row('Website', A('https://radup.io/', 'radup.io')),
      ].join('') + `</table>`;

      const body = blocks.find((b) => b.id === 'block-radup-1');
      if (!body) throw new Error('radup body missing');
      body.text = [
        `<p><strong>RadUp.io</strong> is a validator on the Radix network. ${A('https://radup.io/', 'Its site')} describes a high-performance node serving the Radix community, and says the Radix team chose RadUp to run a validator on the betanet before mainnet, after which it kept a node on Stokenet, Radix’s public test network.</p>`,
        `<h2>Website</h2>`,
        `<p>${A('https://radup.io/', 'radup.io')} serves a one-page site again. This page recorded Cloudflare errors there from July to August 2026, 522 and then 523, both meaning Cloudflare could not reach the server behind the domain; on 15 September 2026 it answered with the site. <code>www.radup.io</code>, the address the validator’s on-ledger metadata links, still returned 522.</p>`,
        `<p>The site gives the Babylon validator address and links the node’s Radix Dashboard page. Its text is the Olympia-era copy: six promises, one of them “No fee increases for the duration of Olympia”, and an answer to what RadUp charges that points readers to the dashboard. ${L('/contents/tech/releases/radix-mainnet-olympia', 'Olympia')} ended when Radix moved to ${L('/contents/tech/releases/radix-mainnet-babylon', 'Babylon')} in July 2023, and the fee the node charges today is set out under On-ledger status below.</p>`,
        `<h2>Staking with RadUp</h2>`,
        `<p>XRD is staked to RadUp from the Radix Wallet or from ${A(RADUP_VAL, 'its Radix Dashboard page')}, using the address <code>validator_rdx1s0drhvkx30k62zu0usnzxzwuh0qcsqwlc2n2kfyexlyghqpctuy2fx</code>. The ${A(RADUP_WAYBACK, 'archived Olympia-era site')} gave <code>rv1q2twz&hellip;250d832l</code>, which does not resolve on Babylon. The current site asks delegators to follow what it calls the Radix team’s 5-by-5 rule: spread stake across five validators that each hold less than 5% of the total, and stake elsewhere if RadUp passes 5%.</p>`,
        `<h2>History</h2>`,
        `<p>On Olympia, RadUp’s ${A(RADUP_FEE_WAYBACK, 'fee page')} set a fixed fee of 1.95%, so that stakers kept more than 98% of their rewards, and promised no fee increase for the rest of that network. The old site told stakers to use the Radix desktop wallet, which Babylon replaced with the Radix Wallet and ${L(STAKING, 'liquid stake units')}.</p>`,
      ].join('\n');

      const ledger = blocks.find((b) => b.id === 'sweep196-radup-ledger');
      if (!ledger) throw new Error('radup ledger block missing');
      ledger.text = [
        `<h2>On-ledger status (September 2026)</h2>`,
        `<p>Read from the ${A(GATEWAY, 'Radix Gateway')} at epoch 340,947 on 15 September 2026, the ${A(RADUP_VAL, 'RadUp.io validator')} is registered and accepts delegated stake. It holds the 42nd-largest stake of the 186 registered validators, down from 36.3m XRD and 36th place on 6 August. From 16 August to 15 September it missed 16 of its 60,714 proposals, and none since mainnet restarted on 11 September after the ${L(DRAIN, 'Hyperlane asset drain')} halt.</p>`,
        `<p><strong>The node charges 15%, not 1.95%.</strong> Its stored fee factor is still <code>0.0195</code>, but a fee change to 15% took effect at epoch 312,126 on 27 May 2026, and the effective rate is the one applied to rewards. A delegator going by the old fee page, or by the new site’s promise against fee increases, would expect about an eighth of what the node takes. Its on-ledger <code>info_url</code> is <code>https://www.radup.io</code>. Stake units are <code>resource_rdx1t47&hellip;xqv3mxu</code> and unstake claims <code>resource_rdx1nfp&hellip;l6tlhqy</code>.</p>`,
      ].join('\n');
    },
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }
    const blocks = JSON.parse(JSON.stringify(page.content));
    e.apply(blocks);
    const json = JSON.stringify(blocks);
    if (!json.includes(e.sentinel)) throw new Error(`${e.slug}: sentinel missing after apply`);
    console.log(`  ${DRY ? '[dry] ' : ''}${e.tagPath}/${e.slug}  v${page.version} -> v${e.version}  (${JSON.stringify(page.content).length} -> ${json.length} chars)`);
    if (DRY) continue;
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query(
      `UPDATE pages SET content = $1, version = $2, updated_at = $3${e.verified ? ', last_verified_at = $3' : ''} WHERE id = $4`,
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
