// sweep-342-trilemma-cerberus-attribution.mjs
//
// /contents/tech/core-concepts/blockchain-trilemma still credits Cerberus with
// two things run 181 (2 Aug 2026) corrected everywhere else on the wiki:
//
//   "By braiding consensus across shards ... Cerberus achieves ..."
//   "The Hyperscale 500k TPS test validated this with 590+ nodes"
//
// Braiding has never run in production, and the 500k test measured the Radix
// Foundation's Hyperscale reference implementation, which the lead developer of
// the Xi'an candidate says "never really used Cerberus". The page's own
// /contents/tech/research/hyperscale-500k-tps target already says both things;
// this page contradicts it. Last touched 30 June 2026, never verified, so the
// run-181 pass missed it.
//
//   node scripts/sweep-342-trilemma-cerberus-attribution.mjs --dry-run
//   node scripts/sweep-342-trilemma-cerberus-attribution.mjs

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'blockchain-trilemma';
const VERSION = '2.4.0';
const BLOCK = '2955841c-6bcc-4be9-b2a9-b4a8c16077e7';
const SENTINEL = 'never really used Cerberus';

const CERB = '/contents/tech/core-protocols/cerberus-consensus-protocol';

const OLD_START = '<h3><a href="/contents/tech/core-protocols/cerberus-consensus-protocol">Cerberus</a>\'s Approach</h3>';

const REPLACEMENT = `<h3><a href="${CERB}">Cerberus</a>'s Approach, and what has actually been tested</h3>
<p>Radix's <a href="${CERB}">Cerberus consensus</a> argues the trilemma is a limitation of specific consensus designs rather than a fundamental law. The <a href="https://arxiv.org/pdf/2008.04450" target="_blank" rel="noopener">Cerberus whitepaper</a> proposes to get there by <strong>braiding</strong> consensus across shards, so that a transaction involves only the shards it touches, which would give:</p>
<ul>
  <li><strong>Scalability</strong> &ndash; throughput scaling with shard count rather than with per-node capacity</li>
  <li><strong>Security</strong> &ndash; full <a href="https://en.wikipedia.org/wiki/Byzantine_fault" target="_blank" rel="noopener" title="Byzantine Fault Tolerance">BFT</a> security per shard, with braiding supplying the cross-shard guarantee</li>
  <li><strong>Decentralization</strong> &ndash; commodity hardware nodes, with capacity added by adding nodes</li>
</ul>
<p><strong>That is a design, not a deployment.</strong> Braiding has never run in production: not on Radix <a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">Babylon</a>, which runs Cerberus unsharded and so has nothing to braid, and not in the Radix Foundation's Hyperscale reference implementation either. The trilemma claim above should therefore be read as the protocol's argument rather than as a demonstrated result.</p>
<p>The <a href="/contents/tech/research/hyperscale-500k-tps" rel="noopener">Hyperscale 500k TPS test</a> is frequently offered as that demonstration, and it is not one. It sustained over 500,000 TPS and peaked above 700,000 on <a href="https://www.radixdlt.com/blog/hyperscale-update-500k-public-test-done" target="_blank" rel="noopener">commodity AWS instances</a>, with more than 590 community nodes in the public phase, but what it measured was the Foundation's Hyperscale implementation, which the lead developer of the <a href="/contents/tech/research/hyperscale-rs" rel="noopener">Xi'an production candidate</a> states <a href="https://t.me/hyperscale_rs" target="_blank" rel="noopener">"never really used Cerberus"</a>. The figures are a property of the software that was tested, not evidence about the protocol specified in the whitepaper. A sharded network that answers the trilemma on Radix is still forthcoming work, and the current candidate is <a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a>, whose per-shard consensus is HotStuff-2 derived rather than Cerberus.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const b = blocks.find((x) => x.id === BLOCK);
  if (!b) throw new Error(`block ${BLOCK} not found`);
  const cut = b.text.indexOf(OLD_START);
  if (cut === -1) {
    console.error('  FIND-STRING MISS. Codepoints around the heading in stored HTML:');
    const probe = b.text.slice(b.text.indexOf("'s Approach") - 90, b.text.indexOf("'s Approach") + 12);
    console.error('  ', JSON.stringify(probe), [...probe].map((ch) => ch.charCodeAt(0)).join(','));
    throw new Error('heading not found — nothing written');
  }

  // Everything from the "Approach" heading to the end of the block is replaced.
  b.text = b.text.slice(0, cut) + REPLACEMENT;

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  console.log(`  replaced ${page.content.find((x) => x.id === BLOCK).text.length - cut} chars with ${REPLACEMENT.length}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json, VERSION, now, page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
        'Correct the Cerberus attribution this page kept after the run-181 corpus pass fixed it elsewhere. Braiding is ' +
        'recast as the whitepaper\'s proposal rather than a shipped mechanism (Babylon runs Cerberus unsharded, so there ' +
        'is nothing to braid), and the Hyperscale 500k test is no longer offered as validating Cerberus: it measured the ' +
        'Foundation\'s Hyperscale implementation, which "never really used Cerberus". Matches what this page\'s own ' +
        '/contents/tech/research/hyperscale-500k-tps target already said.',
        now,
      ],
    );
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
