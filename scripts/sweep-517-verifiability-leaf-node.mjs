// Sweep 517: /policy/verifiability's "website is not its status" example carried Leaf Node's
// stake, rank, pending-withdrawal and stored-versus-charged fee figures, re-read on every policy
// rotation. That is the per-validator fee snapshot the wiki dropped on 1 Oct 2026 everywhere else
// (ecosystem/leafnode v4.4.0). Keep the registration events and the site's silence; point the
// live figures at the validator's Radix Dashboard page.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'policy';
const SLUG = 'verifiability';
const SENTINEL = 'which reads the ledger live';
const DASHBOARD = 'https://dashboard.radixdlt.com/network-staking/validator_rdx1swzn5hvtut6yq0zxqqsa0wk4rnkfd8wewvnphzrckau22pun2lv86t';
const HEAD = '<h3>A project&rsquo;s website is not its status</h3><p>';
const NEXT = '<p>This page is itself the cautionary half';

const PARA = 'Whether a homepage loads says nothing about what a project is doing on-ledger, and the example this section has carried since August proved it twice. '
  + '<a href="/ecosystem/leafnode" class="link">Leaf Node</a>&rsquo;s validator unregistered on 10 August 2026 and registered again six days later, at 11:41:48&nbsp;UTC on 16 August (<a href="https://dashboard.radixdlt.com/transaction/txid_rdx1x80208v5xezsyuvh0jydrplt8uwgmsmlpexv634fu3236qr8nfjslysr0y/summary" target="_blank" rel="noopener">epoch&nbsp;335,461</a>), without announcing either move. '
  + 'It was still registered when the <a href="https://dashboard.radixdlt.com/transaction/txid_rdx1mh3d3fkltk8fzp3zlumkqewejfhsngvqd7z5eggl6u8srspw9cqs9qq6va/summary" target="_blank" rel="noopener">100% fee</a> it queued in August took effect on 16 September, which leaves its delegators no emission. '
  + `Its stake and the fee it charges today are on its <a href="${DASHBOARD}" target="_blank" rel="noopener">Radix Dashboard page</a>, which reads the ledger live. `
  + 'Throughout all of it <a href="https://www.leafnode.info" target="_blank" rel="noopener">leafnode.info</a> answered <code>503</code>, and it still did on 1 October: the site said nothing when the validator quit, nothing when it came back, and nothing across a twelve-day network halt.</p>';

const DRY = process.argv.includes('--dry-run');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied, no write'); process.exit(0); }
  const block = blocks.find((b) => b.type === 'content' && b.text?.includes(HEAD));
  if (!block) throw new Error('section not found');
  const start = block.text.indexOf(HEAD) + HEAD.length;
  const end = block.text.indexOf(NEXT, start);
  if (end < 0) throw new Error('next paragraph not found');
  const before = block.text.slice(start, end);
  if (!before.includes('stored fee field')) throw new Error('unexpected paragraph');
  block.text = block.text.slice(0, start) + PARA + block.text.slice(end);
  console.log(`  removed ${before.length} chars, added ${PARA.length}`);

  const version = '1.12.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 517: the Leaf Node example no longer carries stake, rank, pending-withdrawal or stored-versus-charged fee figures; it links the validator\'s Radix Dashboard page for those, as ecosystem/leafnode has since 1 Oct 2026. Registration events and leafnode.info\'s 503 (re-read 1 Oct) kept.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
