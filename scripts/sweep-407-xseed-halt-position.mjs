// Sweep 407 — /ecosystem/xseed
// The halt gives this page a reading it could not otherwise have: XSEED is the largest
// validator running Eagle Ray, and while the ledger is frozen the explorer is the only
// live source for a validator's state, which is the inverse of this page's own rule.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'xseed';
const SENTINEL = 'sweep407-xseed-halt-position';
const DRY = process.argv.includes('--dry-run');

const HTML = `<h2 id="${SENTINEL}">The halt, and the node's position in it</h2>
<p>Radix mainnet has produced no rounds since <strong>21:19:06&nbsp;UTC on 31 August 2026</strong>, when validators holding more than two thirds of stake <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">broke liveness deliberately</a>, and it resumes only once more than 67% of active-set stake is online and running <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0" target="_blank" rel="noopener">babylon-node v1.4.0.0, &ldquo;Eagle Ray&rdquo;</a>. Read from <a href="/ecosystem/stakesafe" rel="noopener">StakeSafe</a>'s <a href="https://validators.stakesafe.net" target="_blank" rel="noopener">Radix Network Dashboard</a> at <strong>11:05&nbsp;UTC on 11 September 2026</strong>, XSEED STAKING reads <strong>v1.4.0.0</strong> and reads online, at a 9.80% fee and 100.00% recent uptime. Of the forty-one validators carrying Eagle Ray at that reading it is the largest, and because the twelve validators above it all read offline it is also the highest-ranked node on the dashboard that is both upgraded and up.</p>
<p>That position is a consequence of how the restart is being run rather than a distinction the operator claimed. The twelve larger validators are <a href="/ecosystem/stakesafe#sweep407-offline-by-design" rel="noopener">upgraded and deliberately offline</a>, waiting to boot together once enough of the tail is back, so XSEED heads the upgraded-and-online list by being in the part of the set that is coming back first.</p>
<p>Its stake reads <strong>98,684,205&nbsp;XRD</strong>, rank 13 of the hundred validators in the active set, which is 1.55 million XRD below the 100,236,442.14&nbsp;XRD this page read from the ledger on 6 August; that movement happened before the stop, because no stake has moved since. The figures above cannot be confirmed the way the rest of this page was, and the reason is worth stating: with the network halted the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway</a> refuses state queries outright, answering HTTP 500 at a sync delay of more than ten days, so there is no consensus manager to ask. This page's own rule, that a validator's operational state is evidenced by the ledger and not by a website, has a corollary it did not need until now: while the ledger is stopped, the only live evidence is a third party probing the nodes directly.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const NBSP = /\u00A0/;
  if (NBSP.test(HTML)) throw new Error('literal U+00A0 in script string');

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied, no write');
    process.exit(0);
  }

  const i = blocks.findIndex((b) => b.text?.includes('<h2>Status</h2>'));
  if (i < 0) throw new Error('Status block not found');
  blocks.splice(i + 1, 0, { id: uid(), type: 'content', text: HTML });

  const version = '4.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  inserted ${HTML.length} chars at index ${i + 1}; blocks ${page.content.length} -> ${blocks.length}`);

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
       'Record the node position during the network halt: XSEED reads v1.4.0.0 and online at 11:05 UTC on 11 September, the largest of the forty-one validators carrying Eagle Ray, and the highest-ranked node that is both upgraded and up because the twelve above it are deliberately offline. Notes that the ledger cannot be queried while the network is halted, which is the corollary to this page own evidence rule.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
