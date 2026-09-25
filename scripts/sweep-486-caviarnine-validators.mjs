// sweep 486: CaviarNine's two validators were renamed Sirius and Polaris between 17 and 19
// September 2026, pointed at cadwynbloc.com, and on 23 September both queued a fee change
// from 0% to 25% effective at epoch 347,421 (about 7 October). Read from the Gateway with
// pinned at_ledger_state reads; the owner badges have not moved.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'caviarnine';
const SENTINEL = '<h3>The validators are renamed and queue a 25% fee (September 2026)</h3>';
const ANCHOR = '<h3>Why, and the numbers behind it</h3>';

const V1 = 'validator_rdx1sd8c8v9tffjtgqtuzygnctrmyfnhkd63avcgpzuknx3dlklds85rkv';
const V2 = 'validator_rdx1sv7zpyuj27ycmcsnw0de94j2rp93csq6gvcm4dl4yh4p4fxv9j5pqx';
const scan = (a) => `https://www.radixscan.io/validator/${a}`;

const SECTION = `${SENTINEL}
<p>CaviarNine's two validators are still registered and still validating, but no longer under its name. Between 17 and 19 September 2026 <strong>CaviarNine-1</strong> was renamed <a href="${scan(V1)}" target="_blank" rel="noopener">Sirius</a> and <strong>CaviarNine-2</strong> was renamed <a href="${scan(V2)}" target="_blank" rel="noopener">Polaris</a>, and both now give their website as <a href="https://cadwynbloc.com/" target="_blank" rel="noopener">Cadwynbloc</a>, a firm that runs community channels, operations and hosting for other projects. The owner badges of both validators sit where they have sat since before the announcement, so the renaming was done by whoever already controlled them.</p>
<p>On 23 September both validators queued a fee change from 0% to <strong>25%</strong> of staking rewards. It is recorded on the ledger and takes effect at epoch 347,421, around 7 October 2026; until then both still charge nothing. Read at epoch 344,019 on 25 September, Sirius held 111.5m XRD of delegated stake and Polaris 113.8m, against 113.6m and 115.6m on 31 August. Delegators who do not want to pay the new fee can unstake or move to another validator before it applies.</p>
`;

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
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }

  const block = blocks.find((b) => b.text?.includes(ANCHOR));
  if (!block) throw new Error('anchor not found');
  block.text = block.text.replace(ANCHOR, SECTION + ANCHOR);

  const version = '5.6.0';
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
        'New section: CaviarNine-1 and CaviarNine-2 renamed Sirius and Polaris (17–19 Sep, website cadwynbloc.com, owner badges unmoved) and a 0% to 25% fee queued on 23 Sep for epoch 347,421 (about 7 Oct). Gateway reads pinned by at_ledger_state; stake read at epoch 344,019.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
