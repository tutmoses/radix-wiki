import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'every path on the host answers';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const load = async (tagPath, slug) => {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
  if (!rows.length) throw new Error(`${tagPath}/${slug} not found`);
  return rows[0];
};

const NOW = new Date().toISOString();

const write = async (page, blocks, metadata, version, changeType, message) => {
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (DRY) return;
  const now = NOW;
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3, metadata=$4 WHERE id=$5',
    [json, version, now, JSON.stringify(metadata), page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, changeType, AUTHOR_ID, message, now]);
  await client.query('COMMIT');
};

const swap = (block, from, to) => {
  if (!block.text.includes(from)) throw new Error(`find-string missing: ${from.slice(0, 60)}`);
  block.text = block.text.replace(from, to);
};

try {
  // ---- 1. /developers/ai-agents/igentix ----
  const page = await load('developers/ai-agents', 'igentix');
  const blocks = JSON.parse(JSON.stringify(page.content));
  const flat = blocks.flatMap((b) => (b.type === 'infobox' ? b.blocks : [b]));
  if (flat.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  igentix already applied - no write');
  } else {
    const table = flat.find((b) => (b.text || '').includes('<strong>MCP endpoint</strong>'));
    swap(table,
      '<tr><td><strong>Type</strong></td><td>AI agent payments demo (MCP endpoint)</td></tr>',
      '<tr><td><strong>Type</strong></td><td>AI agent payments demo (MCP endpoint)</td></tr>\n<tr><td><strong>Status</strong></td><td>\u{1F7E0} Dormant – the demo host stopped serving on or about 30 August 2026</td></tr>');
    swap(table,
      '<tr><td><strong>Website</strong></td><td><a href="https://demo.igentix.app" target="_blank" rel="noopener">demo.igentix.app</a></td></tr>',
      '<tr><td><strong>Website</strong></td><td>demo.igentix.app (offline)</td></tr>');
    swap(table,
      '<tr><td><strong>MCP endpoint</strong></td><td><code>https://demo.igentix.app/mcp</code></td></tr>',
      '<tr><td><strong>MCP endpoint</strong></td><td><code>https://demo.igentix.app/mcp</code> (offline)</td></tr>');

    const connecting = flat.find((b) => (b.text || '').includes('Checked 19 August 2026'));
    swap(connecting,
      'Checked 19 August 2026: demo.igentix.app is live, and its MCP endpoint answers 405 to a GET because it accepts POST only.</p>',
      'Checked 19 August 2026, that endpoint was live and answered 405 to a GET because it accepts POST only; it no longer answers at all (see <a href="#the-demo-went-dark" rel="noopener">The demo went dark</a>).</p>');

    const notice = { id: uid(), type: 'content', text:
      '<h2 id="the-demo-went-dark">The demo went dark</h2>\n'
      + '<p>Read at <strong>07:05 UTC on 31 August 2026</strong>, ' + SENTINEL + ' a bare <code>404 page not found</code> \u2013 nineteen bytes of <code>text/plain</code>, the default a Go HTTP router returns when no route matches. That covers the demo gallery, the <code>/info</code> explainer, and the <code>/mcp</code> endpoint this page tells an agent to add as a connector, to both a GET and a JSON-RPC <code>initialize</code> over POST. The host is up: <code>demo.igentix.app</code> resolves to 193.200.238.116, terminates TLS on a Let\u2019s Encrypt certificate issued 12 August 2026 and valid to 10 November, and answers over HTTP/2. What is missing is the application behind the router.</p>\n'
      + '<p>The apex <code>igentix.app</code> resolves to the same address and now presents a self-signed <code>TRAEFIK DEFAULT CERT</code> whose validity begins <strong>30 August 2026 at 08:04:32 UTC</strong>, which dates the reverse proxy\u2019s restart and is the closest timestamp available for when the service stopped being routed. That is the day after the <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet reset</a> wiped the ledger Igentix ran on, though nothing published connects the two and the project has announced nothing. The rest of this page describes the demo as it worked while it was up.</p>' };
    blocks.splice(1, 0, notice);

    const links = flat.find((b) => (b.text || '').includes('<h2>External Links</h2>'));
    swap(links,
      '<li><a href="https://demo.igentix.app" target="_blank" rel="noopener">Igentix – demo gallery</a></li>\n<li><a href="https://demo.igentix.app/info" target="_blank" rel="noopener">x402 &amp; AP2, explained (Igentix)</a></li>',
      '<li>Igentix – demo gallery, <code>demo.igentix.app</code> (offline since on or about 30 August 2026)</li>\n<li>x402 &amp; AP2, explained, <code>demo.igentix.app/info</code> (offline)</li>');

    const metadata = { ...page.metadata, status: '\u{1F7E0} Dormant', last_verified_at: NOW };
    await write(page, blocks, metadata, '2.2.0', 'minor',
      'The demo is offline: every path on demo.igentix.app, including the /mcp connector this page documents, returns a bare 404 to GET and to a JSON-RPC initialize, read 07:05 UTC 31 August 2026. Status Testnet -> Dormant. The apex now serves a Traefik default certificate valid from 30 August 08:04:32 UTC, which dates the change.');
  }

  // ---- 2. /developers/radix-developer-resources ----
  const res = await load('developers', 'radix-developer-resources');
  const rblocks = JSON.parse(JSON.stringify(res.content));
  const OLD = '<a href="/developers/ai-agents/igentix" rel="noopener">Igentix</a> (<a target="_blank" rel="noopener noreferrer" class="link" href="https://demo.igentix.app">demo</a>) – an agent-payments demo on Stokenet that pairs x402 with AP2 and enforces the spending policy on-ledger.';
  const NEW = '<a href="/developers/ai-agents/igentix" rel="noopener">Igentix</a> – an agent-payments demo on Stokenet that pairs x402 with AP2 and enforces the spending policy on-ledger. Its demo host and MCP endpoint have returned 404 to every path since on or about 30 August 2026.';
  const rb = rblocks.find((b) => (b.text || '').includes(OLD));
  if (!rb) {
    if (rblocks.some((b) => (b.text || '').includes('returned 404 to every path'))) console.log('  resources already applied - no write');
    else throw new Error('resources find-string missing');
  } else {
    rb.text = rb.text.replace(OLD, NEW);
    await write(res, rblocks, res.metadata, '5.11.0', 'patch',
      'Igentix entry: its demo link is dead. Every path on demo.igentix.app returns a bare 404, read 07:05 UTC 31 August 2026, so the outbound link is dropped and the state noted.');
  }
} finally {
  client.release();
  await pool.end();
}
