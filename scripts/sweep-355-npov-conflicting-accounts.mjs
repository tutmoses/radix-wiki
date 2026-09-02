import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'policy';
const SLUG = 'neutral-point-of-view';
const SENTINEL = 'when-accounts-conflict';

const SECTION = `<h2 id="${SENTINEL}">When accounts conflict</h2>
<p>Status fields go wrong slowly. Contested events go wrong fast, and they are where neutrality is hardest to hold, because the pressure is not to flatter a subject but to settle a question the sources have not settled. The rule is the same one in a harder case: state as fact only what a reader can check for themselves, attribute everything else to whoever said it, and do not resolve a disagreement on the page that is unresolved off it.</p>
<p>Three practices follow from that, and <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">the August 2026 asset drain and network halt</a> is the worked example for each, because it is being written here while it is still happening.</p>
<p><strong>Officialness is not evidence.</strong> A statement from the organisation closest to an event is a source, not an adjudication, and it carries no more weight than a source a reader can verify. On 2 September 2026 the Radix Foundation's own channel <a href="https://t.me/RadixAnnouncements/2778" target="_blank" rel="noopener">said that it and the Accountability Council</a> <q>have halted the Radix network</q>. Three hours earlier, in a different channel, <a href="https://t.me/radix_dlt/1001292" target="_blank" rel="noopener">Astrolescent's Timan wrote</a> that <q>the node runners made that decision to protect the network. That was not a centralized decision.</q> The ledger agrees with the second: rounds stopped when stake fell below the threshold, which is a thing node runners do individually and no organisation can do to them. The page records both statements, dated and attributed, and says which one the ledger supports. It does not delete the first for being wrong, and it does not adopt it for being official.</p>
<p><strong>Carry the hedge.</strong> Where a source qualifies a claim, the qualification travels with it. The first public technical accounts of that incident's root cause came from a protocol developer who twice asked to be taken <q>with a pinch of salt</q> and expected a more accurate write-up later. Repeating such a claim without its hedge converts a working hypothesis into a finding, which is a failure of neutrality as much as of accuracy, and it is a failure this wiki commits on the source's behalf rather than the source's own.</p>
<p><strong>Separate what is checkable from what is asserted.</strong> The same page states the mechanism of the flaw flatly, because it is read from published source at a named version and any reader can open the file; it attributes the accounts of that mechanism given in chat, because those rest on the standing of the people who gave them. Both belong on the page. Only the first is stated as fact. Where an event has no checkable layer at all, every account of it is attributed, and the page says plainly that nothing independent settles it.</p>
<p>Neutrality here is not even-handedness for its own sake. Two accounts of an event are rarely equally supported, and saying so is part of the job; what is not part of the job is choosing between them on the strength of who is speaking, or quietly leaving out the version that is inconvenient for either party. See also <a href="/policy/verifiability" class="link">verifiability</a>, which governs what counts as checkable, and <a href="/policy/no-original-research" class="link">no original research</a>, which governs how far a page may reason from primary sources on its own.</p>`;

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

  const idx = blocks.findIndex((b) => b.text?.includes('<h2>See also</h2>'));
  if (idx < 0) throw new Error('anchor block "See also" not found');
  blocks.splice(idx, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '1.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}  inserted at ${idx}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'New section: when accounts conflict. The policy covered promotional drift and status fields but had nothing on contested events, which the August 2026 halt has made the live case. Three practices, each worked against a dated pair of sources: officialness is not evidence, carry the hedge, and separate the checkable from the asserted.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
