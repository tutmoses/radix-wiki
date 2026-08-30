import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/releases';
const SLUG = 'stokenet';
const SENTINEL = 'The node the network runs is not the node the instructions install';
const DRY = process.argv.includes('--dry-run');

const NEW_SECTION = `
<h4>The node the network runs is not the node the instructions install, 30 August 2026</h4>
<p>At <a href="https://t.me/RadixDevelopers/66138" target="_blank" rel="noopener">10:06&nbsp;UTC on 30 August</a>, a day after the reset, <a href="/community/daffy" rel="noopener">Daffy</a> posted a status update: Stokenet &ldquo;is running steady on V1.3.0.5 with an empty ledger and updated to cuttlefish through Validator signalling&rdquo;. That version is the current official node release &ndash; <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.3.0.5" target="_blank" rel="noopener">Cuttlefish v1.3.0.5</a>, published 1 June 2026 &ndash; so on version alone the reset network is exactly where it should be.</p>
<p>The binary is not the stock one, and the reason is a design detail of the node rather than anything about the reset. Keeping the name Stokenet meant keeping <strong>network ID 2</strong>, and the genesis for network 2 is compiled into the node binary with no flag to override it, so a fresh node built from the published image derives the <em>discarded</em> genesis for that ID and cannot join the ledger that replaced it. The operator&rsquo;s fix was deliberately minimal: &ldquo;a two-line overlay replacing one 538&nbsp;KB jar, with everything else the unmodified official release, reversible by one image: line once an official build ships&rdquo;. The consequence for everyone else is stated plainly in the same message &ndash; &ldquo;the official instructions on radixdlt.com is not working any longer without doing some additional steps&rdquo; &ndash; with those steps circulated as a document in the channel rather than published.</p>
<p>The documentation is further behind than one patched jar. Read on 30 August 2026, <a href="https://docs.radixdlt.com/docs/node-setup-docker" target="_blank" rel="noopener">Docker Node Setup</a> still publishes a Stokenet compose file that sets <code>RADIXDLT_NETWORK_ID: 2</code>, lists three seed hosts under <code>radix.community</code> (all three still resolve in DNS), and pins <code>image: radixdlt/babylon-node:v1.2.1</code> &ndash; <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.2.1" target="_blank" rel="noopener">Bottlenose, May 2024</a>, two protocol updates behind what the network now runs. A reader following the documented path today installs a two-year-old node for a network that needs a patched newer one, and the reset did not create that gap so much as make it impossible to ignore.</p>
<p>The same update notes that &ldquo;more activity will normalize the epoch times back to 5 mins&rdquo;, and the network is measurably running short of that. Read at the <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway</a> on 30 August, epoch 376 was at round 2,821 at 11:08:03&nbsp;UTC and epoch 377 was at round 102 twenty seconds later, with rounds advancing at 14.05 per second over the preceding minute &ndash; an epoch of roughly 3&nbsp;minutes 34&nbsp;seconds. An epoch ends at whichever comes first: 3,000 rounds, or 300,000&nbsp;ms once at least 500 rounds have happened (<code>ConsensusManagerConfig::mainnet()</code> in <a href="https://github.com/radixdlt/radixdlt-scrypto/blob/main/radix-engine-interface/src/blueprints/consensus_manager/invocations.rs" target="_blank" rel="noopener">radixdlt-scrypto</a>), and the measured boundary lands within a round or two of the 3,000 cap. On an idle network of four validators rounds complete far faster than the timer, so the cap binds and epochs come in short; traffic slows rounds until the five-minute target binds instead. The 5&nbsp;minutes are not being restored by an operator, in other words, but by use.</p>
`;

const OLD_NOTE = 'The terms, the reset-day record and what a developer has to redo are in the';
const NEW_NOTE = 'The network runs the current node release with a patched genesis, so the published node instructions no longer work unmodified. The terms, the reset-day record and what a developer has to redo are in the';

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
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  if (!blocks[1].text.includes(OLD_NOTE)) throw new Error('block 1 operational-note anchor missing');
  blocks[1].text = blocks[1].text.replace(OLD_NOTE, NEW_NOTE);

  blocks[2].text = blocks[2].text.trimEnd() + '\n' + NEW_SECTION.trim() + '\n';

  const version = '1.9.0';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  block1 ${page.content[1].text.length} -> ${blocks[1].text.length} B`);
  console.log(`  block2 ${page.content[2].text.length} -> ${blocks[2].text.length} B`);
  if (!DRY) {
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'The 30 August status update: Stokenet runs the current official release v1.3.0.5, but not the stock binary. Network ID 2 has its genesis compiled into the node with no override flag, so keeping the name meant a two-line overlay replacing one 538 KB jar, and the published radixdlt.com node instructions no longer work without extra steps. Adds the measured gap in the docs (the Stokenet compose still pins Bottlenose v1.2.1) and the epoch cadence read at the Gateway: about 3 min 34 s, because the 3,000-round cap binds before the five-minute timer on an idle network.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
