// Sweep 405 — /ecosystem/stakesafe
// The adoption tracker's own explorer table, read per validator: where the stake that
// has not reached Eagle Ray actually sits, and the caveat the version column carries.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'stakesafe';
const SENTINEL = 'sweep405-where-the-gap-sits';
const DRY = process.argv.includes('--dry-run');

const HTML = `<h2 id="${SENTINEL}">Where the gap sits (11 September 2026)</h2>
<p>Read from the dashboard at <strong>07:12&nbsp;UTC on 11 September 2026</strong>, eight hours after the reading above, both panel figures had risen: <strong>1,455,804,324&nbsp;XRD</strong> is running v1.4.0.0, <strong>31.22%</strong> of the active set, against 1,260,200,690 and 27.03% the previous evening; stake with a node online rose further over the same hours, from 1,519,267,322 and 32.58% to <strong>1,746,449,780</strong> and <strong>37.45%</strong>. The two lines are separating rather than converging, because operators are coming back online faster than they are coming back upgraded: the stake that is online but not on Eagle Ray widened from 5.6 points of the active set to 6.2.</p>
<p>The explorer table below the panel says where the rest of it sits. Thirty-nine rows read v1.4.0.0 and their delegated stake sums to 1,455,804,327&nbsp;XRD, reproducing the panel's adoption figure; thirty-eight of those thirty-nine have a node online. None of the twelve largest validators is among them. Ranked by delegated stake those twelve are <a href="/ecosystem/srwa" rel="noopener">SRWA</a>, <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a>, <a href="/ecosystem/reddicks" rel="noopener">Reddicks</a>, <a href="/ecosystem/weft-finance" rel="noopener">Weft</a>, Jazzer9F, Ocinode, <a href="/ecosystem/defiplaza" rel="noopener">DeFiPlaza</a>'s investment node, <a href="/ecosystem/radical-staking" rel="noopener">Radical Staking</a>, <a href="/ecosystem/avaunt-staking" rel="noopener">Avaunt Staking</a>, both <a href="/ecosystem/caviarnine" rel="noopener">CaviarNine</a> validators and RadixStake; every one reads a v1.3 version and every one reads offline. Together they hold 2,073,397,316&nbsp;XRD. The shortfall between current adoption and the 3,124,224,299&nbsp;XRD that more than 67% of the active set comes to is 1,668,419,975&nbsp;XRD, so those twelve operators hold between them more than enough to end the halt, and the largest validator that has reached Eagle Ray, <a href="/ecosystem/xseed" rel="noopener">XSEED Staking</a> at 98,684,205&nbsp;XRD, ranks thirteenth.</p>
<p>One caveat on the version column, because it changes what the table proves. The explorer reports the version a node last advertised, so an offline validator shows the version it was running when it stopped. A v1.3 reading against an offline node means the explorer has not seen that node on Eagle Ray, not that its operator has not installed the release; the <a href="https://t.me/RadixAccountabilityCouncil/1019" target="_blank" rel="noopener">council's instruction</a> is to install it and leave the node online, and only the second half of that is visible here. What the table establishes is where the stake is, and that the threshold cannot be reached by the operators already running.</p>
<p>What happens once it is reached is fixed in the node software rather than announced: the fork enacts at the start of epoch 339,898 without a readiness vote, after an epoch in which rounds are produced but user transactions are refused. The sequence, and the reading of the halt that goes with it, are on <a href="/contents/resources/radix-ecosystem-operational-status#halt-restart-sequence" rel="noopener">Radix Ecosystem Operational Status</a>.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  if (/\u00A0/.test(HTML)) throw new Error('literal U+00A0 in script string');

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const i = blocks.findIndex((b) => b.text?.includes('sweep403-eagle-ray-adoption'));
  if (i < 0) throw new Error('tracker block not found');
  blocks.splice(i + 1, 0, { id: uid(), type: 'content', text: HTML });

  const version = '2.5.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  inserted block at index ${i + 1}, ${HTML.length} chars; blocks ${page.content.length} -> ${blocks.length}`);

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
       'Add the per-validator reading of the Eagle-Ray tracker at 07:12 UTC on 11 September: the twelve largest validators all read a v1.3 version and all read offline, and hold more than the shortfall to the 67% threshold between them. Includes the caveat the version column carries for an offline node.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
