// sweep-364: /policy/verifiability gains a procedure for the source it uses most.
//
// A census on 4 September 2026 found 546 citations to individual Telegram
// messages across 71 of the wiki's 380 pages, concentrated on hyperscale-rs
// (118) and the Hyperlane drain page (35), which is the site's most-read
// article. The sourcing policy governing them said only that "unattributed
// forum posts are weak sources" — nothing about how one stops being
// unattributed. This adds the method the sweep has actually been using: the
// message's own public t.me embed, which names its author, plus the reply-block
// trap that silently misattributes a quotation, and the rule that a figure
// introduced by a questioner is not sourced by the answer.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'policy';
const SLUG = 'verifiability';
const SENTINEL = 'id="citing-a-chat-message"';
const DRY = process.argv.includes('--dry-run');

const OLD_CLAUSE = 'Marketing copy and unattributed forum posts are weak sources and should be replaced.';
const NEW_CLAUSE = 'Marketing copy and unattributed forum posts are weak sources and should be replaced. A chat message is the ordinary case on this wiki rather than the exception, and <a href="#citing-a-chat-message" class="link">citing one</a> has a procedure of its own.';

const SECTION = `<h2 id="citing-a-chat-message">Citing a chat message</h2><p>Much of what this wiki learns first is said in a Telegram channel, and its citations show it. Read on 4 September 2026, <strong>546</strong> links across <strong>71</strong> of the wiki&rsquo;s 380 pages point at one individual Telegram message &ndash; 229 into the <a href="https://t.me/hyperscale_rs" target="_blank" rel="noopener">hyperscale-rs</a> channel, 130 into <a href="https://t.me/radix_dlt" target="_blank" rel="noopener">Radix DLT Official</a>, 61 into the <a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">Accountability Council&rsquo;s</a>. They gather where no other record exists: 118 on <a href="/contents/tech/research/hyperscale-rs" class="link">hyperscale-rs</a> and 35 on <a href="/contents/history/hyperlane-asset-drain-2026" class="link">the Hyperlane asset drain</a>, which is the most-read article on the site. The section above calls an unattributed forum post a weak source, and a chat message arrives unattributed by default. What follows is the step that changes that.</p><h3>The message arrives without its author</h3><p>A public channel read through Telegram&rsquo;s API returns four things per message: the channel, a numeric id, a timestamp, and the text. It does not return who wrote it. A quotation taken from that read alone carries a checkable date and a speaker the editor supplied, which is the shape <a href="/policy/no-original-research" class="link">no original research</a> rules out &ndash; the reading is real and the attribution is an inference.</p><h3>The embed settles the author</h3><p>Every message in a public channel also has a public embed, and the embed names who posted it. Requesting <code>https://t.me/&lt;channel&gt;/&lt;id&gt;?embed=1&amp;mode=tme</code> returns that single message rendered with the display name and handle of its author, above the channel title. Two read while this section was written: the Accountability Council&rsquo;s status update at <a href="https://t.me/RadixAccountabilityCouncil/971" target="_blank" rel="noopener">11:02&nbsp;UTC on 4 September 2026</a> resolves to <strong>projectShift</strong>, and the message this wiki cites for <a href="/ecosystem/astrolescent" class="link">Astrolescent&rsquo;s</a> funding resolves to <strong>Timan | Astrolescent</strong>, handle <code>@djtrebel</code>. Cite the plain message URL in the article, and read the embed before you do.</p><p>One failure here is silent. Where the cited message is a reply, the embed renders two messages &ndash; the one requested first, then the one it answers &ndash; and each carries its own author block. <a href="https://t.me/radix_dlt/1001809" target="_blank" rel="noopener">t.me/radix_dlt/1001809</a> renders as Timan | Astrolescent answering Jon-Eric Cook, so taking the name from the second block credits the quotation to the person being answered, and the finished citation looks correct either way. Take the first author block, and check whether the reply marker points at a message id other than the one requested.</p><h3>What an embed establishes, and what it does not</h3><p>An embed establishes that a handle posted this text in this channel at this time. It does not establish that the display name belongs to the person it names, and it says nothing about whether the text is true. A chat message is a source for what someone said, dated and attributed, and it enters an article as attribution rather than in the wiki&rsquo;s own voice, per <a href="/policy/neutral-point-of-view" class="link">neutral point of view</a>. Where the speaker is describing their own work, their own project, or their own withdrawal from one, that is the claim they are a strong source for.</p><p>A figure that enters a conversation from the person asking is not sourced by the answer. Asked in September 2026 whether he was giving up funding <a href="https://t.me/hyperscale_rs/11821" target="_blank" rel="noopener">&ldquo;past the $50k or whatever it was already paid out&rdquo;</a>, the author of <a href="/contents/tech/research/hyperscale-rs" class="link">hyperscale-rs</a> <a href="https://t.me/hyperscale_rs/11801" target="_blank" rel="noopener">took the number up sarcastically</a>, and neither he nor the Foundation has published an amount or a payment date. That page quotes both messages and records the exchange; it does not record $50,000 as a sum paid. The general form is narrow: a number is sourced by whoever can be shown to have asserted it, and a question is not an assertion.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  for (const [name, s] of [['OLD_CLAUSE', OLD_CLAUSE], ['SECTION', SECTION], ['NEW_CLAUSE', NEW_CLAUSE]]) {
    if ([...s].some((ch) => ch.charCodeAt(0) === 0x00a0)) throw new Error(`${name} contains a literal U+00A0`);
  }

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const sourcesIdx = blocks.findIndex((b) => b.text?.includes(OLD_CLAUSE));
  if (sourcesIdx === -1) throw new Error('Reliable sources clause not found — aborting');
  blocks[sourcesIdx].text = blocks[sourcesIdx].text.replace(OLD_CLAUSE, NEW_CLAUSE);

  const citationsIdx = blocks.findIndex((b) => b.text?.includes('<h2>Citations needed</h2>'));
  if (citationsIdx === -1) throw new Error('Citations needed block not found — aborting');
  blocks.splice(citationsIdx, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '1.7.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  clause patched in block ${sourcesIdx}; new section spliced at ${citationsIdx}; ${page.content.length} -> ${blocks.length} blocks`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Add "Citing a chat message": 546 Telegram-message citations across 71 of 380 pages had no sourcing procedure. Documents the t.me embed as the authorship check (RAC/971 -> projectShift, radix_dlt/1001809 -> @djtrebel), the reply-block misattribution trap, and the rule that a figure introduced by a questioner is not sourced by the answer.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
