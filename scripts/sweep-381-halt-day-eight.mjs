import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID } from './seed-utils.mjs';
import { isLockedPage } from '../src/lib/tags.ts';
config();

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'day-eight-the-restart-gets-a-forecast';
const DRY = process.argv.includes('--dry-run');

const HTML = `<h2 id="${SENTINEL}">Day eight: the restart gets its first forecast, and it does not come from the Foundation</h2>
<p>Read at <strong>07:04:0x&nbsp;UTC on 7 September 2026</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a> returns the same ledger for a thirty-fourth consecutive reading: state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179&nbsp;UTC. That is <strong>one hundred and fifty-three hours and forty-five minutes</strong> without a committed round. <code>/state/validators/list</code> still answers HTTP 500 and still counts the gap itself, <q>it is currently 6 days, 9 hours, 50 minutes, 7 seconds behind</q>, with <code>current_sync_delay_seconds</code> 553,807 against a <code>max_allowed_sync_delay_seconds</code> of 720.</p>
<h3 id="a-forecast-from-a-dapp-founder">A forecast, from a dApp founder</h3>
<p>At <strong>06:32:47&nbsp;UTC</strong> the first estimate of any kind about the restart was posted to <a href="https://t.me/radix_dlt/1002313" target="_blank" rel="noopener">the main Radix Telegram group</a>, and it came from Timan Rebel, founder of <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a>: a great deal of patching work was done over the weekend, the network is <q>getting closer to a restart</q>, and more testing is needed before it happens. He was explicit that he was not among those doing the work and was posting because nobody else had.</p>
<p>That is the eighth day of this incident and the first forward-looking statement about it, and the notable thing is where it did not come from. <a href="https://t.me/RadixAnnouncements/2778" target="_blank" rel="noopener">The Radix Foundation&rsquo;s announcement channel</a> has published nothing since the <q>IMPORTANT NETWORK UPDATE</q> of <strong>08:58&nbsp;UTC on 2 September</strong>, five days earlier, which is <a href="#day-three-foundation" rel="noopener">the post day three recorded</a>. Message 2778 is still the newest on the channel. An ecosystem project&rsquo;s founder, relaying second hand in a community chat, is currently the most recent public account of when Radix expects to produce a block again.</p>
<h3 id="the-weekend-left-no-public-trace">The weekend left no public trace</h3>
<p>The work described has no visible counterpart in either repository. <a href="https://github.com/radixdlt/radixdlt-scrypto/pull/2093" target="_blank" rel="noopener">Pull request #2093</a>, which carries <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a> and the receiver check, is still open and unmerged, and its branch still holds the same six commits ending at <code>722c3f32</code> of <strong>11:09:51&nbsp;UTC on 2 September</strong>. Nothing was pushed to it on 5, 6 or 7 September. <a href="https://github.com/radixdlt/babylon-node" target="_blank" rel="noopener">babylon-node</a>, the implementation every validator actually runs, is unchanged too: its release branch <code>main</code> still ends at <code>959b081e</code> of 1 June 2026 and its newest release is still <code>v1.3.0.5</code> of the same day.</p>
<p>The two readings are not in conflict. A patch to a live network can be written, reviewed and tested privately and land in public as a single push, and the Foundation has said nothing that promises otherwise. What it does mean is that the public record cannot yet corroborate the forecast: the only artefacts a reader can check are five days old, and the estimate rests entirely on the account of someone who says he did not do the work.</p>
<h3 id="the-rehearsal-has-not-started">The rehearsal has not started</h3>
<p>Stokenet, the public test network <a href="#the-upgrade-gets-a-rehearsal-ground" rel="noopener">day seven</a> identified as the rehearsal ground, is still running normally. Read at <strong>07:04:08&nbsp;UTC on 7 September</strong>, its Gateway returned state version 6,376,136, epoch 2,823 and round 227 with a proposer round timestamp of that same second, and <code>/state/validators/list</code> answered HTTP 200. The instability <a href="/community/daffy" rel="noopener">Daffy</a> told the developer group to expect <q>in the coming days in preparation for the protocol upgrade</q> has now been awaited for twenty-four hours without appearing. Stokenet breaking would be the first thing a reader outside the Foundation could check that the restart forecast is real.</p>`;

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
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const idx = blocks.findIndex((b) => (b.text || '').includes('day-seven-the-repository-moves'));
  if (idx < 0) throw new Error('day seven anchor not found');
  blocks.splice(idx + 1, 0, { id: uid(), type: 'content', text: HTML });

  const version = '2.15.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (insert at ${idx + 1} of ${blocks.length})`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Day eight: the first public forecast of a restart came at 06:32 UTC on 7 September from Astrolescent founder Timan Rebel in the main Telegram group, not from the Foundation, whose announcement channel has been silent since 2 September. Neither radixdlt-scrypto #2093 nor babylon-node took a commit over the weekend. Gateway reading 34 identical at 07:04 UTC; Stokenet still live at epoch 2,823 with the warned instability not yet visible.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
