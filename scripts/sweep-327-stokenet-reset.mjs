// Run 327, contents/tech rotation, and the reset the page had been describing in
// the future tense happened today. /contents/tech/releases/stokenet is brought to
// reset day: the 28 Aug reminder and the 10:00 UTC 29 Aug status update (both
// authored by Daffy, verified through the t.me embed author field), the divergence
// between "the same four validators return, reusing their existing keys"
// (18 Aug) and "a new set of keys and a new genesis generation" (29 Aug), and a
// first-hand read of both Gateways at 11:06 UTC.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/releases';
const SLUG = 'stokenet';
const SENTINEL = 'Reset day, 29 August 2026';
const DRY = process.argv.includes('--dry-run');

const NOTE = '<p><em>Operational note, 29 August 2026: the full Stokenet reset is under way. The network went down at <strong>07:00&nbsp;UTC on Saturday 29 August 2026</strong> and the Gateway was still answering HTTP&nbsp;521 at 11:06&nbsp;UTC. Every balance, transaction and deployed package is destroyed; the network ID, the Gateway URL and your account addresses survive unchanged. The terms, the operator&rsquo;s reset-day updates, and what a developer has to redo afterwards are in the &ldquo;Full reset&rdquo; section below.</em></p>';

const LEDGER = '<p>The pre-reset ledger is the one being discarded. Read live from the Stokenet Gateway at <strong>19:05&nbsp;UTC on 18 August 2026</strong>, eleven days before the reset, the network stood at <strong>epoch 254,681</strong> and state version <strong>424,218,910</strong>, served by node release <code>v1.10.6</code>, 1,335 epochs further on than the 16 August read of epoch 253,346. A reset is not a protocol upgrade and carries no new <a href="/contents/tech/releases/protocol-updates" rel="noopener">protocol version</a>; it discards the test network&rsquo;s accumulated state and starts its ledger again from genesis.</p>';

const RESET_DAY = [
  '<h3>Reset day, 29 August 2026</h3>',
  '<p>The reset went ahead on the announced date. <a href="/community/daffy" rel="noopener">Daffy</a> reprised it in the developer channel the evening before, at <a href="https://t.me/RadixDevelopers/66061" target="_blank" rel="noopener">19:45&nbsp;UTC on 28 August</a>, as the first Stokenet reset &ldquo;in 3 years&rdquo;, with validators, full nodes and Gateways all stopped for some hours for server maintenance alongside the new genesis. The same message gives the reason the Gateway cannot simply be rebooted around it: blue-green deployment of the Gateway was dropped as a cost saving, so the Gateway service and its database host have to be stopped to be patched at all.</p>',
  '<p>A <a href="https://t.me/RadixDevelopers/66075" target="_blank" rel="noopener">status update</a> followed at 10:00&nbsp;UTC on 29 August. Maintenance patching of the VMs and hosts was done and the new genesis was &ldquo;verified working. Liveness proven&rdquo;. Two operational consequences came with it. The Java source had to be recompiled to remove the old hash, so a new image distribution is needed for new validators. And because the existing network ID is being reused, the old validators are being cleaned out, which the operator says &ldquo;require a new set of keys and a new genesis generation&rdquo;. That is a departure from the 18 August announcement, which had said the same four validators would return reusing their existing keys; the operator has not said which of the two the restarted network will run, and nothing published so far reconciles them. The Gateway then needs about thirty minutes to sync, and more hours of downtime were expected past 10:00&nbsp;UTC.</p>',
  '<p>Read directly at <strong>11:06&nbsp;UTC on 29 August</strong>, the outage is as described. <code>babylon-stokenet-gateway.radixdlt.com</code> answers <strong>HTTP&nbsp;521</strong> with a sixteen-byte <code>error code: 521</code> body, and so does <code>stokenet.radixdlt.com</code>, which resolves to the same three addresses. The Radix <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">mainnet Gateway</a> answers normally in the same minute, at epoch <strong>339,198</strong> and state version <strong>556,718,397</strong> on node release <code>v1.10.6</code>. That separation is the point of a separate test network: a Stokenet reset stops nothing on mainnet.</p>',
  '<p><em>The reset-day statements above are Telegram messages in the Radix Developer Discussion group, each attributed to Daffy by the message&rsquo;s own embed markup.</em></p>',
].join('\n');

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
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied — no write'); process.exit(0); }

  // 1. block 1: replace the leading operational note paragraph (18 Aug, future tense).
  const b1 = blocks[1];
  const noteStart = b1.text.indexOf('<p><em>Operational note');
  if (noteStart !== 0) throw new Error(`operational note not at head of block 1 (index ${noteStart})`);
  const noteEnd = b1.text.indexOf('</em></p>', noteStart);
  if (noteEnd < 0) throw new Error('operational note end not found');
  const oldNote = b1.text.slice(noteStart, noteEnd + '</em></p>'.length);
  b1.text = NOTE + b1.text.slice(noteEnd + '</em></p>'.length);

  // 2. block 2: replace the "Nothing has been reset yet" paragraph, then append reset day.
  const b2 = blocks[2];
  const lStart = b2.text.indexOf('<p>Nothing has been reset yet.');
  if (lStart < 0) throw new Error('pre-reset ledger paragraph not found');
  const lEnd = b2.text.indexOf('</p>', lStart);
  const oldLedger = b2.text.slice(lStart, lEnd + 4);
  b2.text = b2.text.slice(0, lStart) + LEDGER + b2.text.slice(lEnd + 4);
  b2.text = b2.text.trimEnd() + '\n' + RESET_DAY;

  const version = '1.5.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log('  - replaced note   :', oldNote.slice(0, 110), '...');
  console.log('  - replaced ledger :', oldLedger.slice(0, 110), '...');
  console.log('  - appended        :', RESET_DAY.length, 'B under', SENTINEL);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$4 WHERE id=$5',
      [json, version, now, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Reset day. Adds the 28 Aug reminder and the 10:00 UTC 29 Aug status update (t.me/RadixDevelopers/66061 and /66075, both authored by Daffy per the t.me embed), records that the reset-day plan to clean out the old validators with a new set of keys departs from the 18 Aug promise that the same four validators return on their existing keys, and reads both Gateways first-hand at 11:06 UTC: Stokenet HTTP 521, mainnet 200 at epoch 339,198.', now]);
    await client.query('COMMIT');
    console.log('  committed');
  }
} finally {
  client.release();
  await pool.end();
}
