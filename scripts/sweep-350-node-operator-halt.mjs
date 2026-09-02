import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 350 (developers rotation). The halt from the node operator's side: the restart is
// per-operator deployment work, there is still nothing published to deploy, epochs are not
// advancing so no emissions accrue, and the only open bug report against the current release
// is a start-up failure nobody has answered in fifteen days.
const TAG_PATH = 'developers/infrastructure';
const SLUG = '01-running-a-node';
const SENTINEL = 'Operating Through a Halted Network';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2>Operating Through a Halted Network</h2>
<p>Mainnet stopped committing rounds at <strong>21:19:06.179 UTC on 31 August 2026</strong>, at epoch 339,896, round 102, after the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain</a>. The halt is not a mode the network was switched into and there is no lever to throw back: node runners stopped their own nodes, and liveness returns only when enough of them individually deploy a patched release and start again.</p>
<p>The <a href="https://t.me/RadixAccountabilityCouncil/936" target="_blank" rel="noopener">Radix Accountability Council set out the sequence</a> at 12:16 UTC on 1 September – "code fixes for the RE", "updates to the node software + protocol upgrade", "a coordinated deployment of those across nodes", and "a careful coordinated return to liveness of the network", with no timetable. Steps three and four are operator work, which makes the state of your node between now and then worth understanding.</p>
<h3>Nothing to deploy yet</h3>
<p>The releases page is the cheapest signal an operator has for whether step two has produced anything. Checked at 23:07 UTC on 1 September, twenty-five hours into the halt, <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node's newest release was still <code>v1.3.0.5</code></a>, published on 1 June 2026 – the same build the <code>babylonnode</code> CLI has been installing all along. Until a new tag appears there, there is no patched node to run.</p>
<h3>No epochs means no emissions</h3>
<p><a href="/contents/tech/core-concepts/network-emissions" rel="noopener">Staking emissions</a> are minted per epoch, and the epoch counter has not moved since the halt. Nothing accrues to validators or their delegators while the network is stopped, and nothing is lost in arrears either – the ledger simply has no epochs to pay out for. This was <a href="https://t.me/radix_dlt/1001243" target="_blank" rel="noopener">answered directly in the main channel</a> on 1 September: "The network progresses in epochs and stake rewards are given per epoch run. So no progress in epoch = no rewards given."</p>
<h3>A start-up failure on the current release, still unanswered</h3>
<p>One operator report against <code>v1.3.0.5</code> has been open on the official forum since <a href="https://radixtalk.com/t/v1-3-0-5-not-working/2327" target="_blank" rel="noopener">17 August 2026</a> with no reply. On an Ubuntu 22.04.5 LTS host where <code>v1.3.0.4</code> runs normally, swapping in the <code>v1.3.0.5</code> binary and its <code>libcorerust.so</code> makes the node panic during initialisation and restart in a loop:</p>
<pre><code>panicked at state-manager/src/jni/node_rust_environment.rs:173:72:
called \`Result::unwrap()\` on an \`Err\` value: JavaError("[ERROR] byte offset: 90-92,
value path: StateManagerConfig.[4|database_config]-&gt;DatabaseConfig,
cause: { expected_field_count: 4, found: 5 }")</code></pre>
<p>The failure is not an operating-system incompatibility. It is a decode mismatch at the JNI boundary: the node's Java process hands the native state manager a <code>DatabaseConfig</code> carrying five fields where the Rust side expects four, which is the signature of a Java binary and a <code>libcorerust.so</code> that did not ship together. If you keep multiple releases side by side under <code>/opt/radixdlt/babylon-node/</code> and select between them with <code>LD_PRELOAD</code>, check that both halves resolve to the same release before assuming the release itself is broken.</p>
<p>The report was <a href="https://t.me/radix_dlt/1001249" target="_blank" rel="noopener">raised again on 1 September</a>, twenty-four hours into the halt and immediately before the node update the restart depends on – the kind of thing worth confirming on your own host before the coordinated deployment rather than during it.</p>`;

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

  const at = blocks.findIndex((b) => (b.text || '').includes('<h2>Which Node Version the CLI Installs</h2>'));
  if (at < 0) throw new Error('anchor section not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '2.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (insert at index ${at + 1}, ${blocks.length} blocks)`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Add "Operating Through a Halted Network": the RAC\'s four-step sequence puts deployment on operators, babylon-node still ships v1.3.0.5 twenty-five hours in, no epochs means no emissions, and the one open start-up report against that release (radixtalk 2327, 17 August) is a JNI DatabaseConfig field-count mismatch nobody has answered.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
