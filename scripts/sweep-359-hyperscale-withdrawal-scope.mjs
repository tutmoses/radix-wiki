/**
 * Run 359 — hyperscale-rs: what the 3 September withdrawal actually covers.
 *
 * Run 357 recorded the withdrawal itself (00:28 UTC, four messages). Nine hours
 * later the lead developer answered, at length and under direct questioning in
 * the project channel, the three questions it left open: what the withdrawal
 * covers, what the Foundation payment had bought, and whether Radix is still
 * the destination. Every quotation below is authorship-verified at its own
 * public t.me embed (flightofthefox unless attributed otherwise).
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const SENTINEL = 'hyperscale_rs/11822';
const DRY = process.argv.includes('--dry-run');

const T = (id) => `https://t.me/hyperscale_rs/${id}`;

const SECTION = `
<h3>What the Withdrawal Covers (3 September 2026)</h3>
<p>Between 09:18 and 11:00 UTC the same morning, pressed in the project channel over what the withdrawal meant, the lead developer answered the questions the first four messages had left open. The exchange was adversarial &mdash; his counterpart for most of it was <a href="${T(11778)}" target="_blank" rel="noopener">a channel admin arguing that the position was ambiguous</a> and that &ldquo;if you build scaling for Radix it&rsquo;s underpaid&rdquo; &mdash; and the answers are correspondingly blunt. Each is confirmed as his at its own public embed.</p>
<p><strong>The scope is future grants, not the work.</strong> Asked directly whether he no longer wished to receive funding beyond what had already been paid out, he answered: <a href="${T(11822)}" target="_blank" rel="noopener">&ldquo;How much more clear can I be? I do not wish to pursue additional grants from Radix&rdquo;</a> &mdash; and separated that from any principle, &ldquo;not particularly because I think that steering organisations of decentralized networks should not support open source devs working on their technical foundations. Merely because irrational counterparties like yourself make the whole experience miserable.&rdquo; He had put the same point more plainly an hour earlier: <a href="${T(11765)}" target="_blank" rel="noopener">&ldquo;The idea I would stop working on it if not paid is laughable to me&hellip; I just don&rsquo;t want to deal with the bullshit associated with taking any grants because people run roughshod over any parameters specified anyway.&rdquo;</a> Where the withdrawal message of 00:28 UTC gave the relationship as the reason, this states the mechanism: the grant is what gives the dispute a surface, so removing the grant removes the dispute &mdash; <a href="${T(11775)}" target="_blank" rel="noopener">&ldquo;if the root of our disagreements is compensation, I&rsquo;d rather just take the matter off the table.&rdquo;</a></p>
<p><strong>What the Foundation payment bought was narrower than the RFC schedule.</strong> Rejecting the reading that a grant had made him Radix&rsquo;s technical lead, he described the terms of what was actually paid: <a href="${T(11740)}" target="_blank" rel="noopener">&ldquo;I have always been 100% clear there was never any obligations of either side to continue&hellip; the foundation payment was very clear that the only deliverable was open-sourcing work completed to date.&rdquo;</a> That is a materially smaller commitment than the six-milestone table above implies, and it is discharged: the dual MIT/Apache-2.0 licence committed to both repositories on <a href="https://github.com/hyperscalers/hyperscale-rs/commit/91db7add4a917d8bf382b6b2a250577983e57cff" target="_blank" rel="noopener">7 August 2026</a> is the deliverable, and it is irrevocable. On that account nothing is owed in either direction, which is consistent with a withdrawal announced without notice or settlement.</p>
<p><strong>No payment record has been published.</strong> The only figure on the record entered the conversation from the questioner, who asked whether he no longer wished to receive funding <a href="${T(11821)}" target="_blank" rel="noopener">&ldquo;past the $50k or whatever it was already paid out&rdquo;</a>; the developer&rsquo;s reply took the number up sarcastically rather than confirming it &mdash; <a href="${T(11801)}" target="_blank" rel="noopener">&ldquo;that $50k which became $25k will fund hyperscale for the rest of time and it will require no sacrifices on my part.&rdquo;</a> Neither the Foundation nor the developer has published an amount or a payment date, so the wiki records the exchange rather than a figure. The halving it describes is what the RFC&rsquo;s own mechanism does: payment is denominated in USD but settled in XRD at a 30-day TWAP, so a payment fixed in dollars and taken in a falling token is worth what the token is worth when it is sold, and <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">the price has since fallen further still</a>.</p>
<p><strong>Radix is not stated to be the destination.</strong> The sharpest disagreement was over whether hyperscale-rs is being built <em>for</em> Radix. He declined the framing twice &mdash; <a href="${T(11760)}" target="_blank" rel="noopener">&ldquo;you just choose to completely ignore the clear parameters I&rsquo;ve always had (that Hyperscale is an open source project)&rdquo;</a> &mdash; and put the goal in terms that name no chain: <a href="${T(11790)}" target="_blank" rel="noopener">&ldquo;the only thing I particularly care about is the tech being adopted&hellip; in any format that takes&rdquo;</a>, and <a href="${T(11796)}" target="_blank" rel="noopener">&ldquo;I would much rather just work on the tech and give it away to anyone and everyone.&rdquo;</a> Asked why not simply launch a chain of his own with a token, he refused that too: <a href="${T(11795)}" target="_blank" rel="noopener">&ldquo;talk about monetization of the tech is actually a thing that undermines my motivation.&rdquo;</a> For <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi'an</a> the consequence is precise and worth stating plainly: the licence lets Radix adopt this code, and the author says he would welcome anyone adopting it, but as of 3 September 2026 there is no commitment from him that Radix is where it lands. He closed the exchange on the only thing he did commit to &mdash; <a href="${T(11807)}" target="_blank" rel="noopener">&ldquo;I&rsquo;m just going to wake up again tomorrow and keep working on the tech anyway.&rdquo;</a></p>
`.trim();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const i = blocks.findIndex((b) => (b.text || '').includes('Funding Withdrawn (3 September 2026)'));
  if (i === -1) throw new Error('funding block not found — run 357 section missing');
  blocks[i] = { ...blocks[i], text: blocks[i].text + '\n' + SECTION };

  const version = '6.21.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  block ${i}: ${blocks[i].text.length - blocks[i].text.length + SECTION.length} chars appended`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Records what the 3 September withdrawal covers. Nine hours after the 00:28 UTC announcement the lead developer answered under direct questioning: the withdrawal is of future grants only ("I do not wish to pursue additional grants from Radix"), the stated reason is the counterparties rather than a principle, and the Foundation payment\'s "only deliverable was open-sourcing work completed to date" - narrower than the six-milestone table and discharged by the 7 August licence commit. No payment record has been published; the $50k figure enters from the questioner and is taken up sarcastically, so the exchange is recorded rather than the number. Most consequential for Xi\'an: he twice declined the framing that Hyperscale is built for Radix, wanting "the tech being adopted... in any format that takes". Nine messages quoted, each authorship-verified at its public embed.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
