// sweep 444 – contents/tech rotation, the two peak-figure items banked by runs 431 and 435.
//
// cassandra: the infobox read "Max. TPS 200,000 (2024-05-15)" and linked
//   x.com/fuserleer/status/1542582783234777091, which is a 30 June 2022 tweet
//   reporting a 12k peak on 64 nodes, so neither the figure nor the date matched
//   its source. Dan Hughes's 23 September 2024 tweet (status 1838151768523383207,
//   read via api.fxtwitter.com on 16 September 2026) reports "last night's
//   successful test of 2.2 MILLION transfers per second". The row now carries
//   that figure, the tweet's word "transfers", and the night of the test.
// hyperscale-500k-tps: radixdlt.com/blog/hyperscale-update-500k-public-test-done
//   (31 January 2026) says peaks of over 700k; /blog/interim-hyperscale-closing-
//   the-chapter (20 February 2026) says peaks above 800k. Both read 16 September
//   2026. The page gave only the first; it now gives both, dated.
// homepage: the Max. tps cell says "800k+ peak" and linked the January post,
//   which says 700k. Repointed to the February post, which says 800k.
//
//   node scripts/sweep-444-tech-peak-figures.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const JAN = 'https://www.radixdlt.com/blog/hyperscale-update-500k-public-test-done';
const FEB = 'https://www.radixdlt.com/blog/interim-hyperscale-closing-the-chapter';

const EDITS = [
  {
    tagPath: 'contents/tech/research',
    slug: 'cassandra',
    version: '1.3.0',
    sentinel: 'status/1838151768523383207',
    swaps: [
      ['href="https://x.com/fuserleer/status/1542582783234777091">200,000</a> (2024-05-15)',
       'href="https://x.com/fuserleer/status/1838151768523383207">2.2 million transfers per second</a> (22 September 2024)'],
    ],
    message: 'Max. TPS row corrected. It read 200,000 (2024-05-15) and linked a 30 June 2022 tweet reporting a 12k peak on 64 nodes. Dan Hughes reported 2.2 million transfers per second on Cassandra in a tweet of 23 September 2024, describing the previous night\'s test; the row now carries that figure and source.',
  },
  {
    tagPath: 'contents/tech/research',
    slug: 'hyperscale-500k-tps',
    version: '2.1.0',
    sentinel: 'above 800,000 in the',
    swaps: [
      ['<td><strong>Peak TPS</strong></td><td>700,000+</td>',
       `<td><strong>Peak TPS</strong></td><td>700,000+ (<a href="${JAN}" target="_blank" rel="noopener">31 January 2026</a>); above 800,000 in the <a href="${FEB}" target="_blank" rel="noopener">20 February closing post</a></td>`],
      ['peak above 700,000 TPS</a> –',
       `peak above 700,000 TPS</a>, a peak the Foundation&#39;s <a href="${FEB}" target="_blank" rel="noopener">20 February closing post</a> gives as above 800,000 –`],
    ],
    message: 'Gave both first-party peak figures with their dates. The 31 January 2026 test post says peaks of over 700k TPS; the 20 February 2026 closing post says above 800k. The page carried only the first.',
  },
  {
    tagPath: '',
    slug: '',
    version: null,
    stamp: false,
    sentinel: `href="${FEB}" class="link" target="_blank" rel="noopener"><strong>500k+ sustained / 800k+ peak`,
    swaps: [
      [`href="${JAN}" class="link" target="_blank" rel="noopener"><strong>500k+ sustained / 800k+ peak`,
       `href="${FEB}" class="link" target="_blank" rel="noopener"><strong>500k+ sustained / 800k+ peak`],
    ],
    message: 'Max. tps cell: the 800k+ peak figure linked the 31 January 2026 post, which says 700k. Repointed to the 20 February 2026 closing post, which says above 800k.',
  },
];

function swapOnce(blocks, [from, to]) {
  let hits = 0;
  const visit = (list) => list.map((b) => {
    let next = b;
    if (typeof b.text === 'string' && b.text.includes(from)) {
      hits += b.text.split(from).length - 1;
      next = { ...b, text: b.text.replace(from, to) };
    }
    if (Array.isArray(b.blocks)) next = { ...next, blocks: visit(b.blocks) };
    return next;
  });
  const out = visit(blocks);
  if (hits !== 1) throw new Error(`expected 1 match, got ${hits}: ${from.slice(0, 60)}`);
  return out;
}

const texts = (list) => list.map((b) => (b.text ?? '') + (b.blocks ? '\n' + texts(b.blocks) : '')).join('\n');
const bump = (v) => { const [a, b, c] = v.split('.').map(Number); return `${a}.${b}.${c + 1}`; };

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];
    if (texts(page.content).includes(e.sentinel)) {
      console.log(`  ${page.title}: already applied - no write`);
      continue;
    }
    let blocks = JSON.parse(JSON.stringify(page.content));
    for (const s of e.swaps) blocks = swapOnce(blocks, s);
    const json = JSON.stringify(blocks);
    const [NBSP, EMDASH] = [0xa0, 0x2014].map((c) => String.fromCharCode(c));
    const before = JSON.stringify(page.content);
    if (json.split(NBSP).length !== before.split(NBSP).length || json.split(EMDASH).length !== before.split(EMDASH).length) {
      throw new Error(`${e.slug}: new U+00A0 or em dash in output`);
    }
    if (!texts(blocks).includes(e.sentinel)) throw new Error(`${e.slug}: sentinel missing after swaps`);
    const version = e.version ?? bump(page.version);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${e.swaps.length} swaps)`);
    if (DRY) continue;

    const now = new Date().toISOString();
    const type = version.endsWith('.0') ? 'minor' : 'patch';
    await client.query('BEGIN');
    // The homepage gets one link fixed, not a full re-read, so it is not stamped.
    await client.query(
      `UPDATE pages SET content=$1, version=$2, updated_at=$3${e.stamp === false ? '' : ', last_verified_at=$3'} WHERE id=$4`,
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, type, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
    console.log(`    written${e.stamp === false ? '' : ' and stamped'}`);
  }
});
