// Run 468, contents/tech rotation, staleness slice.
//
// /contents/tech/core-protocols/system-layer was the stalest page in the category
// (last verified 2 August 2026) and the thinnest of the four engine-layer pages at
// 5,759 characters. What it omitted is the thing that makes the system layer
// different from the kernel below it: the system layer's behaviour is VERSIONED,
// and a protocol update is the act of advancing that version. The page described
// the layer as though its rules were fixed.
//
// Every figure below is read from radixdlt-scrypto at tag v1.4.0 —
// radix-engine/src/system/system_callback.rs (SystemBoot at :100-163, SystemVersion
// and its predicates at :166-272, the receiver check at :1953-1980) and
// radix-engine/src/updates/eagle_ray.rs. Nothing is carried from the docs, which
// have no page for Eagle Ray at all.
//
// The non-obvious finding, and the reason this is worth a section rather than a
// sentence: MAINNET HAS NEVER RUN V4. Cuttlefish left it at V3, Dugong was never
// enacted, and Eagle Ray flashes V5 — so the single V4-only behaviour, which the
// source itself comments must not carry forward, has never been in force.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/core-protocols';
const SLUG = 'system-layer';
const DRY = process.argv.includes('--dry-run');
const SENTINEL = '<h2>System Versions</h2>';

const SECTION = `<h2>System Versions</h2>
<p>The kernel below this layer does not change between <a href="/contents/tech/releases/protocol-updates" rel="noopener">protocol updates</a>; the system layer does, and it carries a version number saying which set of rules is in force. The engine reads that number from a <code>SystemBoot</code> substate held on the boot-loader partition of the <a href="/contents/tech/core-concepts/transaction-tracker" rel="noopener">TransactionTracker</a>, before it executes anything (<a href="https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/radix-engine/src/system/system_callback.rs" target="_blank" rel="noopener"><code>system_callback.rs</code></a>). Enacting a protocol update that changes system behaviour therefore means flashing a replacement <code>SystemBoot</code> onto that partition, carrying the previous parameters across and advancing the version &ndash; no blueprint is published and no ledger state is migrated. The substate itself only exists from Bottlenose onward: before that the loader has nothing to read and falls back to the Babylon genesis parameters.</p>
<p>The enum is declared in the source as <q>system logic which may change given a protocol version</q>, and each behaviour it gates is a comparison against it rather than a branch on the update&rsquo;s name.</p>
<table><thead><tr><th>Version</th><th>Reached mainnet with</th><th>What the version gates</th></tr></thead><tbody>
<tr><td><code>V1</code></td><td><a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">Babylon</a> genesis; unchanged by Anemone and Bottlenose</td><td>A transaction is run as a single <code>call_function</code> into the <a href="/contents/tech/core-concepts/transaction-processor" rel="noopener">TransactionProcessor</a> blueprint, the auth zone is built from that call, its proofs are injected into it, and client-side costing is skipped at the outermost frame.</td></tr>
<tr><td><code>V2</code></td><td>Cuttlefish, part 1</td><td>Execution moves to the multi-threaded intent processor, which is what lets one transaction carry <a href="/contents/tech/core-concepts/subintents-and-pre-authorizations" rel="noopener">subintents</a>; the transaction intent starts being charged for.</td></tr>
<tr><td><code>V3</code></td><td>Cuttlefish, part 2</td><td>The <code>VERIFY_PARENT</code> manifest instruction stops resolving against the root actor, which is the V2-and-below behaviour.</td></tr>
<tr><td><code>V4</code></td><td>Never &ndash; Dugong was not enacted</td><td>One behaviour, and it is written as an equality rather than a floor: asserting an access rule becomes a no-op while the auth module is disabled. The source comments that <q>Dugong&rsquo;s V4-only behavior must not carry into later versions</q>.</td></tr>
<tr><td><code>V5</code></td><td><a href="/contents/tech/releases/protocol-updates#eagle-ray-enacted" rel="noopener">Eagle Ray</a>, epoch 339,898, 11 September 2026</td><td>The receiver check, below.</td></tr>
</tbody></table>
<p><strong>Mainnet has never run V4.</strong> Cuttlefish left the network at V3 in December 2024, Dugong never reached an enactment configuration, and Eagle Ray writes V5 over whatever it finds. The one V4-only behaviour has accordingly never been in force on mainnet &ndash; which is what the source comment is guarding, since a predicate written as <code>&gt;= V4</code> rather than <code>== V4</code> would have quietly switched it on in September 2026.</p>
<h3>The receiver check (V5)</h3>
<p>V5 enables a single test on the invocation path, and it belongs to this layer precisely because this is where a call is mediated. Before an invocation proceeds, the system asks whether the calling frame can see the node whose method it is about to call. A <code>Direct</code> method &ndash; the kind used for recall and other direct <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">vault</a> access &ndash; requires direct visibility of the receiver; ordinary <code>Main</code> and module methods require ordinary visibility; roots, functions and blueprint hooks are exempt. A call that fails is rejected with <code>SystemError::InvalidInvokeAccess</code>, an error no version before V5 can return. The <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">asset drain and network halt of August 2026</a> is what the check was written in response to.</p>`;

