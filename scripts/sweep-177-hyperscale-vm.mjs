// scripts/sweep-177-hyperscale-vm.mjs — wiki-sweep run 177, step-1 signal edit.
//
// /contents/tech/research/hyperscale-rs  v4.7.0 -> 4.8.0
//
// The page mentions the Radix Engine 11 times and never addresses which VM
// hyperscale-rs will actually execute on — the single biggest open question for
// Scrypto developers, and this is the wiki's #3 traffic page (37 visitors/30d).
//
// On 1 Aug 2026 flightofthefox (lead developer) confirmed in the project's
// Telegram channel that a purpose-built VM is underway rather than a sharding
// retrofit of the Radix Engine. Authorship of every quoted message was verified
// individually through the public t.me embed markup, not inferred from position
// in the transcript. The April 2026 message that sets out the full technical
// rationale (t.me/hyperscale_rs/6018) was fetched and read in full.
//
//   node scripts/sweep-177-hyperscale-vm.mjs --dry-run
//   node scripts/sweep-177-hyperscale-vm.mjs
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TG = (id) => `https://t.me/hyperscale_rs/${id}`;

const SECTION = `<h2>Execution Layer: a Purpose-Built VM Rather Than the Radix Engine</h2>
<p>hyperscale-rs is a consensus layer, and the question of which execution environment would run on top of it stayed open through the project's first year. On 11 April 2026 the lead developer framed it as <a href="${TG(6018)}" target="_blank" rel="noopener">"a decision point rather than anything proscribed by technical limitations"</a>, with three options on the table: (a) a low-friction change under which existing dApps keep working as they are, (b) a higher-friction change that may require dApp adaptation but produces a better system overall, or (c) supporting both, at the cost of maximum complexity for client builders and maintainers.</p>
<p>The technical argument turns on <strong>data dependencies</strong>. For a sharded network the ideal virtual machine is one where a transaction's full data requirements resolve deterministically in advance, from the <a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">transaction manifest</a> plus the metadata of any blueprints it references. The <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a>, on the developer's assessment, is <a href="${TG(6018)}" target="_blank" rel="noopener">"too loose"</a> for that — its state access is not self-describing enough — which leaves only two unattractive routes to transaction preview: an ingress node holding state from every shard, which does not scale past a point, or any node pulling state on demand light-client style, discovering each new dependency part-way through execution. The second is slow, and because preview happens before submission there is no clean way to compensate the nodes performing it.</p>
<p>On 1 August 2026 the direction was confirmed in the same channel. Asked whether the Radix Engine was simply not built for sharding, the lead developer answered that <a href="${TG(10332)}" target="_blank" rel="noopener">"it's not in the ballpark. it's not in the same zip code as the ballpark"</a>. Asked directly whether it would make more sense to develop a new VM than to modify the Radix Engine, the reply was <a href="${TG(10334)}" target="_blank" rel="noopener">"yeah, it's underway"</a>, with the reasoning that <a href="${TG(10336)}" target="_blank" rel="noopener">"the sharding adjustments are so many that it'd require touching everything. at some point it becomes easier to start with intention than to retrofit"</a>. That is option (b) from the April framing.</p>
<p>What this means for <a href="/developers/scrypto" rel="noopener">Scrypto</a> has not been stated. The question was <a href="${TG(10338)}" target="_blank" rel="noopener">put to the channel</a> the same day and is unanswered at the time of writing, as is how much the new VM will take from the Radix Engine — the April message allowed only that it "might borrow some ideas from RE", not use it wholesale. None of this affects Radix mainnet as deployed, which continues to run the Radix Engine under <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a>-derived Babylon consensus; the new VM belongs to the Hyperscale programme, and no migration has been scheduled.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage('contents/tech/research', 'hyperscale-rs')) throw new Error('hyperscale-rs is LOCKED');
  const { rows } = await client.query(
    "SELECT id, title, version, content FROM pages WHERE tag_path='contents/tech/research' AND slug='hyperscale-rs'");
  if (!rows.length) throw new Error('hyperscale-rs not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => typeof b.text === 'string' && b.text.includes('Purpose-Built VM'))) {
    console.log('  section already present — no write');
    process.exit(0);
  }
  const extIdx = blocks.findIndex((b) => typeof b.text === 'string' && /<h2[^>]*>\s*External Links/.test(b.text));
  const at = extIdx < 0 ? blocks.length : extIdx;
  blocks.splice(at, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '4.8.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (section inserted at block ${at})`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Add the execution-layer section: on 1 Aug 2026 the lead developer confirmed a purpose-built VM is underway rather than a sharding retrofit of the Radix Engine, with the April 2026 data-dependency rationale. Scrypto\'s position recorded as unanswered.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
