// Run 348. The halt's second afternoon. The RAC published the SHAPE of the repair —
// four named steps — and two of those steps leave a signature on a ledger this routine
// can read, so the section pairs the statement with the measurement of how far it has
// got: no protocol update signalled on Stokenet, and the announced maintenance window
// not yet opened. Everything is read at its source and timestamped.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'id="shape-of-the-fix"';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2 id="shape-of-the-fix">Day two, afternoon: the shape of the fix</h2>` +
  `<p>Re-read at <strong>15:04 UTC on 1 September 2026</strong>, the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> returns the same ledger for the fourth consecutive reading, and the read endpoints put a number on it without any epoch arithmetic: a request to <code>/state/entity/details</code> answers HTTP 500 with <code>current_sync_delay_seconds</code> 63,936 and the sentence &ldquo;it is currently 17 hours, 45 minutes, 36 seconds behind&rdquo;.</p>` +
  `<p>At <strong>12:16 UTC</strong> the <a href="https://t.me/RadixAccountabilityCouncil/936" target="_blank" rel="noopener">Radix Accountability Council</a> published the first description of what the repair actually consists of, posted by projectShift as the morning update was. It names four steps in order: code fixes to the Radix Engine; updates to the node software together with a protocol upgrade; a coordinated deployment of those across nodes; and a coordinated return to liveness. It says the work involves people who were previously with the Foundation or are still with it, alongside volunteer developers and engineers from the ecosystem, and that it is &ldquo;not just coding a fix&rdquo; but review, testing, deployment and recovery. There is still &ldquo;no timetable for when a solution will be available&rdquo;; the council said to expect the next regular update around the same time the following day.</p>` +
  `<p>That list matters to a reader outside the repair because its middle two steps are not private. A protocol upgrade on Radix is adopted by validators signalling readiness for a named version in an ordinary transaction, which is how the three updates the rebuilt <a href="https://docs.radixdlt.com/docs/network-gateway" target="_blank" rel="noopener">Stokenet</a> ledger had to retake in August are readable on it today. Read at 15:05 UTC, the Stokenet transaction stream against its validator set carries no readiness signalling later than the Cuttlefish signal of <strong>29 August</strong>: no new protocol version has been proposed on the test network. Stokenet itself is still producing rounds — epoch 1,175, round 124, state version 3,512,563, proposer round timestamp 15:05:29.054 UTC, continuous from the 3,322,913 read four hours earlier — so the planned maintenance Daffy announced at 10:32 had not begun, and a developer was still <a href="https://t.me/RadixDevelopers/66235" target="_blank" rel="noopener">deploying a component to it at 14:47</a>. Eighteen hours after the halt, the fix has not reached a network.</p>` +
  `<p>Nothing else has moved either. <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>'s newest release is <code>v1.3.0.5</code> of 1 June 2026, the default branch of <a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a> last moved on 27 March 2026, <a href="https://www.radixdlt.com/blog" target="_blank" rel="noopener">the Foundation's blog</a> carries no post about the incident, and <a href="https://radixdao.org/notices.json" target="_blank" rel="noopener">the DAO's notice feed</a> still ends on 29 August. The markets, meanwhile, spent the day repricing what they could not move: <a href="https://api.gateio.ws/api/v4/spot/tickers?currency_pair=XRD_USDT" target="_blank" rel="noopener">Gate.io's XRD/USDT book</a> read 0.000658 USDT at 15:06 UTC, down <strong>20.2%</strong> over twenty-four hours on 114,272,110 XRD of volume, and <a href="https://api.mexc.com/api/v3/ticker/24hr?symbol=XRDUSDT" target="_blank" rel="noopener">MEXC's</a> read 0.0006521, down 20.8% on 248,959,959 XRD — roughly 162,000 US dollars of turnover in a token that cannot currently leave an exchange.</p>`;

const STATUS_OLD = `Still halted when re-read at 11:04 UTC, 1 September, thirteen hours and forty-five minutes after the last round`;
const STATUS_NEW = `Still halted when re-read at 15:04 UTC, 1 September, seventeen hours and forty-five minutes after the last round`;

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

  const at = blocks.findIndex((b) => (b.text || '').includes('id="day-two"'));
  if (at < 0) throw new Error('anchor section not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const info = blocks[0];
  const row = info?.blocks?.[0];
  if (!row || !row.text.includes(STATUS_OLD)) throw new Error('infobox network-status row not matched');
  row.text = row.text.replace(STATUS_OLD, STATUS_NEW);

  const version = '2.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}, section at ${at + 1}`);
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
       "Day two, afternoon: the RAC's 12:16 UTC update names the four steps of the repair, and two of them are measurable — no protocol readiness signalling on Stokenet since 29 August and the announced maintenance window not yet opened, so the fix has not reached a network eighteen hours in. Gateway re-read at 15:04 UTC, self-reporting 17h45m behind. Infobox network-status re-dated.", now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
