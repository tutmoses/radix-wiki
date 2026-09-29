/**
 * sweep 506 - ecosystem rotation, staleness head (emberflow, gable-finance,
 * radical-staking, all last verified 27 Aug 2026).
 *
 * radical-staking: every figure was read at epoch 338766 on 27 Aug. Re-read live
 * at epoch 344979, 03:05 UTC 29 Sep 2026 (radix_get_validator, live):
 *   total stake 150,939,702.53 XRD, rank 8 of 186 registered
 *   (order above it now SRWA, Astrolescent, Reddicks, Jazzer9F, Ocinode, WEFT,
 *   DefiPlaza), fee 1% with no change queued, uptime 99.91% over 1 month;
 *   stake-unit holders 8,692 (Jazzer9F 8,654, unchanged). Seven validators
 *   holding 489.5M XRD have fee rises queued (RadixStake, Sirius, Radstakes,
 *   Polaris, RadixTalk, Radix Charts V2, DoItForDan), matching run 504's table.
 *   radicalstaking.com still states 125,245,039 XRD and 8,753 delegations.
 *
 * emberflow: www.emberflow.org is now a Vite single-page app, Last-Modified
 * 15 Sep 2026; subpaths (/about, /lifeband, /faq) 404 at the edge. Its one
 * bundle, /assets/index-BsL2BBWd.js (320,829 B), holds the site text: Radix 0,
 * XRD 0, Scrypto 0, "decentraliz" 11, and an FAQ entry "Is LifeBand Protocol a
 * blockchain or token-based network?" answered "No ... not a blockchain and
 * does not use public tokens or coins" (off-chain keys and signatures).
 * /.well-known/radix.json 404.
 *
 * gable-finance re-probed unchanged (Last-Modified 23 Apr 2024, both repos last
 * pushed Dec 2023) and stamped with mark-verified, no edit.
 *
 * Idempotent: each page is skipped if its sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const EF = '<a href="https://www.emberflow.org" target="_blank" rel="noopener">';

const PAGES = [
  {
    slug: 'radical-staking',
    version: '3.1.0',
    sentinel: 'epoch 344979',
    excerpt: ['149.0M XRD delegated', '150.9M XRD delegated'],
    edits: [
      [
        '<td>148,990,076 XRD (rank 8 of 188, epoch 338766, 27 Aug 2026)</td>',
        '<td>150,939,703 XRD (rank 8 of 186, epoch 344979, 29 Sep 2026)</td>',
      ],
      ['<td><strong>Validator fee</strong></td><td>1%</td>', '<td><strong>Validator fee</strong></td><td>1%, no change queued (29 Sep 2026)</td>'],
      ['<td>100% (one month to 27 Aug 2026)</td>', '<td>99.91% (one month to 29 Sep 2026)</td>'],
      ['<td>8,700 accounts</td>', '<td>8,692 accounts</td>'],
      ['rel="noopener">epoch 338766</a> (27 August 2026):', 'rel="noopener">epoch 344979</a> (29 September 2026, 03:05 UTC):'],
      [
        '148,990,075.76 XRD, ranking it <strong>8th of the 188 registered validators</strong>, behind SRWA, <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a>, Reddicks Node, <a href="/ecosystem/weft-finance" rel="noopener">Weft</a>, Ocinode, Jazzer9F and the <a href="/ecosystem/defiplaza" rel="noopener">DefiPlaza</a> investment node.',
        '150,939,702.53 XRD, ranking it <strong>8th of the 186 registered validators</strong>, behind SRWA, <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a>, Reddicks Node, Jazzer9F, Ocinode, <a href="/ecosystem/weft-finance" rel="noopener">Weft</a> and the <a href="/ecosystem/defiplaza" rel="noopener">DefiPlaza</a> investment node. On 27 August it held 148,990,075.76 XRD at the same rank.',
      ],
      [
        'That is at the low end of the active set, where declared fees run from 0% to 100%.</li>',
        'That is at the low end of the active set, where declared fees run from 0% to 100%. It is not among the operators raising fees: at the same epoch seven validators holding about 490 million XRD had increases queued on ledger, listed on the <a href="/ideas/dao-grow-validator-set" rel="noopener">Grow the validator set</a> card, and Radical Staking had none.</li>',
      ],
      [
        '100% over the month to 27 August 2026, with no missed proposals recorded in that window.',
        '99.91% over the month to 29 September 2026. The month to 27 August read 100%.',
      ],
      ['is held by <strong>8,700 accounts</strong>.', 'is held by <strong>8,692 accounts</strong>, eight fewer than on 27 August.'],
      [
        'states 125,245,039 XRD in active stake and 8,753 delegations — a stake figure roughly 19% below the ledger, and a participant count 53 above the closest on-ledger measure. The site carries no date,',
        'states 125,245,039 XRD in active stake and 8,753 delegations, unchanged when re-read on 29 September 2026. That stake figure is about 17% below the ledger, and the participant count 61 above the closest on-ledger measure. The site carries no date,',
      ],
      [
        "Read as that proxy, the claim is defensible but narrow. Across the twelve largest validators by stake, Radical Staking's 8,700 stake-unit holders is the highest of the actively-marketed nodes, ahead of Jazzer9F on 8,654 — a margin of 46 accounts, well inside the range a week of ordinary staking activity can move. Every other node in that group is an order of magnitude behind:",
        "Read as that proxy, the claim is defensible but narrow. Measured on 27 August 2026 across the twelve largest validators by stake, Radical Staking's 8,700 stake-unit holders was the highest of the actively-marketed nodes, ahead of Jazzer9F on 8,654, a margin of 46 accounts. Re-read on 29 September the two stand at 8,692 and 8,654, a margin of 38, still well inside the range a week of ordinary staking activity can move. On the August reading every other node in that group was an order of magnitude behind:",
      ],
    ],
    message:
      'On-ledger figures re-read live at epoch 344979 (29 Sep 2026): stake 150,939,702.53 XRD, still 8th of 186 registered, with the order ' +
      'above it updated; fee 1% with no change queued while seven validators holding ~490M XRD have rises queued (linked to the ' +
      'Grow the validator set card); uptime 99.91% over one month; 8,692 stake-unit holders against Jazzer9F 8,654 (margin 38). ' +
      'radicalstaking.com figures unchanged, divergence recomputed (17% / +61). Excerpt updated. wiki-sweep run 506.',
  },
  {
    slug: 'emberflow',
    version: '3.1.0',
    sentinel: 'is not a blockchain and does not use public tokens or coins',
    edits: [
      [
        'is actively maintained, but no page of it has mentioned Radix since at least August 2025</td>',
        'is actively maintained, but it has not mentioned Radix since at least August 2025, and since September 2026 its FAQ says LifeBand is not a blockchain and uses no tokens</td>',
      ],
      [
        `<h2>Status</h2><p>Read on 27 August 2026, seven pages of ${EF}emberflow.org</a>`,
        `<h2>Status</h2><p>${EF}emberflow.org</a> was rebuilt as a single-page application, served with a Last-Modified date of 15 September 2026. Read on 29 September 2026, the one script bundle that carries all of its text (320,829 bytes) contains the word <strong>Radix zero times</strong>, and its FAQ now answers the question this page exists to record. Asked whether LifeBand Protocol is a blockchain or token-based network, the company says it ${EF}"is not a blockchain and does not use public tokens or coins"</a>, and describes verifying patient consent with off-chain cryptographic keys and signatures while records stay in the providers' own systems. "Decentralized" is back in the copy, eleven times, now describing that off-chain design. <code>/.well-known/radix.json</code> still returns 404.</p><p>Before the rebuild, on 27 August 2026, seven pages of ${EF}emberflow.org</a>`,
      ],
      ['The site serves no <code>/.well-known/radix.json</code>', 'The site served no <code>/.well-known/radix.json</code>'],
      [
        'the second word has gone as well. The company is not dormant; its Radix presence is.',
        'the second word had gone as well, until the September rebuild brought it back for a design with no ledger in it. The company is not dormant; its Radix presence is.',
      ],
    ],
    message:
      'Status re-read 29 Sep 2026: emberflow.org was rebuilt as a single-page app (Last-Modified 15 Sep 2026); its bundle names Radix ' +
      'zero times and its FAQ now states LifeBand "is not a blockchain and does not use public tokens or coins", verifying consent ' +
      'off-chain. The 27 Aug measurement is kept as the pre-rebuild reading; infobox Status updated. wiki-sweep run 506.',
  },
];

const replaceOnce = (haystack, needle, replacement) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`string is not unique: ${JSON.stringify(needle.slice(0, 70))}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

const walk = (blocks) => blocks.flatMap((b) => [b, ...(b.blocks ? walk(b.blocks) : [])]);

await withClient(async (client) => {
  for (const p of PAGES) {
    if (isLockedPage('ecosystem', p.slug)) throw new Error(`ecosystem/${p.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2',
      ['ecosystem', p.slug],
    );
    if (!rows.length) throw new Error(`${p.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(p.sentinel)) {
      console.log(`  ${p.slug}: already applied - no write`);
      continue;
    }
    const blocks = JSON.parse(JSON.stringify(page.content));
    const all = walk(blocks);
    for (const [from, to] of p.edits) {
      const hits = all.filter((b) => (b.text || '').includes(from));
      if (hits.length !== 1) throw new Error(`${p.slug}: ${hits.length} blocks hold ${JSON.stringify(from.slice(0, 60))}`);
      hits[0].text = replaceOnce(hits[0].text, from, to);
    }
    const metadata = { ...page.metadata };
    if (p.excerpt) metadata.excerpt = replaceOnce(metadata.excerpt, ...p.excerpt);
    assertLinkShapes(blocks, page.title);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${p.version}  (${p.edits.length} edits)`);
    if (DRY) continue;
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content = $1, metadata = $2, version = $3, updated_at = $4, last_verified_at = $4 WHERE id = $5',
      [json, JSON.stringify(metadata), p.version, now, page.id],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, p.version, 'minor', AUTHOR_ID, p.message, now],
    );
    await client.query('COMMIT');
  }
});
