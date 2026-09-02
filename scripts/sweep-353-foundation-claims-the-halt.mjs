import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'day-three-foundation';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2 id="${SENTINEL}">Day three, morning: the Foundation speaks, and claims the halt</h2><p>Re-read at <strong>11:06:14 UTC on 2 September 2026</strong>, the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> returns the same ledger for the eighth consecutive reading &mdash; state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179 UTC &mdash; <strong>thirty-seven hours and forty-seven minutes</strong> without a committed round. The read endpoints put the same gap in their own words: <code>/state/entity/details</code> answers HTTP 500 with <code>current_sync_delay_seconds</code> 136,028 against a <code>max_allowed_sync_delay_seconds</code> of 720, &ldquo;it is currently 1 day, 13 hours, 47 minutes, 8 seconds behind&rdquo;.</p><p>Eight minutes past nine, thirty-five hours into the stop, the Foundation said something for the first time since two minutes before the last round. The statement went out on the <a href="https://t.me/RadixAnnouncements/2778" target="_blank" rel="noopener">Radix DLT Official Announcements channel at 08:58:02 UTC</a> and was forwarded straight into the main chat. It is six sentences. The root issue &ldquo;has been identified, and work is underway to implement, test and deploy the fixes as quickly and safely as possible&rdquo;. The Foundation &ldquo;has contacted security partners, bridges, exchanges and relevant authorities to assist&rdquo;. Foundation assets held in custody &ldquo;remain safe&rdquo;. There is &ldquo;currently no confirmed timeline for restoration&rdquo;. And for anything further, readers are pointed away from the Foundation's own channels: &ldquo;For verified updates, follow @RadixAccountabilityCouncil&rdquo;.</p><h3>Who halted the network</h3><p>The first sentence is the one worth reading twice. &ldquo;Following the recent exploit, the Radix Foundation and RAC have halted the Radix network as a precautionary measure, temporarily making transactions and Radix Wallet activity unavailable.&rdquo; That is an account of the halt as a thing two named bodies did, and it is not the account the network's own operators gave. As <a href="#standing-decision">the previous evening's section</a> records, the stop is not an action taken on the network but a quorum the network lost when enough independent node runners each shut down their own machine, and some declined and left theirs running. Neither the Foundation nor the council has a switch of this kind; what they had was a plan that enough operators, one at a time, agreed to.</p><p>The contradiction was already on the record in the same channel three hours earlier. At <a href="https://t.me/radix_dlt/1001292" target="_blank" rel="noopener">06:04 UTC</a>, answering people asking him privately whether Radix was finished, Timan of <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a> and <a href="/ecosystem/defiplaza" rel="noopener">DefiPlaza</a> wrote that the exploit was serious and the halt severe, &ldquo;but the node runners made that decision to protect the network. That was not a centralized decision. (Also didnt come from me btw).&rdquo; Three hours later the Foundation's own announcement claimed it. Both cannot be describing the same event, and only one of them is checkable against the ledger, which shows a network that stopped producing rounds when its validating stake fell below the threshold the <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">consensus protocol</a> requires.</p><p>The distinction is not a quibble about credit. It decides who a holder should be watching for the restart. A network halted by two bodies resumes when those bodies decide it should; a network that lost quorum resumes when enough <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">validator</a> operators individually judge the patched software safe to run. The second is what the ledger describes, and it is why no announcement can carry a restart date.</p><h3>No timeline, and the gap that fills it</h3><p>&ldquo;No confirmed timeline for restoration&rdquo; is the Foundation's first public word on when the network comes back, and the vacuum around it is being filled by people with no more information. Just over an hour before the announcement, at <a href="https://t.me/radix_dlt/1001306" target="_blank" rel="noopener">07:46 UTC</a>, avaunt of <a href="/ecosystem/atomix" rel="noopener">Atomix</a> answered a holder asking what to do with &ldquo;it will take a few more days at least to restart the network&rdquo;; Timan's message two hours earlier had said the same, &ldquo;hopefully a few days&rdquo;, with the qualifier that it is &ldquo;better to get it right the first time than rush this&rdquo;. Neither is an estimate anyone is in a position to make, and the announcement declined to make one.</p><p>The channel the Foundation designated as the source of verified updates has not used it. The council's <a href="https://t.me/RadixAccountabilityCouncil/936" target="_blank" rel="noopener">four-step account of the fix</a> at 12:16 UTC on 1 September, which closed by promising the next update &ldquo;around the same time tomorrow&rdquo;, is still its most recent word twenty-two hours and fifty minutes later. Nor has anything appeared where a fix would land: <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>'s newest release is still <code>v1.3.0.5</code> of 1 June 2026, the default branch of <a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a> still ends at <code>858c70f1</code> of 27 March 2026, <a href="https://radixdao.org/notices.json" target="_blank" rel="noopener">the DAO's notice feed</a> still ends on 29 August, and <a href="https://www.radixdlt.com/blog" target="_blank" rel="noopener">the Foundation's blog</a> carries no post about the incident. Thirty-eight hours in, the whole public record of the repair is four Telegram messages.</p>`;

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
    console.log('  already applied — no write');
    process.exit(0);
  }

  const anchor = blocks.findIndex((b) => (b.text || '').includes('day-three-instruments'));
  if (anchor < 0) throw new Error('anchor section "day-three-instruments" not found');
  blocks.splice(anchor + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '2.7.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  inserting after block ${anchor}; ${page.content.length} -> ${blocks.length} blocks`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Day three, morning: the Foundation’s first statement of the halt (RadixAnnouncements/2778, 08:58:02 UTC 2 Sep) attributes the stop to itself and the RAC, which is at odds with the quorum-loss mechanism the operators described and with Timan of Astrolescent in the same channel three hours earlier. Records the no-timeline line, the community estimates filling it, and the eighth identical Gateway reading at 37h47m.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
