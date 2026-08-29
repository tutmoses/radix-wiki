import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'radit';
const SENTINEL = 'Bye bye, hope to see you after Babylon!';

const NEW_SECTION = `
<h2><strong>Status today</strong></h2>
<p>Radit closed as an <a href="/contents/tech/releases/radix-mainnet-olympia" rel="noopener">Olympia</a>-era product and never reopened on <a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">Babylon</a>, but the domain did not go dark. Read on 29 August 2026, <code>radit.io</code> answers HTTP 200 &ndash; hosted on Vercel and redirecting to <code>www.radit.io</code> &ndash; and serves a single farewell card: &ldquo;Bye bye, hope to see you after Babylon!&rdquo;, followed by &ldquo;Something interesting is going on over there, tho? 👀&rdquo; and one link, to <a href="/ecosystem/caviarnine" rel="noopener">CaviarNine</a>. The board handed its visitors to the team&rsquo;s surviving project rather than expiring into a parked-domain lander, which is the more common end for a retired Radix front-end.</p>
<p>The consequence is that the $RADIT token still resolves properly everywhere it appears. The <a href="https://dashboard.radixdlt.com/resource/resource_rdx1th7jrjlpfz5dxtpa6v2thsxarqa5mgygcqm8qgm37ntyy6dj7l7dxs" target="_blank" rel="noopener">resource</a> carries a fixed <strong>100,000,000</strong> supply, and its on-ledger <a href="/contents/tech/core-concepts/metadata-module" rel="noopener">metadata</a> still points at a live host on both counts: <code>info_url</code> at <code>radit.io</code> and <code>icon_url</code> at <code>radit.io/radit32.png</code>, which returns a 2,555-byte PNG. That is the opposite outcome to <a href="/ecosystem/dexter" rel="noopener">DeXter</a>, whose token metadata points at an icon host and an IPFS gateway that have no DNS record left, so wallets render it broken. Whether a closed project&rsquo;s token still looks like anything is decided by whether somebody kept one small web host alive.</p>
<p>The token is also still traded. Ociswap, which <a href="https://ociswap.com/radit" target="_blank" rel="noopener">listed RADIT on 6 October 2023</a>, showed <strong>148,279.64 XRD against 3,489,171.29 RADIT</strong> in liquidity on 29 August 2026 &ndash; roughly $130 &ndash; with 1,583&nbsp;XRD of volume in the previous 24 hours and 4,114&nbsp;XRD over the previous week, against a lifetime 3,107,062&nbsp;XRD. Three and a half years after the board stopped taking messages, its governance token turns over a few thousand XRD a week.</p>
`.trim();

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

  blocks.push({ id: uid(), type: 'content', text: NEW_SECTION });

  const version = '2.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'The page was entirely past tense and never said what radit.io serves now. It is live: a Vercel-hosted farewell card pointing at CaviarNine. Adds the on-ledger position read 29 August 2026 - 100,000,000 fixed supply, metadata whose info_url and icon_url both still resolve (unlike DeXter’s), and an Ociswap pool still turning over about 4,100 XRD a week.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
