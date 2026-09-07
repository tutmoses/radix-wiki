// Sweep 382 — hyperscale-rs: the substate sweep, and the framing its own lead
// developer corrected the morning the digest announced it.
//
// The Hyperscale Weekly bot's Week #17 digest (31 Aug – 6 Sept 2026) led with
// "the network's first real garbage collection". Asked in-channel on 7 September
// whether that meant null state or memory, flightofthefox answered that it is
// storage, not memory, and that Rust needs no memory GC. The repository is the
// authority for what it actually is: docs/03-state-and-sync.md gained a section
// "Retiring state", docs/08-invariants.md gained INV-SWEEP-1..9, and
// specs/substate_sweep.qnt models it.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const SENTINEL = 'INV-SWEEP-6';
const DRY = process.argv.includes('--dry-run');

const G = 'https://github.com/hyperscalers/hyperscale-rs';
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const SECTION = `<h2>Retiring State: the Substate Sweep (August&ndash;September 2026)</h2>
<p>Milestone 2's fifth week produced the change the project's own weekly digest led with, and a correction to how the digest described it. On 7 September 2026 the ${a('https://t.me/hyperscale_digest_bot', 'automated digest bot')} posted Week #17 (31 August &ndash; 6 September, 19 commits) to the project channel under the line that ${a('https://telegram-mcp-phi.vercel.app/2026-09-06', '"the substate sweep gives the network its first real garbage collection"')}. Asked a few hours later in ${a('https://t.me/hyperscale_rs/12119', 'the same channel')} whether that meant null state or memory, the lead developer ${a('https://t.me/hyperscale_rs/12120', 'answered plainly')}: "Cleaning up storage, not memory. IE reclaiming space from guards which don't need to exist once validity windows for the artifacts expire anyway, like subintent nullifiers. No memory GC needed with Rust." The distinction matters for anyone reading the phrase against a runtime they know: nothing here pauses, traces or collects at run time.</p>
<h3>Why a sweep is a consensus operation</h3>
<p>The design was written down as it landed. ${a(G + '/blob/main/docs/03-state-and-sync.md', 'docs/03-state-and-sync.md')} gained a section titled "Retiring state" whose premise is that a committed cell "can be written and overwritten; nothing retires one on a schedule", while some kernel state is owed only for a bounded time &mdash; a subintent nullifier "stops being replay protection once no chain can still be deciding a spend of the subintent" &mdash; and without a sweep that state is permanent. What follows from that is the part that makes it hard: <strong>removing a cell moves the state root</strong>, so the removal is not housekeeping a node may do in its own time. It is a consensus operation every validator has to reproduce exactly.</p>
<p>Three consequences are stated in the document. <strong>The cell answers for its own life:</strong> a sweepable cell carries its expiry in its value and keys by it, so no side index and no transaction body is needed to decide whether it is still owed &mdash; which matters because the key prefix is the only thing guaranteed to survive a shard reshape, and a rule keyed off anything else "would not survive a split". <strong>The block states a frontier, not a list:</strong> sweepable cells sort by an expiry bucket leading the key's local half, so a chain's sweep is a cursor over that order and a block's removals are exactly the cells between its parent's frontier and its own, with the interval capped and the cursor recording where a capped sweep stopped. <strong>Advancing is obliged:</strong> a removal earns no fee and costs a proposer block space, so "a rule permitting omission is one honest proposers converge on omitting" &mdash; a block that could sweep and did not is refused.</p>
<h3>The invariant register</h3>
<p>${a(G + '/commit/f6183b15', 'A single 30-line commit')} registered the properties in ${a(G + '/blob/main/docs/08-invariants.md', 'docs/08-invariants.md')} as <strong>INV-SWEEP-1 through INV-SWEEP-9</strong>, alongside the existing consensus, state and economic families. The load-bearing ones are the determinism claim (INV-SWEEP-1, a block's removals are a function of its frontier pair and committed state, so "nothing about which node proposed the block, or how a node came by its state, enters into it"), the safety claim (INV-SWEEP-3, a sweep removes no cell any admissible transaction could still read), the liveness pair (INV-SWEEP-4, sweep work per block is bounded and a partial sweep says where it stopped, so a backlog drains across blocks; INV-SWEEP-6, mandatory advance), and the two that keep the cursor monotone across a reshape (INV-SWEEP-7, nothing is born below the cursor; INV-SWEEP-8, an inherited frontier never rises). What stops a sweep retiring something still in use is not a clock-skew bound but co-location: the chain holding the cell is the chain that would read it.</p>
<h3>Eleven commits, and a model of what breaks it</h3>
<p>The work is legible commit by commit in ${a(G + '/commits/main', 'the repository')} across 31 August and 1 September 2026: an expiry given to a nullifier ${a(G + '/commit/2fc94538', '"in its value and in its key"')}, ${a(G + '/commit/bfdd430c', 'the key led by the bucket its expiry falls in')}, ${a(G + '/commit/62624b8a', "a shard's sweepable cells indexed by expiry bucket")}, ${a(G + '/commit/7e344942', 'a bound on how many one block may create')}, ${a(G + '/commit/67967557', 'expired cells retired at a frontier the header states')} (694 additions across twelve crates, the largest of the set), ${a(G + '/commit/2d3730aa', 'a from-scratch commit made to state what it removes')}, and ${a(G + '/commit/966e8e51', 'a test watching a real nullifier leave state once nothing can reach it')}. On 1 September the set closed the way this project closes design work: ${a(G + '/commit/82bf799c', 'a 560-line Quint model')}, <code>specs/substate_sweep.qnt</code>, registered as Model K &mdash; one module for a chain's frontier walk and one for what a successor's cursor starts at, with everything else (consensus, execution, the index that finds the candidates) left as an oracle, and with the "twins" that deliberately break the invariants written beside the model, the same technique described under Formal Verification below.</p>
<p>The second item in the same digest is smaller and unrelated to the sweep: intents now carry ${a(G + '/commit/17d5dbb7', 'a signed header naming the network they are for')}, so an intent naming a network its envelope does not is refused, and ${a(G + '/commit/c88e690b', "a transaction's validity window narrows to the intersection of every intent it binds")}. Both close cross-network replay. The digest names integrating the sweep into shard execution as the next step.</p>`;

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

  // Place it directly after "Fees, Emission and the Work Budget" — the other
  // Milestone 2 section — and before "Crate Structure".
  const at = blocks.findIndex((b) => (b.text || '').includes('<h2>Fees, Emission and the Work Budget</h2>'));
  if (at < 0) throw new Error('anchor section not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '6.24.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (section at index ${at + 1} of ${blocks.length})`);
  if (DRY) { console.log(SECTION.slice(0, 400)); process.exit(0); }

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
     "Record Milestone 2's substate sweep from the repository (docs/03-state-and-sync.md §8, INV-SWEEP-1..9, specs/substate_sweep.qnt, eleven commits of 31 Aug–1 Sep), and the lead developer's 7 September correction of the digest's \"garbage collection\" framing: storage reclamation of expired guards, not memory GC.", now]);
  await client.query('COMMIT');
  console.log('  written');
} finally {
  client.release();
  await pool.end();
}
