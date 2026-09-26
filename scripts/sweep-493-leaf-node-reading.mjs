/**
 * sweep 493 - the Leaf Node example on /policy/verifiability, re-read.
 *
 * The policy rotation found the section "A project's website is not its status"
 * still describing Leaf Node's 100% fee as "still queued for epoch 341,223".
 * That epoch passed on 16 September; /ecosystem/leafnode already said so. A
 * policy page about dated readings was carrying an undated one.
 *
 * Re-read at epoch 344,355, state version 559,939,172 (26 September 2026,
 * 23:04 UTC) from mainnet.radixdlt.com/state/validators/list:
 * validator_rdx1swzn5hv... registered, active, 23,587,714.78 XRD, 47th of the
 * 100-validator active set (4,711,962,349.72 XRD, 0.5006%), 47th of 186
 * registered. Effective fee 100%; the stored validator_fee_factor still reads
 * 0.01. Pending-withdrawal vault 2,432,178.82 XRD (550,250 on 17 September).
 * www.leafnode.info still 503 DEPLOYMENT_PAUSED.
 *
 * Also refreshes the stake row in /ecosystem/leafnode's infobox.
 * Idempotent: each page is skipped if its sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const GW = 'https://mainnet.radixdlt.com/state/validators/list';
const FEE_TX =
  'https://dashboard.radixdlt.com/transaction/txid_rdx1mh3d3fkltk8fzp3zlumkqewejfhsngvqd7z5eggl6u8srspw9cqs9qq6va/summary';

const PAGES = [
  {
    tagPath: 'policy',
    slug: 'verifiability',
    version: '1.10.0',
    sentinel: 'epoch&nbsp;344,355',
    edits: [
      [
        'Read live at <strong>epoch&nbsp;340,083</strong> (12 September 2026, 03:08&nbsp;UTC, the morning after mainnet restarted), it is registered and sits <strong>41st of the 100 validators in the active set</strong> with <strong>25,573,394.53&nbsp;XRD</strong> &ndash; 0.5616% of the 4.55 billion XRD securing the network &ndash; on a 1% fee, with the 100% fee still queued for epoch&nbsp;341,223. It has climbed four places since 23 August while holding 147,067&nbsp;XRD less, because the active set&rsquo;s total stake fell further than its own did: a rank is a fact about everyone else.',
        `Read live at <strong>epoch&nbsp;344,355</strong> (26 September 2026, 23:04&nbsp;UTC), it is registered and sits <strong>47th of the 100 validators in the active set</strong> with <strong>23,587,714.78&nbsp;XRD</strong> &ndash; 0.5006% of the 4.71 billion XRD securing the network. The <a href="${FEE_TX}" target="_blank" rel="noopener">100% fee</a> it queued in August took effect at epoch&nbsp;341,223 on 16 September, so its delegators earn nothing, and <strong>2,432,178.82&nbsp;XRD</strong> now waits in its pending-withdrawal vault as they leave (<a href="${GW}" target="_blank" rel="noopener">Gateway</a>). The stored fee field still reads 1%: a queued change is applied by the epoch, not written back, so the field and the charged rate disagree. Two weeks earlier, at epoch&nbsp;340,083 on 12 September, it was 41st with 25,573,394.53&nbsp;XRD, four places higher than on 23 August while holding 147,067&nbsp;XRD less, because the active set&rsquo;s total stake had fallen further than its own: a rank is a fact about everyone else.`,
      ],
    ],
    message:
      'The Leaf Node example re-read from the Gateway at epoch 344,355 (26 Sep 2026): the 100% fee this section called "still queued" ' +
      'took effect at epoch 341,223; 23,587,714.78 XRD, 47th of 100 active (was 41st), 2,432,178.82 XRD pending withdrawal; the ' +
      '12 September reading kept as dated. wiki-sweep run 493.',
  },
  {
    tagPath: 'ecosystem',
    slug: 'leafnode',
    version: '4.3.1',
    sentinel: '47 of 186 registered',
    edits: [
      [
        '25,576,432 XRD, rank 41 of 186 registered; 550,250 XRD awaiting withdrawal (17 Sep 2026)',
        '23,587,715 XRD, rank 47 of 186 registered; 2,432,179 XRD awaiting withdrawal (epoch 344,355, 26 Sep 2026)',
      ],
    ],
    message:
      'Infobox stake row re-read from the Gateway at epoch 344,355 (26 Sep 2026): 23,587,715 XRD, rank 47 of 186 (was 41), ' +
      '2,432,179 XRD awaiting withdrawal (was 550,250) ten days into the 100% fee. wiki-sweep run 493.',
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
    if (isLockedPage(p.tagPath, p.slug)) throw new Error(`${p.tagPath}/${p.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [p.tagPath, p.slug],
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
    assertLinkShapes(blocks, page.title);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${p.version}  (${p.edits.length} edits)`);
    if (DRY) continue;
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
      [json, p.version, now, page.id],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, p.version, p.version.endsWith('.0') ? 'minor' : 'patch', AUTHOR_ID, p.message, now],
    );
    await client.query('COMMIT');
  }
});
