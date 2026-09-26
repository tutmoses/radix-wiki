/**
 * sweep 491 - Allnodes and Staatenlos Node, validator figures re-read.
 *
 * Both pages carried a Gateway reading from epoch 337,230 (22 August 2026) and
 * sat at the head of the ecosystem staleness queue. Re-read from
 * mainnet.radixdlt.com/state/validators/list at epoch 344,259, state version
 * 559,888,009 (26 September 2026, 15:04 UTC): 186 registered validators, the
 * 100-validator active set holding 4,711,656,521.46 XRD.
 *
 * - Allnodes validator_rdx1s0v38ep...: 12,111,191.17 XRD (was 12,111,117.60),
 *   rank 66 of 186, fee 5%, no change queued, in the active set. The stake is
 *   flat because withdrawals kept pace with emissions: 177,264.11 XRD sits in
 *   its pending-withdrawal vault. info_url unchanged. allnodes.com/xrd/staking
 *   now serves a 154-byte shell to a script, so the 14% reading stays dated
 *   22 August rather than being re-read.
 * - Staatenlos Node validator_rdx1svpqafv...: 96,412,469.58 XRD (was
 *   95,607,237.03), rank 16 of 186 (was 15 of 188), fee 2.5%, no change
 *   queued. node.staatenlos.ch still answers HTTP 526; the staking page 200.
 *
 * Gross rate at the new reading: ~300m / 4.7117bn = 6.37%, 6.05% after a 5% fee.
 * Idempotent: each page is skipped if its sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const GW = 'https://mainnet.radixdlt.com/state/validators/list';

const PAGES = [
  {
    slug: 'allnodes',
    version: '2.3.0',
    sentinel: 'epoch 344,259, 26 Sep 2026',
    edits: [
      [
        '12,111,117.60 XRD — rank 68 of 188 registered (epoch 337,230, 22 Aug 2026)',
        '12,111,191.17 XRD, rank 66 of 186 registered (epoch 344,259, 26 Sep 2026)',
      ],
      [
        '~6.4% gross network-wide, ~6.1% after the 5% fee',
        '~6.4% gross network-wide, ~6.0% after the 5% fee',
      ],
      [
        'Treat the 14% as a headline figure that has not tracked the emission schedule, not as a rate available on Radix.</p>',
        'Treat the 14% as a headline figure that has not tracked the emission schedule, not as a rate available on Radix.</p>' +
          `<p>Read again at epoch 344,259 (26 September 2026, 15:04 UTC), the stake had hardly moved: <strong>12,111,191.17 XRD</strong>, ` +
          `66th of 186 registered validators, still at a 5% fee with no change queued. Emissions and withdrawals had cancelled out, ` +
          `with <strong>177,264.11 XRD</strong> sitting in the validator's pending-withdrawal vault on the ` +
          `<a href="${GW}" target="_blank" rel="noopener">same Gateway read</a>. The active set had grown to 4.71 billion XRD, ` +
          'so the gross rate was 6.37% and about 6.05% after the fee.</p>',
      ],
    ],
    message:
      'Validator figures re-read from the Gateway at epoch 344,259 (26 Sep 2026): 12,111,191.17 XRD, rank 66 of 186, fee 5%, ' +
      'no change queued, 177,264.11 XRD pending withdrawal. Infobox updated; the 22 August reading kept as dated and a ' +
      'dated paragraph added. Net rate ~6.05% on a 4.71bn active set. wiki-sweep run 491.',
  },
  {
    slug: 'staatenlos-node',
    version: '3.1.1',
    sentinel: 'epoch 344,259, 26 Sep 2026',
    edits: [
      [
        '95,607,237.03 XRD — rank 15 of 188 registered (epoch 337,230, 22 Aug 2026)',
        '96,412,469.58 XRD, rank 16 of 186 registered (epoch 344,259, 26 Sep 2026)',
      ],
      ['at epoch 337,230 (22 August 2026, 15:06 UTC)', 'at epoch 344,259 (26 September 2026, 15:04 UTC)'],
      [
        '<strong>95,607,237.03 XRD</strong> — rank 15 of the 188 registered validators — at',
        '<strong>96,412,469.58 XRD</strong>, rank 16 of the 186 registered validators, at',
      ],
      ['an active set holding 4.69 billion XRD', 'an active set holding 4.71 billion XRD'],
      ['since at least 22 August 2026;', 'since at least 22 August 2026 and still did on 26 September;'],
    ],
    message:
      'Validator figures re-read from the Gateway at epoch 344,259 (26 Sep 2026): 96,412,469.58 XRD, rank 16 of 186 ' +
      '(was 15 of 188), fee 2.5%, no change queued; active set 4.71bn XRD. node.staatenlos.ch still HTTP 526. wiki-sweep run 491.',
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
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
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
