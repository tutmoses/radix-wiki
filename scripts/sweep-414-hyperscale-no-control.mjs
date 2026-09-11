/**
 * sweep 414 — signal sweep.
 *
 * The article's account of where the developer places himself stops on 3 September,
 * where he declines to say that Radix is the destination. On 11 September, the day
 * mainnet restarted, he was asked the other half of that question — what becomes of
 * the community and its XRD — and answered it for the first time. Both halves now
 * sit in the same subsection instead of one of them being open.
 *
 * Idempotent on the heading id. --dry-run prints the version move.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient, assertLinkShapes } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const SENTINEL = 'no-control-over-radix';
const ANCHOR = '<h3>What the Withdrawal Covers (3 September 2026)</h3>';

const HTML = `<h3 id="${SENTINEL}">What Becomes of Radix (11 September 2026)</h3>
<p>Eight days later, on the evening of the day <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">mainnet committed its first round in ten days</a>, the channel asked the half of the question 3 September had left open. Where that morning had settled what the withdrawal covers and refused the framing that Hyperscale is built <em>for</em> Radix, nobody had yet got an answer on the obverse: what the people holding XRD should now expect. The question came after an exchange in the channel over how much of <a href="/contents/history/dan-hughes" rel="noopener">Dan Hughes</a>'s research the project inherits, and it was put directly &mdash; will a new network be built, what happens to our tokens, what are your objectives regarding this community.</p>
<p>At 23:04&nbsp;UTC he answered both halves in one message, and the first half is the position already on the record stated more broadly than before: <a href="https://t.me/hyperscale_rs/12194" target="_blank" rel="noopener">&ldquo;i intend for hyperscale to be an open source project in the most exemplary sense&hellip; i want to focus on building good primitives, and it doesn't matter overmuch to me who ends up using them&rdquo;</a>. The second half is new, and it is a refusal rather than a plan: &ldquo;i think you hit on your actual question with &lsquo;what will become of us?&rsquo; i don't know mate. it is not really something that i have any control over &mdash; and as such, i don't think about at all.&rdquo; The message is confirmed as his at its own public embed.</p>
<p>Read against the rest of this section the position is now complete rather than partial, and the completion matters for <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi'an</a> as a release plan. On 3 September he declined to name Radix as the destination; on 11 September he declined to hold a view on the destination's fate. The licence still lets Radix adopt this code and the author still says he would help migrate state <a href="https://t.me/hyperscale_rs/11403" target="_blank" rel="noopener">&ldquo;if Radix still exists, and the DAO wants help&rdquo;</a>, so nothing technical has closed. What has closed is the reading that the author is holding a plan for the network in reserve. Any such plan has to come from whoever adopts the protocol, and on the record that is not him.</p>`;

await withClient(async (client) => {
  if (isLockedPage(TAG, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied — no write');
    return;
  }

  const bi = blocks.findIndex((b) => (b.text || '').includes(ANCHOR));
  if (bi < 0) throw new Error('withdrawal-covers heading not found');
  // The new h3 closes the subsection, so it goes at the end of that block.
  blocks[bi].text = `${blocks[bi].text}\n${HTML}`;
  assertLinkShapes(blocks, SLUG);

  const version = '6.26.0';
  const message = "Records the 11 September answer to the question 3 September left open: asked what becomes of the community and its XRD, the lead developer restated Hyperscale as an open-source project 'in the most exemplary sense' indifferent to who adopts it, and said the community's future is 'not really something that i have any control over'. Authorship confirmed at the message's own embed.";
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  block ${bi}  (+${HTML.length} chars)`);
  if (DRY) return;

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID, message, now]);
  await client.query('COMMIT');
  console.log('  wrote');
});
