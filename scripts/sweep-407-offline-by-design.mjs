// Sweep 407 — /ecosystem/stakesafe
// The twelve largest validators have not moved in four hours, and the reason was published
// the same morning: they are upgraded and deliberately offline, waiting to boot together.
// Also names the one class the explanation does not cover: online nodes still on v1.3.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'stakesafe';
const SENTINEL = 'sweep407-offline-by-design';
const DRY = process.argv.includes('--dry-run');

const OLD_TAIL = 'What the table establishes is where the stake is, and that the threshold cannot be reached by the operators already running.';
const NEW_TAIL = 'What the table establishes is where the stake is, and that the threshold cannot be reached by the operators already running. What it does not establish is why those twelve are down, and the answer was published the same morning: <a href="#' + SENTINEL + '" rel="noopener">it is deliberate</a>.';

const HTML = `<h2 id="${SENTINEL}">Offline by design (11 September 2026)</h2>
<p>Read from the dashboard at <strong>11:05&nbsp;UTC on 11 September 2026</strong>, three hours and fifty-three minutes after the reading above, <strong>1,528,203,682&nbsp;XRD</strong> is running v1.4.0.0, <strong>32.77%</strong> of the active set, and 1,848,850,528&nbsp;XRD, <strong>39.65%</strong>, has a node online. Adoption rose by 72,399,358&nbsp;XRD and 1.55 points over those four hours and none of it came from the top of the table: the same twelve rows, in the same order, still read a v1.3 version, still read offline, and still hold 2,073,397,318&nbsp;XRD between them. Forty-one rows now read v1.4.0.0 against thirty-nine at 07:12, and the shortfall to the 3,124,224,298&nbsp;XRD that more than 67% of the active set comes to has narrowed to 1,596,020,616&nbsp;XRD. The whole of the movement is in the tail.</p>
<p>The reason the twelve have not moved was stated in the main Radix Telegram group two hours before that reading, and it inverts what the table appears to show. Asked why the ten largest validators could not spare ten minutes to update, <a href="https://t.me/radix_dlt/1003000" target="_blank" rel="noopener">Faraz replied at 10:11:24&nbsp;UTC</a> that the state is intentional: <q>The largest nodes are upgraded and waiting to boot up together once we have a decent amount of stake online from the remaining nodes.</q> The aim is to be well clear of 67% rather than barely over it, because crossing the threshold marginally risks a node developing a problem and falling over, <q>triggering another liveness break</q>, and a handful of large nodes is easier to coordinate than a long tail of small ones. <a href="https://t.me/radix_dlt/1002990" target="_blank" rel="noopener">Daffy had answered the same complaint</a> sixteen minutes earlier in fewer words: the update is planned this way, and any conclusion about a validator still on v1.3 should wait until a week after the network is live. Both messages are authorship-verified at their public embeds (<a href="https://t.me/radix_dlt/1003000?embed=1&amp;mode=tme" target="_blank" rel="noopener">Faraz</a>, <a href="https://t.me/radix_dlt/1002990?embed=1&amp;mode=tme" target="_blank" rel="noopener">Daffy</a>).</p>
<p>Two things follow for anyone watching the chart. The caveat recorded here at 07:12&nbsp;UTC was the operative one rather than a hedge: a v1.3 reading against an offline node says only that the explorer has not seen that node on Eagle Ray, and for the twelve largest it is now sourced that the release is installed. And the restart will arrive as a step rather than a climb. The stake that closes the gap is held by nodes that are down on purpose, so adoption can sit well short of 67% until the moment it clears, and the chart measures the tail's progress rather than counting down to a restart.</p>
<p>One class of row is not covered by that explanation, and it is the class the version column reads without ambiguity, because the staleness the caveat describes applies only where the node is down. <strong>Eighteen validators read online and read a v1.3 version</strong>, holding <strong>327,184,952&nbsp;XRD</strong>, 7.02% of the active set: nodes that are up and advertising a build the threshold does not count. The two largest are Cadwynbloc at 64,436,221&nbsp;XRD and <a href="/ecosystem/supreme-stake" rel="noopener">Supreme Stake</a> at 51,025,921&nbsp;XRD, and the set also holds the Community Council Node, <a href="/ecosystem/hug" rel="noopener">HUG</a>, <a href="/ecosystem/blockshard" rel="noopener">Blockshard</a>, <a href="/ecosystem/allnodes" rel="noopener">Allnodes</a> and <a href="/ecosystem/dexter" rel="noopener">DeXter</a>. These are the operators the <a href="https://t.me/RadixAccountabilityCouncil/1019" target="_blank" rel="noopener">council's instruction</a> is aimed at, and they are also why the two panels cannot be read as one: the 6.88-point spread between online stake and Eagle-Ray stake is this class, less the single mirror row, Atlas-Staking.com, which reads v1.4.0.0 and offline at 6,538,106&nbsp;XRD.</p>
<p>The ledger is unchanged by any of it. Read at <strong>11:05:08&nbsp;UTC on 11 September</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> returns state version 557,840,622 at epoch 339,896, round 102: two hundred and fifty-three hours and forty-six minutes without a committed round, and the same interval the Gateway reports itself behind the ledger.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const NBSP = /\u00A0/;
  if (NBSP.test(HTML) || NBSP.test(OLD_TAIL) || NBSP.test(NEW_TAIL)) {
    throw new Error('literal U+00A0 in script string');
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

  const i = blocks.findIndex((b) => b.text?.includes('sweep405-where-the-gap-sits'));
  if (i < 0) throw new Error('run-405 gap block not found');
  if (!blocks[i].text.includes(OLD_TAIL)) throw new Error('caveat tail not found verbatim');
  blocks[i].text = blocks[i].text.replace(OLD_TAIL, NEW_TAIL);
  blocks.splice(i + 1, 0, { id: uid(), type: 'content', text: HTML });

  const version = '2.6.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  amended caveat tail in block ${i}; inserted ${HTML.length} chars at ${i + 1}; blocks ${page.content.length} -> ${blocks.length}`);

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
       'Add the 11:05 UTC reading and the reason the twelve largest validators have not moved: Faraz and Daffy both state in the main Radix group that those nodes are upgraded and deliberately offline, waiting to boot together well clear of 67%. Names the one class the explanation does not cover, eighteen validators online on a v1.3 build holding 327,184,952 XRD, and points the run-405 caveat at the answer.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
