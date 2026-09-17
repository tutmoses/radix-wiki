// sweep 446 – contents/history rotation, the verification-age head after run 433.
//
// token-unlock: the page credited the second survey with "74.6% of the eligible XRD supply"
//   voting in favour, and put that figure in its infobox. The results post (6 September 2021)
//   says 72.34% of the weighted response was in favour, and that participants held 740.6m XRD,
//   about 61.7% of the ~1.2bn eligible. 74.6% appears nowhere. It also said 48% of supply was
//   staked "within two weeks" of Olympia (the 10 September post: 915m XRD, 48.3% of the
//   circulating supply, "just over a month" after genesis), listed "~48% locked via staking" as
//   a post-unlock figure, called 1.5bn XRD "over 15% of the total supply" (12.5% of 12bn), and
//   dated a 14-day follower rise that mostly preceded the unlock as following it. The team's own
//   stated reason (30 August post: price unlocking was slowing adoption) was missing.
// validator-subsidy-sunset: the fee-queue paragraph, read at epoch 337,829, still had StakeSafe's
//   and Leaf Node's increases in the future. Re-read from the Gateway at epoch 341,571
//   (07:06 UTC 17 September 2026): both StakeSafe 25% requests and Leaf Node's 100% are in force,
//   and five new increases are queued. Em dashes converted.
// scrypto-developer-event: "and the first held in Europe" had no source; removed. Rest re-read
//   against the 16 March 2022 post, the v0.3.0/v0.4.0 release dates and the YouTube oEmbed.
// radix-team-hackathon: nine em dashes out; sitemap check re-read (1,202 URLs, still no post for
//   the POS card system, the Radix Planner or the CLI).
//
//   node scripts/sweep-446-history-unlock-fee-queue.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'contents/history';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;
const blog = (slug, text) => ext(`https://www.radixdlt.com/blog/${slug}`, text);
const GATEWAY = ext('https://mainnet.radixdlt.com/state/validators/list', 'Radix Gateway');
const EMDASH = String.fromCharCode(0x2014);
const NBSP = String.fromCharCode(0xa0);

const SURVEY1 = 'community-survey-radix-token-unlock';
const UPDATE = 'update-on-the-token-unlock-community-survey';
const RESULTS = 'results-unlock-survey-2';
const ANNOUNCE = 'token-unlock-september-15th';
const DONE = 'final-token-unlock-complete';
const REPORT = 'radix-report-16th-september';

