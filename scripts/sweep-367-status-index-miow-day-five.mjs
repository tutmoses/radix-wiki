// Run 367, ecosystem rotation.
// /contents/resources/radix-ecosystem-operational-status  v1.9.0 -> v1.10.0
//
// Three changes, all measured this run:
//
// 1. Miow moves Operational -> Dormant (Infrastructure in both), counts 62/43 ->
//    61/44. Its own page moved the same way in this run: miow.me answers HTTP 404
//    with x-vercel-error DEPLOYMENT_NOT_FOUND at every path, read twice on
//    4 September twenty hours apart. See sweep-367-miow-deployment-gone.mjs.
//
// 2. The twenty-first consecutive identical halt reading, 23:03:46 UTC on
//    4 September: state version 557,840,622, epoch 339,896, round 102, proposer
//    round timestamp 21:19:06.179 UTC. 97h44m without a committed round.
//    /state/validators/list HTTP 500, current_sync_delay_seconds 351,880
//    against the 720 the Gateway tolerates.
//
// 3. The front-end census re-run at 97h, against the run-351 reading at 30h.
//    Unchanged in every row but one: eleven static shells still 200, the two
//    state-backed pages still fail, app.caviarnine.com still refuses. The one
//    move is stats.defiplaza.net, which now answers HTTP 500 after 20s where it
//    used to time out - a different failure of the same page, not a recovery.
//
//   node scripts/sweep-367-status-index-miow-day-five.mjs --dry-run
//   node scripts/sweep-367-status-index-miow-day-five.mjs
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/resources';
const SLUG = 'radix-ecosystem-operational-status';
const SENTINEL = '351,880';
const DRY = process.argv.includes('--dry-run');

const MIOW_LI = '<li><a href="/ecosystem/miow" rel="noopener">Miow</a></li>';
const MIOW_LI_DORMANT = '<li><a href="/ecosystem/miow" rel="noopener">Miow</a> <em>&mdash; platform offline; <code>miow.me</code> returned <code>DEPLOYMENT_NOT_FOUND</code> at every path on 2026-09-04</em></li>';

const DORMANT_INFRA = `<h3>Infrastructure</h3>
<ul>
<li><a href="/ecosystem/emberflow" rel="noopener">Emberflow</a></li>
<li><a href="/ecosystem/hermes-protocol" rel="noopener">Hermes Protocol</a></li>
<li><a href="/ecosystem/infinite-labs" rel="noopener">Infinite Labs</a></li>
</ul>`;
const DORMANT_INFRA_NEW = `<h3>Infrastructure</h3>
<ul>
<li><a href="/ecosystem/emberflow" rel="noopener">Emberflow</a></li>
<li><a href="/ecosystem/hermes-protocol" rel="noopener">Hermes Protocol</a></li>
<li><a href="/ecosystem/infinite-labs" rel="noopener">Infinite Labs</a></li>
${MIOW_LI_DORMANT}
</ul>`;

