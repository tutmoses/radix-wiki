import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'dexter';
const SENTINEL = 'What the project left on the ledger';
const ANCHOR = '<h2>Community &amp; Impact</h2>';

const NEW_SECTION = `<h2>What the project left on the ledger</h2>
<p>A closed Radix project does not disappear from the ledger; it stops moving on it. Read live at <strong>epoch 339,247</strong> on 29 August 2026, the <a href="https://dashboard.radixdlt.com/resource/resource_rdx1tkktjr0ew96se7wpsqxxvhp2vr67jc8anq04r5xkgxq3f0rg9pcj0c" target="_blank" rel="noopener">DEXTR resource</a> still holds the same <strong>4,739,465.133049414416099876</strong> supply recorded a month earlier, and the last transaction that touched it committed on <a href="https://dashboard.radixdlt.com/transaction/txid_rdx1f5x7qjgux9xuw26thfnd992hu6pfcs4dkrhw25tguaxsey74r2ksyn3uy4" target="_blank" rel="noopener">26 February 2026 at 22:48&nbsp;UTC</a>, at epoch 286,346. That is ten days <em>before</em> the wind-down was confirmed on 8 March, and six months of complete silence since: on-ledger, the project stopped a fortnight ahead of the announcement that it had.</p>
<p>What the ledger does still carry is a set of pointers to infrastructure that no longer exists. The resource&rsquo;s own <a href="/contents/tech/core-concepts/metadata-module" rel="noopener">metadata</a> gives <code>icon_url</code> as <code>content.dexteronradix.com/dextricon.png</code>, <code>ico_url</code> as an <code>ipfs.dexteronradix.com</code> gateway path, and <code>info_url</code> as the GitBook documentation. The GitBook returns 404, and neither subdomain has any DNS record at all &ndash; the apex is parked on GoDaddy nameservers and the asset hosts were never re-pointed. Because that metadata is what wallets and explorers read, every surface that displays DEXTR renders a broken icon and links to a dead page. Radix resource metadata is mutable by whoever holds the metadata-setter role, so this is a task nobody was left to do rather than something the ledger has locked in.</p>
<p>The token also still has a market, of a kind. Its <a href="https://ociswap.com/dextr" target="_blank" rel="noopener">DEXTR/XRD pool on Ociswap</a>, listed on 19 January 2024, held <strong>80,950.50 DEXTR against 30,492.85 XRD</strong> when read on 29 August 2026 &ndash; about <strong>$27.71</strong> of liquidity by Ociswap&rsquo;s own reckoning, at a quoted 0.2592 XRD per DEXTR &ndash; with <strong>zero volume</strong> over the previous hour, day and week, against a lifetime 4,089,422 DEXTR and 3,279,923 XRD traded. The buy-back the retirement proposal funded never had to compete with anyone.</p>
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
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const body = blocks.find((b) => (b.text || '').includes(ANCHOR));
  if (!body) throw new Error('anchor not found');
  body.text = body.text.replace(ANCHOR, NEW_SECTION + '\n' + ANCHOR);

  const version = '4.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  blocks.forEach((b, i) => {
    const before = page.content[i].text || '';
    if (before !== (b.text || '')) console.log(`  block[${i}] ${b.type}: ${before.length} -> ${(b.text || '').length} B`);
  });
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'New section on what the retired project still holds on-ledger, read at epoch 339,247: supply unchanged, last DEXTR transaction 26 Feb 2026 (ten days before the wind-down was confirmed), resource metadata still pointing at an icon host and IPFS gateway with no DNS record and a 404 GitBook, and an Ociswap pool with $27.71 of liquidity and zero weekly volume.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
