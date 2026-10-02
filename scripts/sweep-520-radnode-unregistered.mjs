// Sweep 520: /ecosystem/radnode re-read against the ledger and the archive, 2 Oct 2026.
// The page was the project's own marketing copy, unsourced, and described a validator that is
// no longer registered. Read live: validator_rdx1sds4prp... (named "RADNODE" on ledger) is
// unregistered and refuses new stake, while delegators still hold stake there and were
// unstaking as late as 1 Oct. radnode.io answers Vercel DEPLOYMENT_NOT_FOUND; github.com/radnode
// has 0 public repos. The last archived radnode.io (14 Aug 2025) gave Radstakes' validator
// address as Radnode's and Radnode's as Radstakes'. Per the 1 Oct scope change, no fee figure:
// the validator's Radix Dashboard page carries the live numbers.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'radnode';
const SENTINEL = 'validator_rdx1sds4prpgf0p25pu458fg468nw9rtwqdawwg9w45hgf0t95yd3ncs09';
const VAL = 'validator_rdx1sds4prpgf0p25pu458fg468nw9rtwqdawwg9w45hgf0t95yd3ncs09';
const RADSTAKES = 'validator_rdx1sw5zkx2h6hp6k0js6dqaaxpz4580awncmm0rlzv7ufcf97cukjegy8';
const ARCHIVE = 'https://web.archive.org/web/20250814043918/https://radnode.io/';
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const dash = (addr) => `https://dashboard.radixdlt.com/validator/${addr}`;

const INFOBOX_ID = '20e87cc8-3cf3-4dc3-a55e-4a12d186346c';
const INFOBOX = '<table><tbody><tr><th colspan="2">Radnode</th></tr>'
  + '<tr><td><strong>Type</strong></td><td>Radix validator</td></tr>'
  + '<tr><td><strong>Since</strong></td><td>2021 (Betanet node-runner programme)</td></tr>'
  + `<tr><td><strong>Validator</strong></td><td>${a(dash(VAL), 'RADNODE on Radix Dashboard')}</td></tr>`
  + '<tr><td><strong>Status</strong></td><td>Dormant – validator unregistered, radnode.io offline</td></tr>'
  + `<tr><td><strong>Website</strong></td><td>radnode.io (offline; ${a(ARCHIVE, 'archived August 2025')})</td></tr>`
  + `<tr><td><strong>X</strong></td><td>${a('https://x.com/radnode', '@radnode')}</td></tr>`
  + '</tbody></table>';

const BODY_ID = 'block-radnode-1';
const BODY = `<p><strong>Radnode</strong> is a Radix validator run since 2021. Its ${a(dash(VAL), 'validator')} is no longer registered for consensus and does not accept new stake, and the project's website is gone.</p>`
  + '<h2>History</h2>'
  + `<p>Radnode's ${a(ARCHIVE, 'website')} described a node runner selected for the Radix Betanet programme and KYC-verified by the Radix Foundation, running bare-metal servers across several regions and charging delegators a 0.75% fee. The same page recommended four partner validators for delegators who wanted to spread their stake: Radstakes, RadUp, Avaunt Staking and Pica Finance. Its last roadmap, also on that page, planned a reorganisation of Radnode into a product called Stakesuite in the fourth quarter of 2024 and a Stakesuite Pro in the second quarter of 2025. No public trace of Stakesuite has been found.</p>`
  + '<h2>Status</h2>'
  + `<p>Read from the ledger on 2 October 2026, the validator named RADNODE is ${a(dash(VAL), 'unregistered')}: it is outside the active set, earns no emissions, and has switched off delegated stake. Stake that delegators placed there stays until each of them unstakes it, which some were still doing on ${a('https://dashboard.radixdlt.com/transaction/txid_rdx1z3gk22af89s8z4rgzy2ws5c6cu0j4mmw0ve4q0cz2hvm65ym54xq2a6ya5', '1 October 2026')}. The Radix Dashboard page linked above shows the stake that remains.</p>`
  + `<p>radnode.io now answers with Vercel's "deployment not found" error, and the ${a('https://github.com/radnode', 'radnode GitHub account')} holds no public repositories.</p>`
  + '<h2>Address on the archived site</h2>'
  + `<p>The last archived copy of radnode.io, from August 2025, gives Radnode's own address as <code>${RADSTAKES}</code> and lists <code>${VAL}</code> under Radstakes. On the ledger it is the other way round: the first is ${a(dash(RADSTAKES), 'Radstakes')} and the second is RADNODE. Anyone who delegated by copying the address from that page staked with the other validator.</p>`;

const DRY = process.argv.includes('--dry-run');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) { console.log('  already applied, no write'); process.exit(0); }
  const blocks = JSON.parse(JSON.stringify(page.content));
  const box = blocks[0]?.blocks?.find((b) => b.id === INFOBOX_ID);
  const body = blocks.find((b) => b.id === BODY_ID);
  if (!box || !body) throw new Error('expected blocks not found');
  box.text = INFOBOX;
  body.text = BODY;
  const metadata = { ...page.metadata, founded: '2021', website: 'radnode.io' };
  delete metadata.github;
  const json = JSON.stringify(blocks);
  if (/\u2014|\u00a0/.test(json)) throw new Error('em dash or nbsp in output');

  const version = '3.0.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`, JSON.stringify(metadata));
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, metadata=$2, version=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [json, JSON.stringify(metadata), version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'major', AUTHOR_ID,
        'Sweep 520: rewritten from unsourced marketing copy. Ledger read 2 Oct 2026: the RADNODE validator is unregistered and refuses new stake, delegators still unstaking. radnode.io is Vercel DEPLOYMENT_NOT_FOUND, github.com/radnode has no public repos. History sourced to the archived radnode.io (14 Aug 2025), which listed the Radnode and Radstakes validator addresses the wrong way round. Fee row replaced with the validator\'s Radix Dashboard link; metadata.github dropped.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
