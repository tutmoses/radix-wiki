// Run 400. Day eleven of the mainnet halt. The Eagle Ray node build stopped being a
// release candidate at 03:59:09 UTC on 10 September - v1.4.0.0 is a final release, not
// flagged pre-release, so /releases/latest and the ghproxy mirror the babylonnode
// installer reads both return it. Five hours later the Radix Accountability Council told
// operators not to install it yet. The gap left is coordination, not code.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'day-eleven-hold';
const DRY = process.argv.includes('--dry-run');

const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const SECTION = `<h2 id="${SENTINEL}">Day eleven: the release stops being a candidate, and the council says do not install it</h2>
<p>Read at <strong>11:12:37&nbsp;UTC on 10 September 2026</strong>, ${A('https://mainnet.radixdlt.com/status/gateway-status', 'the Gateway status endpoint')} returns the ledger it has returned since the halt: state version 557,840,622, epoch 339,896, round 102. That is <strong>229 hours and 53 minutes</strong> without a committed round. <code>/state/validators/list</code> answers HTTP 500 and counts the same gap, <q>it is currently 9 days, 13 hours, 53 minutes, 31 seconds behind</q>, with <code>current_sync_delay_seconds</code> 827,611 against a <code>max_allowed_sync_delay_seconds</code> of 720.</p>
<h3 id="the-release-is-final">The release is final, and that changes what the installer fetches</h3>
<p>At <strong>03:59:09&nbsp;UTC</strong> babylon-node published ${A('https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0', '<code>v1.4.0.0</code>, named Eagle Ray')}, the final commit the ${A('https://t.me/RadixAccountabilityCouncil/1012', 'council named on 9 September')} as the first of its three next steps. Its tag resolves to <code>7400951e0eb76a725f39d04d57da293fb335bd0e</code>, which is also what ${A('https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1', '<code>v1.4.0.0-RC1</code>')} of 8 September resolves to and the tip of <code>main</code>. The code is byte for byte the release candidate; what the final release changes is the pre-release flag.</p>
<p>That flag is not cosmetic. GitHub reports as <code>latest</code> the newest release that is neither a draft nor a pre-release, so from 8 to 10 September the answer was <code>v1.3.0.5-test.1</code> &ndash; a rebuild of the very version mainnet halted on &ndash; and that is what ${A('https://ghproxy.radixdlt.com/radixdlt/babylon-node', 'the ghproxy mirror')} served to the <code>babylonnode</code> installer. Read at 11:12&nbsp;UTC both now return <code>v1.4.0.0</code>. An operator who runs the standard install today gets the fix rather than the flaw, which was not true yesterday.</p>
<h3 id="the-instruction-is-still-wait">The instruction is still wait</h3>
<p>At <strong>05:54:09&nbsp;UTC</strong>, in the main Radix chat, Timan of ${A('https://x.com/astrolescent', 'Astrolescent')} gave the first statement of near-term intent from anyone: ${A('https://t.me/radix_dlt/1002777', '<q>The stokenet upgrade yesterday went super smooth, so we&rsquo;re very close in bringing mainnet back up. That needs a bit of coordination with the node runners, so it won&rsquo;t be today, but I really hope we can pull that off in the coming days.</q>')} He is an operator, not the Foundation and not the council, neither of which has published a date.</p>
<p>Three hours later the council itself posted. At <strong>09:13:53&nbsp;UTC</strong>, projectShift wrote under the heading <q>STATUS UPDATE FROM RAC</q>: ${A('https://t.me/RadixAccountabilityCouncil/1017', '<q>Although final versions has been made available, pls do not update your nodes yet. Further instructions and support will be shared later today or tmrw latest. Validator Node-runners should check dedicated chat often for specific updated information.</q>')}</p>
<p>On 7 September the council read the Scrypto release and ${A('https://t.me/RadixAccountabilityCouncil/1012', 'told operators not to run it')}, because a library release is not a node build. On 8 September it said the same of the release candidate, because a candidate is not a release. Today there is a release, it is flagged latest, the installer serves it &ndash; and the instruction has not changed. What is being waited on is no longer a build. It is the <a href="#the-room-the-halt-was-agreed-in">few dozen operators</a> who agreed the halt among themselves agreeing a restart the same way, on a schedule that has to be circulated before it can be run.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const sub = (block, needle, repl, where) => {
  if (!block.text.includes(needle)) throw new Error(`${where}: not matched -> ${needle.slice(0, 80)}`);
  block.text = block.text.replace(needle, repl);
};

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied - no write'); process.exit(0); }

  // Infobox: the network-status row and the fix row both still stop at 9 September.
  const box = blocks[0].blocks[0];
  sub(box,
    'Still halted when re-read at 23:06 UTC, 9 September, 217 hours and 47 minutes after the last round',
    'Still halted when re-read at 11:12 UTC, 10 September, 229 hours and 53 minutes after the last round',
    'infobox network status');
  sub(box,
    `Carried on the node side by babylon-node ${A('https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1', 'v1.4.0.0-RC1')} of 8 September, still flagged a pre-release`,
    `Carried on the node side by babylon-node ${A('https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0', 'v1.4.0.0')}, released final at 03:59 UTC on 10 September. The council has asked operators not to install it yet`,
    'infobox fix row');

  // New section goes before "What is unresolved".
  const at = blocks.findIndex((b) => (b.text || '').includes('<h2>What is unresolved</h2>'));
  if (at < 0) throw new Error('anchor block "What is unresolved" not found');
  blocks.splice(at, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '2.24.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${page.content.length} -> ${blocks.length} blocks, section at index ${at})`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Day eleven: babylon-node v1.4.0.0 is published as a final release at 03:59:09 UTC, the same commit as RC1 but without the pre-release flag, so /releases/latest and the ghproxy mirror the babylonnode installer reads both return the fix instead of v1.3.0.5-test.1. At 09:13:53 UTC the Radix Accountability Council tells operators not to install it yet; at 05:54 UTC Timan of Astrolescent gives the first near-term restart intent from anyone. Forty-ninth Gateway reading, 229h53m. Infobox network-status and fix rows carried forward.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} catch (e) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('  FAILED:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
