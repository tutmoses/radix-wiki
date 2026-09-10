// Sweep 402, policy rotation: /policy/freshness gets the case the 180-day stamp cannot see,
// and both freshness and editorial-notices get their verification census re-measured
// against the production DB on 10 September 2026 (293 of 373 pages under a category
// stamped, 80 never verified; XRD Domains 166 days, Radix Namespace 73).
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'When a claim decays faster than the stamp';

const NEW_SECTION =
  '<h2>When a claim decays faster than the stamp</h2>' +
  '<p>The 180-day threshold is built for a page that goes quietly out of date, and it cannot see a claim that goes wrong in the week it is written. ' +
  'An instruction to node operators is the clearest case. On 9 September 2026 the <a href="/ecosystem/radix-accountability-council" class="link">Radix Accountability Council</a> ' +
  '<a href="https://t.me/RadixAccountabilityCouncil/1012" target="_blank" rel="noopener">asked operators not to install the release candidate</a> that carries the fix for the ' +
  '<a href="/contents/history/hyperlane-asset-drain-2026" class="link">August 2026 network halt</a>, and to wait for official versions and instructions; three pages here recorded that, with the source. ' +
  'At 16:15 UTC on 10 September the council <a href="https://t.me/RadixAccountabilityCouncil/1019" target="_blank" rel="noopener">told the same operators to upgrade now</a>. ' +
  'Every page carrying the earlier instruction was wrong from that minute, and the verification stamps on them, written that morning, still read fresh.</p>' +
  '<p>Two habits cover the gap, and both are already the house style here. Date the claim inside the sentence, so the sentence carries what the stamp cannot: ' +
  '<q>read at 07:06 UTC on 10 September</q> tells a reader on the 11th exactly what they are looking at, and a reader can act on a dated instruction that a bare present tense would have hidden. ' +
  'Then revisit a page on the cadence of the thing it reports rather than the cadence of the rotation. A halt that is still running takes a reading a day; a protocol page whose subject last changed in 2023 does not.</p>';

const EDITS = [
  {
    tagPath: 'policy',
    slug: 'freshness',
    version: '1.5.0',
    changeType: 'minor',
    message: 'Adds the fast-decay case the 180-day stamp cannot see, worked through the council instruction that reversed on 10 September 2026, and re-measures the verification census against the database.',
    replacements: [
      [
        '0c92fa02-d7f2-4a65-aa1a-d604d4373665',
        'Read on 2 September 2026, 281 of the wiki&rsquo;s 381 pages carry a verification stamp and 100 have never been verified &ndash; against 180 of 363 a fortnight earlier, and every stamp on the wiki was written by the sweep, because nothing else can write one.',
        'Read on 10 September 2026, 293 of the wiki&rsquo;s 373 pages carry a verification stamp and 80 have never been verified, against 281 of 381 on 2 September; the total fell because the Community section was retired on 9 September, taking twelve profiles and its section hub off the wiki. Every stamp was written by the sweep, because nothing else can write one.',
      ],
      [
        '0c92fa02-d7f2-4a65-aa1a-d604d4373665',
        '158 days ago as of this reading',
        '166 days ago as of this reading',
      ],
    ],
    insertSectionAfter: '0c92fa02-d7f2-4a65-aa1a-d604d4373665',
  },
  {
    tagPath: 'policy',
    slug: 'editorial-notices',
    version: '1.2.0',
    changeType: 'minor',
    message: 'Re-measures the verification census and the two locked pages that lead the freshness queue against the database, read 10 September 2026.',
    replacements: [
      [
        '95282cc8-7259-4690-9547-a47af4ed98b4',
        '<strong>283 of the 379</strong> pages under a category now carry an explicit verification stamp, and <strong>none</strong> of the 379 is past the threshold. The oldest page on the wiki was checked 159 days ago',
        '<strong>293 of the 373</strong> pages under a category now carry an explicit verification stamp, read on 10 September 2026, and <strong>none</strong> of them is past the threshold. The oldest page on the wiki was last touched 166 days ago',
      ],
      [
        '95282cc8-7259-4690-9547-a47af4ed98b4',
        'XRD Domains</a> at 159 days and <a href="/ecosystem/radix-namespace" class="link">Radix Namespace</a> at 67,',
        'XRD Domains</a> at 166 days and <a href="/ecosystem/radix-namespace" class="link">Radix Namespace</a> at 73,',
      ],
    ],
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const edit of EDITS) {
    if (isLockedPage(edit.tagPath, edit.slug)) throw new Error(`${edit.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [edit.tagPath, edit.slug],
    );
    if (!rows.length) throw new Error(`page not found: ${edit.tagPath}/${edit.slug}`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    const already = edit.insertSectionAfter
      ? JSON.stringify(blocks).includes(SENTINEL)
      : blocks.some((b) => (b.text || '').includes('293 of the 373'));
    if (already) {
      console.log(`  ${edit.slug}: already applied, no write`);
      continue;
    }

    for (const [blockId, from, to] of edit.replacements) {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) throw new Error(`block ${blockId} missing on ${edit.slug}`);
      if (!block.text.includes(from)) throw new Error(`find-string missing on ${edit.slug}: ${from.slice(0, 60)}`);
      block.text = block.text.replace(from, to);
    }

    if (edit.insertSectionAfter) {
      const at = blocks.findIndex((b) => b.id === edit.insertSectionAfter);
      if (at < 0) throw new Error('anchor block missing');
      blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: NEW_SECTION });
    }

    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${edit.version}  blocks ${page.content.length} -> ${blocks.length}`);

    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, edit.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, edit.version, edit.changeType, AUTHOR_ID, edit.message, now],
      );
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
