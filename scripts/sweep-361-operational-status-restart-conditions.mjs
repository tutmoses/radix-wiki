// Run 361 (contents/resources rotation). The operational-status index carried a
// 1 September reading of the halt. Refreshed to 3 September and given the first
// account of what the restart actually requires (RAC 969, 16:02 UTC), plus the
// same author's correction that the fix is not implemented (radix_dlt 1001788).
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/resources';
const SLUG = 'radix-ecosystem-operational-status';
const SENTINEL = 'Fix is not implemented';
const DRY = process.argv.includes('--dry-run');

const OLD_READING = `Read at <strong>15:04 UTC on 1 September</strong>, the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> still returns the last committed ledger &mdash; state version 557,840,622, epoch 339,896, round 102 &mdash; and a read of <code>/state/entity/details</code> answers HTTP 500 with the sentence &ldquo;it is currently 17 hours, 45 minutes, 36 seconds behind&rdquo;.</p>`;

const NEW_READING = `Read again at <strong>23:09 UTC on 3 September</strong>, the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> returns the same last committed ledger it returned two days earlier, state version 557,840,622, epoch 339,896, round 102, and a read of <code>/state/entity/details</code> answers HTTP 500 with the sentence &ldquo;it is currently 3 days, 1 hour, 50 minutes, 21 seconds behind&rdquo;: a sync delay of 265,821 seconds against the 720 the Gateway will tolerate.</p>
<p><strong>What a restart requires, as the Radix Accountability Council put it on 3 September.</strong> In a status update at <a href="https://t.me/RadixAccountabilityCouncil/969" target="_blank" rel="noopener">16:02 UTC</a> the RAC said the root cause is identified, verified and confirmed, and that a code fix is built but still under review and intensive testing. It named the hard part as enactment rather than the patch: closing the hole &ldquo;safely, consistently and in a way that no attacker can inject any tx in the network <em>before</em> the corrected protocol is enacted&rdquo;. Restarting then needs the node runners back, and they are not the council's to instruct. They &ldquo;need to review, accept and be in accord with the implementation plan&rdquo;, because &ldquo;this is a permissionless network and node-runners are independent&rdquo;. <strong>No date was given</strong>, and the update says so in terms: &ldquo;Still no hard date to commit to.&rdquo;</p>
<p>An hour later, in the main channel, the same council member corrected a reader who had inferred from this wiki and the public repository that the fix was already in place. &ldquo;<a href="https://t.me/radix_dlt/1001788" target="_blank" rel="noopener">Fix is not implemented, that's not true</a>&rdquo; came the reply, declining to say what the fix does and adding that review will be possible, though not necessarily as a diff published for node runners ahead of the restart, which is what the reader had asked for (<a href="https://t.me/radix_dlt/1001786" target="_blank" rel="noopener">t.me/radix_dlt/1001786</a>). Both messages were authorship-verified at their public embeds. Until the restart lands, no status on this page can be confirmed against the ledger.</p>`;

const OLD_IB = `<tr><td><strong>Network status</strong></td><td>Mainnet halted since 21:19 UTC, 31 August 2026 &mdash; see the notice below</td></tr>`;
const NEW_IB = `<tr><td><strong>Network status</strong></td><td>Mainnet halted since 21:19 UTC, 31 August 2026; no restart date announced as of 3 September &mdash; see the notice below</td></tr>`;

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
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied — no write'); process.exit(0); }

  const ib = blocks.find((b) => b.type === 'infobox').blocks[0];
  const halt = blocks.find((b) => b.id === '283f5a75-ba22-4f58-8c5a-000d685ceba7');
  if (!ib || !halt) throw new Error('target blocks not found');

  for (const [blk, from, to, label] of [[ib, OLD_IB, NEW_IB, 'infobox status row'], [halt, OLD_READING, NEW_READING, 'halt reading + restart conditions']]) {
    if (!blk.text.includes(from)) throw new Error(`find-string missed: ${label}`);
    blk.text = blk.text.replace(from, to);
    console.log(`  ok  ${label}`);
  }

  const version = '1.8.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
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
       'Halt reading refreshed to 23:09 UTC 3 September (Gateway 3d 1h 50m behind) and the restart conditions recorded from RAC 969: root cause confirmed, fix built but under review, enactment the hard part, node runners independent, no date. Plus the same author correcting that the fix is not implemented (radix_dlt 1001788).', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