const ANCHOR =
  'Because they are ordinary blueprints from the caller’s point of view, <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a> code composes with them exactly as it composes with user-authored ones.</p>';

const OLD_INTRO_TAIL =
  'It is the layer at which application code interacts with the engine and where <a href="/contents/tech/core-concepts/access-rules-and-auth-zones" rel="noopener">access rules</a> are enforced. Type definitions for this layer live in <code>radix-engine-interface</code>.</p>';
const NEW_INTRO_TAIL =
  'It is the layer at which application code interacts with the engine and where <a href="/contents/tech/core-concepts/access-rules-and-auth-zones" rel="noopener">access rules</a> are enforced. Type definitions for this layer live in <code>radix-engine-interface</code>.</p><p>Unlike the <a href="/contents/tech/core-protocols/kernel-layer" rel="noopener">kernel</a>, this layer is versioned: which rules it applies depends on a <code>SystemVersion</code> the engine reads from ledger state before every transaction, and advancing that version is what a <a href="/contents/tech/releases/protocol-updates" rel="noopener">protocol update</a> does. Mainnet has stood at <code>V5</code> since Eagle Ray on 11 September 2026.</p>';

const OLD_LINKS =
  '<li><a href="https://docs.radixdlt.com/docs/engine-tech-docs" target="_blank" rel="noopener">Radix Engine docs</a></li>';
const NEW_LINKS =
  '<li><a href="https://docs.radixdlt.com/docs/engine-tech-docs" target="_blank" rel="noopener">Radix Engine docs</a></li>\n<li><a href="https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/radix-engine/src/system/system_callback.rs" target="_blank" rel="noopener"><code>system_callback.rs</code> at Scrypto v1.4.0</a> &ndash; <code>SystemBoot</code>, <code>SystemVersion</code> and the behaviours each version gates</li>\n<li><a href="https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/radix-engine/src/updates/eagle_ray.rs" target="_blank" rel="noopener"><code>eagle_ray.rs</code></a> &ndash; the 80-line update that flashes <code>SystemBoot</code> to V5</li>';

const OLD_INFOBOX_TAIL =
  '<tr><th>Source</th><td><a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a></td></tr>';
const NEW_INFOBOX_TAIL =
  '<tr><th>Source</th><td><a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a></td></tr>\n<tr><th>System version</th><td><code>V5</code> (Eagle Ray, 11 September 2026)</td></tr>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes('System Versions')) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  let intro = 0, infobox = 0, links = 0, inserted = 0;
  for (const b of blocks) {
    if (b.type === 'infobox') {
      for (const ib of b.blocks || []) {
        if (typeof ib.text === 'string' && ib.text.includes(OLD_INFOBOX_TAIL)) {
          ib.text = ib.text.replace(OLD_INFOBOX_TAIL, NEW_INFOBOX_TAIL);
          infobox++;
        }
      }
      continue;
    }
    if (typeof b.text !== 'string') continue;
    if (b.text.includes(OLD_INTRO_TAIL)) { b.text = b.text.replace(OLD_INTRO_TAIL, NEW_INTRO_TAIL); intro++; }
    if (b.text.includes(OLD_LINKS)) { b.text = b.text.replace(OLD_LINKS, NEW_LINKS); links++; }
  }

  // New section goes after the Native Blueprints block, before External Links.
  const at = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes(ANCHOR));
  if (at >= 0) {
    blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });
    inserted++;
  }

  if (intro !== 1 || infobox !== 1 || links !== 1 || inserted !== 1) {
    throw new Error(`expected 1/1/1/1, got intro=${intro} infobox=${infobox} links=${links} inserted=${inserted}`);
  }

  const version = '1.2.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  blocks ${page.content.length} -> ${blocks.length}, chars ${JSON.stringify(page.content).length} -> ${JSON.stringify(blocks).length}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json, version, now, page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Add a System Versions section: the system layer is versioned by a SystemBoot substate on the TransactionTracker boot-loader partition, and a protocol update advances it by flashing a replacement. Table of V1-V5, what each gates, and which update carried it, read from radixdlt-scrypto v1.4.0 (system_callback.rs, eagle_ray.rs) rather than from the docs, which have no Eagle Ray page. Records that mainnet has never run V4 - Cuttlefish left it at V3, Dugong was never enacted, Eagle Ray writes V5 - so the one V4-only behaviour has never been in force. Adds the V5 receiver check and a System version infobox row.',
        now,
      ],
    );
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
