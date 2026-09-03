import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 357, community rotation. The lead developer of the Xi'an candidate withdrew from Radix funding
// at 00:28 UTC on 3 September 2026, in the project's own Telegram channel and nowhere else.
// Every quoted message was authorship-verified at its public embed (t.me/<ch>/<id>?embed=1&mode=tme):
//   11644 00:28:34, 11647 00:39:00, 11649 00:44:06, 11653 00:49:51, 11656 01:01:43 - all flightofthefox
//   11654 00:51:24 is a channel member's question, unanswered in the channel as of the 03:04 UTC read
// RadixTalk topic 2280 (the Xi'an RFC) re-read 03:0x UTC 3 September: 15 posts, last reply 4 May 2026,
// closed false, archived false. No withdrawal is recorded on the forum where the proposal lives.
// Gateway at 03:04:29 UTC: epoch 339,896, state version 557,840,622, round 102 - a twelfth identical read.

const TAG_PATH = 'community';
const SLUG = 'flightofthefox';
const VERSION = '1.3.0';
const SENTINEL = 'Withdrawal from Radix funding';

const FUND_OLD = 'Milestone 1 paid directly by the <a href="/ecosystem/radix-foundation" rel="noopener">Radix Foundation</a></td></tr>';
const FUND_NEW = 'Milestone 1 paid directly by the <a href="/ecosystem/radix-foundation" rel="noopener">Radix Foundation</a>. On <a href="https://t.me/hyperscale_rs/11644" target="_blank" rel="noopener">3 September 2026</a> he said he will not pursue any further proposal, grant or engagement with Radix</td></tr>';

const SECTION = `<h2>Withdrawal from Radix funding (3 September 2026)</h2>
<p>At <strong>00:28 UTC on 3 September 2026</strong>, with the network <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">still halted</a> in its third day, he wrote one sentence in the project channel: <a href="https://t.me/hyperscale_rs/11644" target="_blank" rel="noopener">&ldquo;having thought on it. i have decided not to pursue any proposal, grants or ongoing engagements with radix as a network, dao, or otherwise&rdquo;</a>. Asked immediately how development would be funded and whether the project would continue, he <a href="https://t.me/hyperscale_rs/11647" target="_blank" rel="noopener">answered at 00:39</a>: &ldquo;yes, hyperscale will continue. and radix is free to adopt the protocol as they wish. it is an open project.&rdquo;</p>
<p>His stated reason is about the relationship rather than the money. At <a href="https://t.me/hyperscale_rs/11649" target="_blank" rel="noopener">00:44</a>: &ldquo;i just don&rsquo;t want anything to do with people who think some minuscule grant has purchased me for particular project&hellip; i&rsquo;d rather reject grants and not deal with the bullshit.&rdquo; At <a href="https://t.me/hyperscale_rs/11653" target="_blank" rel="noopener">00:49</a> he separated that from delivery: &ldquo;to be clear. i don&rsquo;t anticipate any change in the velocity of delivering the tech. i just don&rsquo;t want to deal with people who think i need to behave in some particular way. the tech will be delivered because i think it is good.&rdquo; And at <a href="https://t.me/hyperscale_rs/11656" target="_blank" rel="noopener">01:01</a>, on why a written scope did not settle it: &ldquo;you can specify something to the nth degree, and still have people completely disregard that and protest that you&rsquo;re obligated to do something more or different.&rdquo; Each message is confirmed as his at its own public embed.</p>
<p>The statement was made in the channel and nowhere else. The <a href="https://radixtalk.com/t/rfc-xian-delivering-hyperscale-for-radix/2280" target="_blank" rel="noopener">Xi&rsquo;an RFC</a> on the governance forum carries no withdrawal post: re-read on 3 September 2026 it holds fifteen replies, the last of them dated 4 May 2026, and the topic is neither closed nor archived. The proposal therefore stands unaltered on the forum while its author has said he will not pursue it. A member&rsquo;s <a href="https://t.me/hyperscale_rs/11654" target="_blank" rel="noopener">direct question at 00:51</a>, whether he would assist a migration if the DAO voted to adopt Hyperscale, had drawn no answer in the channel by 03:04 UTC; the 00:39 message says only that Radix is free to adopt the protocol.</p>
<p>What this changes is the terms, not the code. The RFC put $300,000 across six milestones, of which <a href="/contents/tech/research/hyperscale-rs" rel="noopener">Milestone 1</a> was paid directly by the Foundation in May 2026 and the remaining five were contingent on the DAO treasury coming online; it also gave the <a href="/ecosystem/radix-accountability-council" rel="noopener">Radix Accountability Council</a> milestone sign-off, named a neutral arbitrator for disputes, and let the funder stop at any boundary with no exit fee. A codebase written outside all of that keeps every technical property it had and loses each of those levers. It also makes operative the remark he gave under pressure on the night of the halt, that he was going to cash so development could continue &ldquo;irrespective of what else happens&rdquo;: the funding half of the key-man question the RFC itself put to the community is now answered by one person&rsquo;s own runway rather than by a milestone schedule.</p>`;

const MESSAGE = 'Records the 3 September 2026 statement, made in the project Telegram channel at 00:28 UTC and nowhere else, that he will not pursue any proposal, grant or ongoing engagement with Radix as a network or DAO, while hyperscale-rs continues as an open project Radix is free to adopt and delivery velocity is unchanged. Five messages quoted and authorship-verified at their public embeds; the Xi\'an RFC topic re-read the same morning is unaltered, last reply 4 May 2026, neither closed nor archived. Infobox funding row updated.';

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const [label, s] of [['FUND_NEW', FUND_NEW], ['SECTION', SECTION], ['MESSAGE', MESSAGE]]) {
    if (s.includes(' ')) throw new Error(`${label} carries a literal U+00A0`);
    if (s.includes('—')) throw new Error(`${label} carries an em dash`);
  }
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied - no write'); process.exit(0); }

  const info = blocks[0];
  if (info.type !== 'infobox') throw new Error('block 0 is not the infobox');
  if (!info.blocks[0].text.includes(FUND_OLD)) throw new Error('funding find-string did not match');
  info.blocks[0].text = info.blocks[0].text.replace(FUND_OLD, FUND_NEW);

  const last = blocks[blocks.length - 1];
  if (!last.text || !last.text.includes('<h2>External links</h2>')) throw new Error('last block is not External links');
  blocks.splice(blocks.length - 1, 0, { id: uid(), type: 'content', text: SECTION });

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  ${page.content.length} blocks -> ${blocks.length}, 1 infobox substitution`);
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