const DAY_FIVE = `<p><strong>Day five, and the ledger has still not moved.</strong> Read at <strong>23:03:46&nbsp;UTC on 4 September</strong>, the Gateway returns the same last committed ledger for a twenty-first consecutive check &mdash; state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179&nbsp;UTC &mdash; ninety-seven hours and forty-four minutes without a committed round, and <code>/state/validators/list</code> answers HTTP 500 at a sync delay of <strong>351,880 seconds</strong> against the 720 the Gateway tolerates. The <a href="https://t.me/RadixAccountabilityCouncil/971" target="_blank" rel="noopener">11:02&nbsp;UTC update</a> above is still the council's latest word twelve hours later, and the developer channels have added nothing to it: the traffic there since has been about red-teaming and bug bounties rather than the restart.</p>
<p><strong>The front-end census, re-run at ninety-seven hours.</strong> The same probe run at thirty hours on 2 September is unchanged in almost every row. Eleven static shells still answer 200 through their own redirects &mdash; Ociswap, Astrolescent, <code>app.weft.finance/market</code>, Surge, DeFiPlaza, <code>dex.reddicks.meme</code>, RadQuest, RadixScan, RadixPlanet and the Radix Wallet site. The pages that have to resolve current state still do not: Astrolescent's per-token page returns HTTP 500, and <code>app.caviarnine.com</code> still refuses the connection, which is <a href="/ecosystem/caviarnine" rel="noopener">CaviarNine's own wind-down</a> rather than the halt. The single change in four days is a failure changing shape rather than clearing: <code>stats.defiplaza.net</code> now returns HTTP 500 after twenty seconds where it previously timed out. A front end that keeps serving while nothing underneath it can settle is exactly the reading this page warns against treating as liveness.</p>`;

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

  const ops = [];
  const need = (cond, label) => { if (!cond) throw new Error(`missing: ${label}`); ops.push(label); };

  // 1. infobox counts + network-status line
  const ib = blocks.find((b) => b.type === 'infobox');
  const ibb = ib?.blocks?.[0];
  if (!ibb || typeof ibb.text !== 'string') throw new Error('infobox block not found');
  let t = ibb.text;
  need(t.includes('<td><strong>Operational</strong></td><td>62</td>'), 'infobox Operational 62 -> 61');
  t = t.replace('<td><strong>Operational</strong></td><td>62</td>', '<td><strong>Operational</strong></td><td>61</td>');
  need(t.includes('<td><strong>Dormant</strong></td><td>43</td>'), 'infobox Dormant 43 -> 44');
  t = t.replace('<td><strong>Dormant</strong></td><td>43</td>', '<td><strong>Dormant</strong></td><td>44</td>');
  need(t.includes('no restart date announced as of 11:02 UTC, 4 September'), 'infobox network-status timestamp');
  t = t.replace('no restart date announced as of 11:02 UTC, 4 September',
    'no restart date announced as of 23:03 UTC, 4 September');
  ibb.text = t;

  // 2. halt section gets the day-five reading, appended before its closing note
  const haltIdx = blocks.findIndex((b) => /<h2 id="network-halt">/.test(b.text || ''));
  need(haltIdx >= 0, 'halt section');
  const anchor = '<p><strong>The statuses below have deliberately not been changed for it.</strong>';
  need(blocks[haltIdx].text.includes(anchor), 'halt section anchor paragraph');
  blocks[haltIdx].text = blocks[haltIdx].text.replace(anchor, DAY_FIVE + anchor);

  // 3. Miow: Operational -> Dormant
  const opIdx = blocks.findIndex((b) => /<h2[^>]*>\s*Operational \(62\)/.test(b.text || ''));
  need(opIdx >= 0, 'Operational (62) heading');
  need(blocks[opIdx].text.includes(MIOW_LI), 'Miow row in Operational');
  blocks[opIdx].text = blocks[opIdx].text
    .replace('<h2>Operational (62)</h2>', '<h2>Operational (61)</h2>')
    .replace(MIOW_LI + '\n', '')
    .replace(MIOW_LI, '');

  const dorIdx = blocks.findIndex((b) => /<h2[^>]*>\s*Dormant \(43\)/.test(b.text || ''));
  need(dorIdx >= 0, 'Dormant (43) heading');
  need(blocks[dorIdx].text.includes(DORMANT_INFRA), 'Dormant Infrastructure list');
  blocks[dorIdx].text = blocks[dorIdx].text
    .replace('<h2>Dormant (43)</h2>', '<h2>Dormant (44)</h2>')
    .replace(DORMANT_INFRA, DORMANT_INFRA_NEW);

  if (blocks[opIdx].text.includes('/ecosystem/miow')) throw new Error('Miow still listed under Operational');

  const version = '1.10.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  for (const o of ops) console.log('   -', o);
  console.log('   - Miow moved Operational -> Dormant, counts 62/43 -> 61/44');
  console.log('   - day-five halt reading + 97h front-end census inserted');
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
       'Day five of the halt: twenty-first identical Gateway reading at 23:03:46 UTC 4 September, 97h44m without a committed round, sync delay 351,880s. Re-runs the front-end census at 97h against the 30h reading - unchanged but for stats.defiplaza.net, which now 500s after 20s where it timed out. Moves Miow from Operational to Dormant (61/44) after miow.me returned DEPLOYMENT_NOT_FOUND at every path on two reads twenty hours apart.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
