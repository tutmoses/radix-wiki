// sweep 445 – ecosystem rotation, the rest of the Dormant/Closed tail verified 2–3 August
// that run 443 banked as the next slice.
//
// ideosphere: ideosphere.io had no DNS record on 30 July 2026, and the page warned that an
//   unregistered domain can be bought by anyone. It was: whois reads a creation date of
//   5 September 2026 (Spaceship, Inc.), and on 17 September the domain redirects to a
//   Vietnamese gambling site. The domain is not spelled out as a link anywhere on the wiki.
// radix-review: "no new episodes since late 2025" made exact from the iTunes lookup API
//   (show 1742273477): 76 episodes, the last published 12 December 2025.
// radixuid: validator re-read at epoch 341,523 (17 September 2026) – still unregistered,
//   still named "Lauta Army", still 1,345,074 XRD delegated. The infobox said 🔴 Dormant
//   while metadata.status says 🟠 Dormant; the infobox now matches.
// the-hard-money-project needed no edit (Substack's last post still 21 April 2025, the
//   YouTube embed still answers oEmbed 200) and is stamped with mark-verified.
//
//   node scripts/sweep-445-ecosystem-dormant-tail.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const APPLE = 'https://podcasts.apple.com/us/podcast/radix-review/id1742273477';

const EDITS = [
  {
    slug: 'ideosphere',
    version: '2.4.0',
    sentinel: 'was registered again on 5 September 2026',
    swaps: [
      [/<p><em>Website \(30 July 2026\): <code>ideosphere\.io<\/code> has no DNS record at all\.[\s\S]*?facts table\.<\/em><\/p>/,
       '<h2>Website</h2>\n<p>The project&#39;s domain, <code>ideosphere.io</code>, had no DNS record on 30 July 2026, so the link was removed from this page. The domain was registered again on 5 September 2026, and read on 17 September it redirects to a Vietnamese gambling site that has nothing to do with the project. Do not treat the domain as Ideosphere&#39;s.</p>'],
    ],
    message: 'ideosphere.io, which had no DNS record on 30 July 2026, was registered again on 5 September 2026 and on 17 September redirects to an unrelated gambling site. Replaced the italic website note with a dated Website section that says so without linking the domain.',
  },
  {
    slug: 'radix-review',
    version: '3.1.3',
    sentinel: 'the 76th, was published on 12 December 2025',
    swaps: [
      ['<p>As of 2026 the show appears dormant: no new episodes have been published since late 2025 on its',
       `<p>The show has been dormant since December 2025. Its last episode, the 76th, was published on 12 December 2025 to its`],
      ['<td><strong>Latest</strong></td><td>No new episodes published since late 2025</td>',
       `<td><strong>Latest</strong></td><td>${ext(APPLE, 'Episode 76')}, 12 December 2025</td>`],
    ],
    message: 'Made the dormancy date exact from the Apple Podcasts catalogue, read 17 September 2026: 76 episodes, the last published 12 December 2025.',
  },
  {
    slug: 'radixuid',
    version: '3.1.3',
    sentinel: 'At epoch 341,523 (17 September 2026)',
    swaps: [
      ['<th>Status</th><td>🔴 Dormant', '<th>Status</th><td>🟠 Dormant'],
      ['At epoch 331662 (3 August 2026) it still held <strong>1,345,074 XRD in delegated stake</strong>,',
       'At epoch 341,523 (17 September 2026) it still held <strong>1,345,074 XRD in delegated stake</strong>, the same amount as on 3 August,'],
    ],
    message: 'Re-read the validator at epoch 341,523 (17 September 2026): still unregistered, still named Lauta Army, 1,345,074 XRD delegated as on 3 August. Infobox status marker matched to the page metadata (Dormant is orange, not red).',
  },
];

// Apply a swap to whichever block (or nested infobox block) holds it, exactly once.
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
    const json = JSON.stringify(blocks);
    const [NBSP, EMDASH] = [0xa0, 0x2014].map((c) => String.fromCharCode(c));
    if (json.includes(NBSP) || (json.includes(EMDASH) && !JSON.stringify(page.content).includes(EMDASH))) {
      throw new Error(`${e.slug}: U+00A0 or a new em dash in output`);
    }
    if (!json.includes(e.sentinel)) throw new Error(`${e.slug}: sentinel missing after swaps`);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (${e.swaps.length} swaps)`);
    if (DRY) continue;

    const now = new Date().toISOString();
    const type = e.version.endsWith('.0') ? 'minor' : 'patch';
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, type, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
    console.log('    written and stamped');
  }
});
