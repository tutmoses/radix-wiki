// sweep-398-leg-local-merges.mjs — blog rotation, run 398, second edit.
//
// /contents/tech/research/hyperscale-rs records leg local execution as a design stated
// in a Telegram channel and written down nowhere ("what is not yet written anywhere is
// the machinery that executes them in three stages", 4 September 2026). It merged on
// 9 September in two pull requests and the invariants document now carries nine
// leg-local invariants. This appends the merge to the section that made the claim.
//
//   node scripts/sweep-398-leg-local-merges.mjs [--dry-run]

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
import { bump } from 'wiki-formant/versioning';

config({ path: new URL('../.env', import.meta.url) });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const SENTINEL = 'leg-local-execution-merged';

const GH = 'https://github.com/hyperscalers/hyperscale-rs';
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const ADDITION = [
  `<h3 id="${SENTINEL}">Leg local execution merges (9 September 2026)</h3>`,
  `<p>The machinery arrived five days after it was named, in one merge rather than day by day. `,
  `${A(GH + '/pull/156', 'Pull request #156, &ldquo;Initial leg local execution impl.&rdquo;')}, opened from the branch `,
  `<code>new-local-leg</code> at 03:37&nbsp;UTC on 9 September 2026 and merged into <code>main</code> at 15:15&nbsp;UTC `,
  `the same day by its author, carries 300 commits across 313 files, +42,964 and &minus;14,112 lines, with no review `,
  `and no comment recorded on it. A second pull request, ${A(GH + '/pull/157', '#157, &ldquo;LLE streamline + refactor.&rdquo;')}, `,
  `merged at 19:03&nbsp;UTC the same evening: 17 commits over 45 files, +2,514 and &minus;3,698.</p>`,
  `<p>The lead developer had explained the delay in the channel while the branch was open, twice. At `,
  `${A('https://t.me/hyperscale_rs/12134', '23:26&nbsp;UTC on 7 September')} he wrote that `,
  `&ldquo;kitwatcher only tracks main branch. work is happening on a feature branch for leg local execution. `,
  `it&rsquo;s on github but won&rsquo;t be merged until i think it&rsquo;s robust, safety critical&rdquo;, and at `,
  `${A('https://t.me/hyperscale_rs/12141', '16:37&nbsp;UTC on 8 September')} that leg local execution `,
  `&ldquo;is an almost complete rewrite of how execution works&rdquo; and that he is &ldquo;not merging them before `,
  `they&rsquo;re done in order to appease any silly conception anyone might have around a kitwatcher score&rdquo;. `,
  `Kitwatcher is a community tracker that scores Radix repositories on commits to the default branch, so a branch `,
  `held back reads there as an idle project. Both messages are authorship-verified through their public embeds.</p>`,
  `<p>The design is now written down, where this section recorded on 4 September that it was not. `,
  `${A(GH + '/blob/main/docs/08-invariants.md', 'hyperscale-rs/docs/08-invariants.md')} carries a section headed `,
  `&ldquo;Leg-local execution&rdquo; holding nine invariants, INV-LL-1 to INV-LL-9, that state the terms the three-stage `,
  `division holds to: a transaction has exactly one core and it commits as a single atomic unit across its core set `,
  `(INV-LL-2); the only writes committed before the core&rsquo;s verdict are inbound escrow movements, kernel cells `,
  `keyed by the transaction, and the payer&rsquo;s fee burn (INV-LL-3); and an outbound delivery never gates a verdict `,
  `and never holds a reservation (INV-LL-7). Each names the file and function that enforces it. The pipeline document `,
  `the section points at, ${A(GH + '/blob/main/docs/04-atomic-commitment.md', '04-atomic-commitment.md')}, still `,
  `describes cross-shard commitment as provision, execute, certify, and has not been rewritten around the stages.</p>`,
].join('');

if (/[— ]/.test(ADDITION.replace(/&nbsp;/g, ''))) throw new Error('literal em dash or U+00A0 in ADDITION');

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = structuredClone(page.content);
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied — no write');
    return;
  }
  const i = blocks.findIndex((b) => b.text?.includes('id="leg-local-execution"'));
  if (i < 0) throw new Error('leg local execution section not found');
  blocks[i] = { ...blocks[i], text: blocks[i].text + ADDITION };

  const version = bump(page.version, 'minor');
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  block ${i} +${ADDITION.length} bytes`);
  if (DRY) return;

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
     'Leg local execution merged on 9 September in PRs #156 and #157, and the invariants document now carries nine leg-local invariants; the section said the machinery was written down nowhere.', now]);
  await client.query('COMMIT');
});