const EDITS = [
  {
    slug: 'token-unlock',
    version: '3.3.0',
    sentinel: 'about 61.7% of the roughly 1.2 billion XRD eligible',
    metadata: { excerpt: 'On 15 September 2021 Radix released every price-locked XRD token at once, after two community surveys favoured an immediate unlock.' },
    swaps: [
      ['<td>Two surveys held Aug 23–29 and Sep 1–5, 2021; 74.6% of eligible $XRD supply voted in favor of immediate unlock.</td>',
       '<td>Two surveys, 23–29 August and 1–5 September 2021: 66.8% in favour of an immediate unlock in the first (one entry per verified Instapass account), 72.34% in the second (weighted by XRD held or staked).</td>'],
      ['<td>9.6B $XRD circulating; 12B total; 24B maximum supply over 40+ years via annual emission.</td>',
       '<td>9.6B $XRD circulating; 12B total; 24B maximum, reached over at least 40 years through a 300M $XRD annual emission.</td>'],
      ['<td><a href="/ecosystem/rdx-works" rel="noopener">RDX Works</a> (Radix), proposing and enacting the unlock.</td>',
       '<td>The Radix team (<a href="/ecosystem/rdx-works" rel="noopener">RDX Works</a>), proposing and enacting the unlock; the survey results were posted by Radix Tokens (Jersey).</td>'],
    ],
    blocks: {
      'b3fef8df-b7e6-4ce4-a9c6-385661772655': `<h2>Background</h2><p>A large part of the $XRD supply had been sold to early supporters over the years before the eXRD token launched, on condition that it stay locked and be released only as (e)XRD reached ${blog(SURVEY1, 'set price thresholds')}. The locked tokens belonged to those backers and to Radix itself. On 20 August 2021, three weeks after the Olympia mainnet launch, Radix ${blog(SURVEY1, 'announced a community survey')} on whether to drop that schedule and unlock everything at once, after some community members had asked for it. The post was explicit that the survey was not a governance vote but a reading of opinion.</p>`,
      'a79be7d0-cb11-4c68-a864-d9b859c9f55a': `<h2>Community Surveys</h2><p>The first survey ran from 23 to 29 August 2021 and asked a single yes/no question: unlock all locked $XRD now, or keep the price-based schedule. A verified Instapass account was required, which limited each person to one entry. ${blog(UPDATE, '66.8% of participants favoured the immediate unlock')}.</p><p>The second survey ran from 1 to 5 September 2021 and weighted each response by the XRD held or staked in wallets linked to the participant's Instapass account. ${blog(RESULTS, '72.34% of the weighted response was in favour')}. Participants held 740.6 million XRD, about 61.7% of the roughly 1.2 billion XRD eligible to take part.</p>`,
      'c16ecd3c-7b43-4790-847f-aa64e29caba1': `<h2>Reasons for Unlocking</h2><p>The team gave its own reason once the first survey had closed. Price-based unlocking had been meant to align token holders, the team and the community ahead of Olympia, and it worked at first, but ${blog(UPDATE, 'through the second and third quarters of 2021')} liquidity, holder growth and network value had slowed, and the team concluded the mechanism was holding back adoption and distribution. It had kept the schedule in place until after Olympia so as not to add volatility to the launch.</p><p>By 10 September, six weeks after the ${int('/contents/tech/releases/radix-mainnet-olympia', 'Olympia mainnet')} went live on 28 July 2021, ${blog(ANNOUNCE, 'over 915 million XRD was staked')}, 48.3% of the circulating supply at the time, across more than 130 registered validators. The same post cited the interest around the Olympia launch, the coming ${int('/contents/tech/releases/radix-developer-environment-alexandria', 'Alexandria')} release and the survey majority, and called the unlock one of the most effective ways "to accelerate the distribution of stake, decentralization, and network adoption."</p>`,
      '4809c066-f0ee-463f-8271-de2094bab1d7': `<h2>The Unlock</h2><p>The final unlock of all remaining locked (e)XRD ran on ${blog(DONE, '15 September 2021')} between 14:00 and 17:00 UTC. Price-locked XRD arrived in holders' wallets; price-locked eXRD had to be withdrawn through the unlocking contract.</p><p>The supply figures Radix published for after the unlock were:</p><ul><li>9.6 billion $XRD circulating, the difference from total supply being the indefinitely locked Stable Coin Reserve.</li><li>12 billion $XRD total supply, with no further unlocks.</li><li>24 billion $XRD maximum supply, reached over at least 40 years through a ${int('/contents/tech/core-concepts/network-emissions', 'network emission')} of 300 million $XRD a year paid to stakers.</li><li>Approximately 15,000 $XRD in transaction fees ${blog(DONE, 'burnt since the network went live')}.</li></ul>`,
      '70384baa-236f-446e-b9e7-1c15ae4ce8e4': `<h2>Impact</h2><p>The ${blog(REPORT, 'Radix Report of 16 September 2021')} put daily eXRD and XRD trading volume since the unlock at over $65 million.</p><p>The same report gave the staked amount as over 1.5 billion XRD, up from 915 million six days earlier. The staked share of supply fell all the same: circulating supply had grown about fivefold, from roughly 1.9 billion to 9.6 billion XRD, so 1.5 billion was about 16% of it, against 48% before the unlock.</p><p>The report also said Radix's social media followers were up over 10% in the preceding 14 days, a window that falls mostly before the unlock.</p><h2>Legacy</h2><p>The September 2021 unlock left all $XRD freely transferable well ahead of the network's later milestones, including the ${int('/contents/tech/releases/radix-mainnet-babylon', 'Babylon')} smart-contract mainnet in 2023. The protocol ${int('/contents/tech/core-concepts/network-emissions', 'network emission')} referenced at the unlock still carries circulating supply toward the 24 billion $XRD maximum, while the separate Foundation-run validator subsidy that supplemented early staking rewards was later wound down (see ${int('/contents/history/validator-subsidy-sunset', 'Validator Subsidy Sunset')}). For current tokenomics, see the ${int('/contents/tech/core-protocols/xrd-token', '$XRD Token')} page.</p>`,
    },
    message: 'Survey figures corrected against the 6 September 2021 results post: 72.34% of the weighted response in favour, participants holding 740.6m XRD (~61.7% of ~1.2bn eligible); the 74.6% figure had no source. Staking figure re-dated (915m XRD, 48.3% of circulating supply, 10 September, not "within two weeks"); post-unlock staked share (~16%, not "over 15% of total supply"); follower-growth window; team\'s stated reason from the 30 August post added. Excerpt added.',
  },
  {
    slug: 'validator-subsidy-sunset',
    version: '1.4.0',
    sentinel: 'What the queue did (17 September 2026)',
    dashes: true,
    afterSentinelOf: 'The queue has since refilled',
    insert: `<h2>What the queue did (17 September 2026)</h2><p>All four requests have taken effect. Read from the ${GATEWAY} at <strong>epoch 341,571</strong> (07:06 UTC, 17 September 2026) against StakeSafe's figures at epoch 339,152 (29 August) and Leaf Node's at epoch 337,829:</p><table><tbody><tr><td><strong>StakeSafe Rotterdam</strong>, 15% to 25% at epoch 339,609</td><td>81,182,620 XRD then, <strong>78,316,767 XRD</strong> now: 2,865,853 XRD withdrawn, 3.5% of its stake</td></tr><tr><td><strong>StakeSafe Amsterdam</strong>, 15% to 25% at epoch 339,608</td><td>75,944,786 XRD then, <strong>75,703,284 XRD</strong> now: 241,502 XRD withdrawn, 0.3%</td></tr><tr><td><strong><a href="/ecosystem/leafnode" rel="noopener">Leaf Node</a></strong>, 1% to 100% at epoch 341,223</td><td>25,670,173 XRD then, <strong>25,577,200 XRD</strong> now: 92,973 XRD withdrawn, 0.4%</td></tr></tbody></table><p>StakeSafe's two increases landed around 30 August, before the network halted. Leaf Node's was due in the first week of September, but the ledger produced no epochs until it ${int('/contents/history/hyperlane-asset-drain-2026', 'restarted on 11 September 2026')}, so epoch 341,223 arrived on 16 September. Its delegators now earn nothing on 25.6 million XRD, and fewer than 100,000 XRD has left since 24 August. StakeSafe's seed node went to 100% on the same epoch as Rotterdam. All four still store their old fee factor.</p><p>At epoch 341,571 the queue holds five increases:</p><table><tbody><tr><td><strong>Apollo Pool</strong></td><td>20% to 100% at epoch 342,116, about 19 September</td></tr><tr><td><strong><a href="/ecosystem/avaunt-staking" rel="noopener">Avaunt Staking</a></strong></td><td>2% to 25% at epoch 342,482, about 20 September, over 138.8 million XRD</td></tr><tr><td><strong><a href="/ecosystem/supreme-stake" rel="noopener">Daffy (Supreme)</a></strong>, formerly Supreme Stake</td><td>5% to 20% at epoch 344,149, about 26 September</td></tr><tr><td><strong><a href="/ecosystem/radixcharts" rel="noopener">Radix Charts V2</a></strong></td><td>2.5% to 15% at epoch 345,107, about 29 September</td></tr><tr><td><strong>DoItForDan</strong></td><td>5% to 15% at epoch 345,108, about 29 September</td></tr></tbody></table><p>The dates assume the five-minute epochs the network has kept since the restart.</p>`,
    message: 'Follow-through on the fee queue, read at epoch 341,571 (17 September 2026): StakeSafe Rotterdam and Amsterdam at 25% since ~30 August (-3.5% and -0.3% stake since 29 August), Leaf Node at 100% since 16 September after the halt delayed it (-0.4%). Five increases now queued (Apollo Pool, Avaunt, Daffy (Supreme), Radix Charts V2, DoItForDan). Em dashes converted.',
  },
  {
    slug: 'scrypto-developer-event',
    version: '2.2.1',
    sentinel: 'was the first event RDX Works billed as a Scrypto Developer Event',
    change: 'patch',
    swaps: [
      ['was the first Radix event given over wholly to Scrypto developers, and the first held in Europe, <a',
       'was the first event RDX Works billed as a Scrypto Developer Event, <a'],
    ],
    message: 'Removed the unsourced claim that this was the first Radix event held in Europe; the 16 March 2022 announcement calls it the first Scrypto Developer Event. Rest re-read against the announcement, the Scrypto v0.3.0/v0.4.0 release dates and the recording.',
  },
  {
    slug: 'radix-team-hackathon',
    version: '3.0.2',
    sentinel: "radixdlt.com's sitemap</a> as of 17 September 2026",
    change: 'patch',
    dashes: true,
    swaps: [
      ["radixdlt.com's sitemap</a> as of August 2026", "radixdlt.com's sitemap</a> as of 17 September 2026"],
    ],
    message: 'Em dashes converted; the sitemap check re-read on 17 September 2026 (still no dedicated post for the POS card system, the Radix Planner or the CLI).',
  },
];

