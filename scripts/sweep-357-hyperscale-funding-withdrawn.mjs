import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 357, the technical half of the community-rotation lead. The Funding Status subsection of
// "Xi'an RFC and Funding (April-May 2026)" ends in May 2026 and now has a September ending.
// Sources, all read 03:0x UTC 3 September 2026:
//   t.me/hyperscale_rs/11644, 11647, 11649, 11653 - embed-verified as flightofthefox
//   radixtalk.com/t/rfc-xian-delivering-hyperscale-for-radix/2280.json - 15 posts, last reply 4 May 2026,
//     closed false, archived false, 1,190 views
// The companion edit is /community/flightofthefox v1.3.0.

const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const VERSION = '6.20.0';
const SENTINEL = 'Funding Withdrawn';
const BLOCK_ID = 'a4aa44ce-271a-4b7d-b526-50180855a4a8';

const ADDITION = `<h3>Funding Withdrawn (3 September 2026)</h3>
<p>That arrangement ended in one sentence. At <strong>00:28 UTC on 3 September 2026</strong>, three days into the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">network halt</a>, the lead developer wrote in the project channel that he had <a href="https://t.me/hyperscale_rs/11644" target="_blank" rel="noopener">&ldquo;decided not to pursue any proposal, grants or ongoing engagements with radix as a network, dao, or otherwise&rdquo;</a>. Asked at once whether the project would continue, he <a href="https://t.me/hyperscale_rs/11647" target="_blank" rel="noopener">said it would</a>: &ldquo;yes, hyperscale will continue. and radix is free to adopt the protocol as they wish. it is an open project.&rdquo; On delivery he was <a href="https://t.me/hyperscale_rs/11653" target="_blank" rel="noopener">explicit</a>: &ldquo;i don&rsquo;t anticipate any change in the velocity of delivering the tech&hellip; the tech will be delivered because i think it is good.&rdquo; The reason he gave was the relationship rather than the amount: <a href="https://t.me/hyperscale_rs/11649" target="_blank" rel="noopener">&ldquo;i just don&rsquo;t want anything to do with people who think some minuscule grant has purchased me for particular project.&rdquo;</a> Each message is confirmed as his at its own public embed.</p>
<p>The withdrawal was stated in the channel only. Re-read on 3 September 2026, the <a href="https://radixtalk.com/t/rfc-xian-delivering-hyperscale-for-radix/2280" target="_blank" rel="noopener">RFC topic</a> holds fifteen replies whose last is dated 4 May 2026, and is neither closed nor archived, so the proposal stands on the forum unaltered. For this article the consequence is confined to the funding and governance terms: the five unpaid milestones, the Accountability Council sign-off on each of them, the named arbitrator and the funder&rsquo;s no-exit-fee stop at any boundary all lapse with the proposal, while the licence granted in August 2026 is irrevocable and the code, the roadmap and the single-author concentration described throughout this article are unchanged. Whether the DAO can still adopt the result is a question about adoption rather than about funding, and the only answer on the record is that Radix is free to do so.</p>`;

const MESSAGE = 'Funding Status now has its September ending. On 3 September 2026 at 00:28 UTC the lead developer said in the project channel that he will not pursue any proposal, grant or ongoing engagement with Radix as a network or DAO, while stating that hyperscale-rs continues as an open project Radix is free to adopt and that delivery velocity is unchanged. Four messages quoted and authorship-verified at their public embeds; the Xi\'an RFC topic re-read the same morning carries no withdrawal, last reply 4 May 2026, neither closed nor archived. What lapses is the milestone schedule, the Council sign-off, the arbitration clause and the no-exit-fee stop; the licence and the code do not.';

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const [label, s] of [['ADDITION', ADDITION], ['MESSAGE', MESSAGE]]) {
    if (s.includes('\u00A0')) throw new Error(`${label} carries a literal U+00A0`);
    if (s.includes('\u2014')) throw new Error(`${label} carries an em dash`);
  }
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied - no write'); process.exit(0); }

  const target = blocks.find((b) => b.id === BLOCK_ID);
  if (!target) throw new Error('funding block not found by id');
  if (!target.text.includes('<h3>Funding Status</h3>')) throw new Error('block is not the funding section');
  target.text += '\n' + ADDITION;

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  block ${BLOCK_ID.slice(0, 8)} ${page.content.find((b) => b.id === BLOCK_ID).text.length} -> ${target.text.length} chars`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now]);
    await client.query('COMMIT');
    console.log('    written');
  }
} finally {
  client.release();
  await pool.end();
}
