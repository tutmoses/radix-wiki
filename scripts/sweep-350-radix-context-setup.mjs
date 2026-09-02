import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 350 (developers rotation, staleness head). The page said ./setup.sh clones 7 companion
// repositories and then listed 6. setup.sh actually clones 11, and 10 of the 11 use SSH
// remotes (git@github.com:), so the step fails outright without a GitHub SSH key.
// Read from https://raw.githubusercontent.com/xstelea/radix-context/main/setup.sh, 2026-09-01.
const TAG_PATH = 'developers/ai-agents';
const SLUG = 'radix-context';
const SENTINEL = 'clones eleven repositories';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2>Companion Repositories</h2>
<p>Running <code>./setup.sh</code> clones eleven repositories into <code>.repos/</code> for source-level context – the context files reference them by path, so an agent can read the actual implementation rather than a summary of it:</p>
<ul>
<li><a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a> – <a href="/developers/scrypto/01-fundamentals" rel="noopener">Scrypto</a> and the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> (<code>develop</code> branch)</li>
<li><a href="https://github.com/radixdlt/radix-engine-toolkit" target="_blank" rel="noopener">radix-engine-toolkit</a> and <a href="https://github.com/radixdlt/typescript-radix-engine-toolkit" target="_blank" rel="noopener">typescript-radix-engine-toolkit</a> – <a href="/developers/transactions/04-radix-engine-toolkit" rel="noopener">transaction construction and SBOR</a>, in Rust and TypeScript</li>
<li><a href="https://github.com/radixdlt/radix-dapp-toolkit" target="_blank" rel="noopener">radix-dapp-toolkit</a> and <a href="https://github.com/radixdlt/rola" target="_blank" rel="noopener">rola</a> – wallet connection and <a href="/developers/frontend/03-rola-authentication" rel="noopener">off-ledger authentication</a></li>
<li><a href="https://github.com/xstelea/radix-web3.js" target="_blank" rel="noopener">radix-web3.js</a> – the author's own TypeScript client</li>
<li><a href="https://github.com/ociswap/radix-client" target="_blank" rel="noopener">radix-gateway-api-rust</a> – Rust <a href="https://docs.radixdlt.com/docs/network-gateway" target="_blank" rel="noopener">Gateway API</a> client, by Ociswap</li>
<li><a href="https://github.com/radixdlt/consultation_v2" target="_blank" rel="noopener">consultation_v2</a> – reference dApp implementation</li>
<li><a href="https://github.com/gguuttss/radix-docs" target="_blank" rel="noopener">radix-docs</a> – a community mirror of the documentation</li>
<li><a href="https://github.com/TanStack/router" target="_blank" rel="noopener">TanStack Router</a> and <a href="https://github.com/Effect-TS/effect" target="_blank" rel="noopener">Effect</a> – the frontend stack the Effect context files assume</li>
</ul>
<div data-callout="warning"><div><p data-callout-title><code>setup.sh</code> needs a GitHub SSH key</p><p>Ten of the eleven clones use SSH remotes (<code>git@github.com:…</code>); only <code>radix-dapp-toolkit</code> is fetched over HTTPS. Without a key registered on your GitHub account the script fails on its first clone. The one-line <code>install.sh</code> above has no such dependency – it is only the optional companion-repository step that does.</p></div></div>`;

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

  const at = blocks.findIndex((b) => (b.text || '').includes('<h2>Companion Repositories</h2>'));
  if (at < 0) throw new Error('Companion Repositories section not found');
  blocks[at] = { id: blocks[at].id ?? uid(), type: 'content', text: SECTION };

  const version = '2.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (replace block ${at}, ${blocks.length} blocks)`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Correct the Companion Repositories section: setup.sh clones eleven repositories, not seven, and the page listed six. All eleven now listed and linked, plus a warning that ten of the clones use SSH remotes so the step fails without a GitHub SSH key. Read from setup.sh on 2026-09-01.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
