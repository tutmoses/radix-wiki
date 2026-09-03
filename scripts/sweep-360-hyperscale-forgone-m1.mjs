/**
 * Run 360. Extends the run-359 section "What the Withdrawal Covers" on
 * /contents/tech/research/hyperscale-rs with the one fact the afternoon added, and it is
 * the fact that prices the withdrawal: an M1 payment from RDX Works was about a week
 * from being paid when the developer withdrew, and he says he will build the remaining
 * milestone stages anyway. Three messages, each authorship-verified at its public embed
 * (t.me/hyperscale_rs/<id>?embed=1&mode=tme names flightofthefox on all three).
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const SENTINEL = 'hyperscale_rs/11875';
const DRY = process.argv.includes('--dry-run');
const T = (id) => `https://t.me/hyperscale_rs/${id}`;

const ANCHOR = '<a href="https://t.me/hyperscale_rs/11807" target="_blank" rel="noopener">&ldquo;I&rsquo;m just going to wake up again tomorrow and keep working on the tech anyway.&rdquo;</a></p>';

const ADDITION = `<p><strong>The withdrawal has a price, and it was about a week from being paid.</strong> Through the afternoon of 3 September the same developer put a figure on what the decision costs him, without naming an amount: <a href="${T(11875)}" target="_blank" rel="noopener">&ldquo;If I was trying to hyper-optimize for some financial gain I would wait a week for RDX to pay out M1&hellip; I&rsquo;m not though, I just want to work on the tech and try to keep my sanity and dignity.&rdquo;</a> That dates a pending Milestone 1 payment from RDX Works to roughly 10 September 2026 and places the withdrawal ahead of it rather than after it &mdash; the first statement from either side that the milestone schedule was still live and paying when it was abandoned. No payment record has been published, and the sum is not stated; the figures circulating in the channel come from questioners rather than from either party and are not recorded here.</p><p>The same message is also the fullest commitment yet made to the work itself, and it is broader than the RFC: <a href="${T(11875)}" target="_blank" rel="noopener">&ldquo;And work on it i will. Through all the stages of VM, and gateway, and desktop validator, and everything else in the milestones. And even all the additional ideas I&rsquo;ve thought of along the way like privacy solutions.&rdquo;</a> Read alongside the refusal earlier the same morning to say that Radix is where the code lands, the position is now specific on both halves: the six-milestone <em>programme</em> survives the withdrawal, the <em>funding</em> does not, and the destination is still unstated. On the tokens already earmarked for it he was explicit that they should go elsewhere &mdash; <a href="${T(11851)}" target="_blank" rel="noopener">&ldquo;The game theoretic optimal play of the DAO is to reallocate those earmarked tokens toward getting users or something&rdquo;</a> &mdash; and on his own position, <a href="${T(11904)}" target="_blank" rel="noopener">&ldquo;The only person who really needs to worry about funding is me&hellip;. and I&rsquo;m not worried.&rdquo;</a></p>`;

if (ADDITION.includes('\u00a0') || ANCHOR.includes('\u00a0')) throw new Error('U+00A0 in script strings');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const i = blocks.findIndex((b) => (b.text || '').includes('What the Withdrawal Covers'));
  if (i < 0) throw new Error('run-359 withdrawal section not found');
  if (!blocks[i].text.includes(ANCHOR)) throw new Error('find-string missed: section anchor');
  blocks[i].text = blocks[i].text.replace(ANCHOR, ANCHOR + ADDITION);

  const version = '6.22.0';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (block ${i}: ${page.content[i].text.length} -> ${blocks[i].text.length} chars)`);
  if (!DRY) {
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Extend the withdrawal section with the afternoon of 3 September: an M1 payment from RDX Works was roughly a week from being paid when the developer withdrew ("I would wait a week for RDX to pay out M1"), so the schedule was live and paying when it was abandoned; he commits to the remaining milestone stages regardless ("all the stages of VM, and gateway, and desktop validator"); and he asks the DAO to reallocate the earmarked tokens. Three messages, each authorship-verified at its public embed. Circulating payment figures come from questioners and are deliberately not recorded.',
       now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
