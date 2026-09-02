// Run 348, the contents/resources rotation edit. The ecosystem status index was last
// rebuilt on 23 August and still reads as though the question it answers is only about
// each project's own posture. Since 21:19 UTC on 31 August the ledger under all 147 of
// them has been stopped, and the two on-ledger checks this page leans on cannot be run
// at all. The notice states that without re-bucketing a single project: the halt is one
// network-level fact and would otherwise overwrite 147 project-level judgements.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/resources';
const SLUG = 'radix-ecosystem-operational-status';
const SENTINEL = 'id="network-halt"';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2 id="network-halt">The network halt of 31 August 2026</h2>` +
  `<p>Radix mainnet stopped producing rounds at <strong>21:19:06 UTC on 31 August 2026</strong> and has not restarted. Validators holding more than two thirds of stake broke liveness deliberately, hours after <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">every Hyperlane-bridged asset on the network was drained</a> through a flaw in the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a>. Read at <strong>15:04 UTC on 1 September</strong>, the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> still returns the last committed ledger &mdash; state version 557,840,622, epoch 339,896, round 102 &mdash; and a read of <code>/state/entity/details</code> answers HTTP 500 with the sentence &ldquo;it is currently 17 hours, 45 minutes, 36 seconds behind&rdquo;.</p>` +
  `<p><strong>The statuses below have deliberately not been changed for it.</strong> What each one records is whether a project is still being operated by the people behind it &mdash; which is the question this index exists to answer, and the question a migration conversation turns on. Whether a project can settle a transaction today is a different question with the same answer for all 147 of them: no, because the ledger has stopped. Re-bucketing the directory would replace 147 project-level judgements with one network-level fact and lose the first without adding the second.</p>` +
  `<p>Two of the three checks described above are unavailable while the halt lasts. Validator registration and on-ledger token supply are both read through the Gateway, and the Gateway refuses to serve state it believes is more than twelve minutes stale, so <code>/state/validators/list</code> and <code>/state/entity/details</code> answer <code>NotSyncedUpError</code> rather than an old figure. Those checks resume when the network does. The website probe still runs and still proves exactly as little as it did before &mdash; more so now, because a static front end keeps answering 200 with no ledger underneath it: on 1 September the Ociswap, Astrolescent, Weft, RSwap, Surge, RadQuest and Radix Dashboard front ends all served normally while every page among them that had to resolve current state returned an error.</p>`;

const INFO_OLD = `<tr><td><strong>Last rebuilt</strong></td>`;
const INFO_NEW = `<tr><td><strong>Network status</strong></td><td>Mainnet halted since 21:19 UTC, 31 August 2026 &mdash; see the notice below</td></tr>\n<tr><td><strong>Last rebuilt</strong></td>`;

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

  const at = blocks.findIndex((b) => (b.text || '').includes('this index answers the first one'));
  if (at < 0) throw new Error('intro block not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const row = blocks[0]?.blocks?.[0];
  if (!row || !row.text.includes(INFO_OLD)) throw new Error('infobox last-rebuilt row not matched');
  row.text = row.text.replace(INFO_OLD, INFO_NEW);

  const version = '1.7.0';
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
       'The network halt of 31 August: a dated notice stating what the halt does and does not change about this index, why no project has been re-bucketed for it, and which two of the page\'s three liveness checks cannot run while the Gateway refuses stale reads. Infobox gains a network-status row.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
