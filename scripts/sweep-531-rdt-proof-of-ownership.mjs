// Sweep 531: /developers/frontend/01-radix-dapp-toolkit showed the connect-time
// persona().withProof() request but not the one-time re-proof. Run 519 banked it after
// rewriting ROLA's How It Works. Source: the dapp-toolkit README at main (RDT 2.3.0 on npm,
// read 4 Oct 2026): OneTimeDataRequestBuilder.proofOfOwnership() takes .identity(address)
// or .accounts([...]) and needs provideChallengeGenerator configured.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'developers/frontend';
const SLUG = '01-radix-dapp-toolkit';
const BLOCK_ID = '46913f22-cae4-42d4-a291-9d0484366319';
const SENTINEL = 'OneTimeDataRequestBuilder.proofOfOwnership()';
const README = 'https://github.com/radixdlt/radix-dapp-toolkit/blob/main/packages/dapp-toolkit/README.md';
const ADD = `
<h3>Re-proving ownership later</h3>
<p>The connect-time request proves the Persona once, at login. To ask for a fresh proof later, before an admin action for example, send a one-time request instead of reconnecting. <a href="${README}" target="_blank" rel="noopener"><code>OneTimeDataRequestBuilder.proofOfOwnership()</code></a> takes either <code>.identity(address)</code> for a Persona or <code>.accounts([...])</code> for accounts, and the wallet answers with a signed challenge for each:</p>
<pre><code>import { OneTimeDataRequestBuilder } from '@radixdlt/radix-dapp-toolkit'

rdt.walletApi.sendOneTimeRequest(
  OneTimeDataRequestBuilder.proofOfOwnership().identity(currentUser.identity),
)</code></pre>
<p>It uses the same challenge generator as the login request, so a dApp that has not called <code>provideChallengeGenerator</code> cannot send it. The backend verifies the returned proofs exactly as it verifies a login, per <a href="/developers/frontend/03-rola-authentication" rel="noopener">ROLA</a>.</p>`;
const DRY = process.argv.includes('--dry-run');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied – no write'); process.exit(0); }

  const block = blocks.find((b) => b.id === BLOCK_ID);
  if (!block?.text?.endsWith('</code></pre>')) throw new Error('auth block not found or changed shape');
  block.text += ADD;

  const version = '1.6.0';
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
        'Sweep 531: new subsection "Re-proving ownership later" on OneTimeDataRequestBuilder.proofOfOwnership() (.identity / .accounts, needs provideChallengeGenerator), from the radix-dapp-toolkit README at main; RDT 2.3.0 on npm, read 4 October 2026.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