function swapOnce(blocks, [from, to]) {
  let hits = 0;
  const visit = (list) => list.map((b) => {
    let next = b;
    if (typeof b.text === 'string' && b.text.includes(from)) { hits++; next = { ...b, text: b.text.replace(from, to) }; }
    if (Array.isArray(b.blocks)) next = { ...next, blocks: visit(b.blocks) };
    return next;
  });
  const out = visit(blocks);
  if (hits !== 1) throw new Error(`expected 1 match, got ${hits}: ${from.slice(0, 60)}`);
  return out;
}

const undash = (list) => list.map((b) => ({
  ...b,
  ...(typeof b.text === 'string' ? { text: b.text.replaceAll(` ${EMDASH} `, ' – ').replaceAll(EMDASH, ' – ') } : {}),
  ...(Array.isArray(b.blocks) ? { blocks: undash(b.blocks) } : {}),
}));

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(TAG, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, metadata, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied - no write`);
      continue;
    }
    let blocks = JSON.parse(JSON.stringify(page.content));
    if (e.dashes) blocks = undash(blocks);
    for (const s of e.swaps ?? []) blocks = swapOnce(blocks, s);
    for (const [id, text] of Object.entries(e.blocks ?? {})) {
      const i = blocks.findIndex((b) => b.id === id);
      if (i < 0) throw new Error(`${e.slug}: block ${id} not found`);
      blocks[i] = { ...blocks[i], text };
    }
    if (e.afterSentinelOf) {
      const hits = blocks.map((b, i) => (b.text?.includes(e.afterSentinelOf) ? i : -1)).filter((i) => i >= 0);
      if (hits.length !== 1) throw new Error(`${e.slug}: expected 1 block containing anchor, got ${hits.length}`);
      blocks[hits[0]].text += e.insert;
    }
    const json = JSON.stringify(blocks);
    if (json.includes(NBSP) || json.includes(EMDASH)) throw new Error(`${e.slug}: U+00A0 or an em dash in output`);
    if (!json.includes(e.sentinel)) throw new Error(`${e.slug}: sentinel missing after edits`);
    const metadata = e.metadata ? { ...(page.metadata ?? {}), ...e.metadata } : page.metadata;
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (${json.length - JSON.stringify(page.content).length} chars)`);
    if (DRY) continue;

    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, metadata=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [json, e.version, JSON.stringify(metadata), now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.change ?? 'minor', AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
    console.log('    written and stamped');
  }
});
