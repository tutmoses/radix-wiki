// Run 400. proven.network and docs.proven.network both now serve the Cloudflare Registrar
// parking page - 1,513 bytes, title "Cloudflare Registrar", assets from
// parking.registrar.cloudflare.com - read twice at 11:09 and 11:11 UTC on 10 September 2026.
// The domain is not expired (RDAP: registered 2022-08-05, expires 2027-08-05, last changed
// 2026-08-12, Cloudflare nameservers); it is simply no longer pointed at a site. The whole
// proven-network GitHub org's newest push is 2025-11-14 and proven-node's is 2025-11-04.
// The page cited docs.proven.network forty times and none of those citations resolve any
// more, so every one is repointed at the newest full Wayback capture of the same page
// rather than dropped, and the status moves from "In development" to Dormant.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'proven-network';
const SENTINEL = 'Cloudflare Registrar parking page';
const DRY = process.argv.includes('--dry-run');

const W = (ts, url) => `https://web.archive.org/web/${ts}/${url}`;
// newest Wayback capture that renders the page, verified 200 on 10 September 2026
const ARCHIVE = {
  'https://docs.proven.network/': W('20260612143253', 'https://docs.proven.network/'),
  'https://docs.proven.network/the-trust-model-and-cryptography': W('20260612145054', 'https://docs.proven.network/the-trust-model-and-cryptography'),
  'https://docs.proven.network/coding-verifiable-components': W('20260115120837', 'https://docs.proven.network/coding-verifiable-components'),
  'https://docs.proven.network/storage-options': W('20260511201740', 'https://docs.proven.network/storage-options'),
  'https://docs.proven.network/http-based-components': W('20260115124602', 'https://docs.proven.network/http-based-components'),
  'https://docs.proven.network/integrating-the-front-end-sdk': W('20260511210612', 'https://docs.proven.network/integrating-the-front-end-sdk'),
  'https://proven.network': W('20251210072426', 'https://proven.network/'),
};

const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const STATUS = `<h2>Development Status</h2><p>Proven Network never announced a public mainnet or testnet launch, and both halves of its public presence have now stopped. Read twice on <strong>10 September 2026</strong>, at 11:09 and 11:11&nbsp;UTC, <code>proven.network</code> and <code>docs.proven.network</code> each return the same 1,513-byte ${SENTINEL}, titled <q>Cloudflare Registrar</q> and loading its assets from <code>parking.registrar.cloudflare.com</code>. The domain has not lapsed &ndash; the ${A('https://rdap.org/domain/proven.network', 'registry record')} shows it registered on 5 August 2022, paid through 5 August 2027, last changed on 12 August 2026, and still on Cloudflare nameservers. It is simply no longer pointed at a site. The last capture of the landing page in ${A('https://web.archive.org/web/20251210072426/https://proven.network/', 'the Internet Archive')} is 10 December 2025.</p>
<p>The code stopped earlier and more quietly. Across the ${A('https://github.com/proven-network', 'proven-network GitHub organisation')}&rsquo;s sixteen public repositories the newest push of any kind is <strong>14 November 2025</strong>, to ${A('https://github.com/proven-network/proven-2pc', 'proven-2pc')}; the primary ${A('https://github.com/proven-network/proven-node', 'proven-node')} repository last took a commit on 4 November 2025, a dependency bump. Nothing is archived and nothing is marked closed. On the evidence available the project is dormant rather than wound down, and this page records it that way.</p>
<p>Everything below this section was written from the project&rsquo;s own documentation while that documentation was online. Those citations now point at the newest ${A('https://web.archive.org/web/20260612143253/https://docs.proven.network/', 'Internet Archive capture')} of each page &ndash; June 2026 for the overview and the trust model, May 2026 for storage and the front-end SDK, January 2026 for the component guides &ndash; so the sourcing survives the site. The description they support is of a design, not of a running network.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied - no write'); process.exit(0); }

  // 1. Repoint every dead citation at its archive capture.
  let repointed = 0;
  const unmapped = new Set();
  const rewrite = (text) => text.replace(/href="(https:\/\/(?:docs\.)?proven\.network[^"]*)"/g, (m, url) => {
    const key = url.replace(/\/$/, '') === 'https://proven.network' ? 'https://proven.network' : url;
    const to = ARCHIVE[key];
    if (!to) { unmapped.add(url); return m; }
    repointed += 1;
    return `href="${to}"`;
  });
  const walk = (b) => { if (b.text) b.text = rewrite(b.text); (b.blocks || []).forEach(walk); };
  blocks.forEach(walk);
  if (unmapped.size) throw new Error(`unmapped proven.network URLs: ${[...unmapped].join(', ')}`);

  // 2. Infobox status and website rows.
  const box = blocks[0].blocks[0];
  const sub = (needle, repl, where) => {
    if (!box.text.includes(needle)) throw new Error(`${where}: not matched -> ${needle.slice(0, 70)}`);
    box.text = box.text.replace(needle, repl);
  };
  sub('&#128992; In development (pre-launch; no mainnet launch announced)',
      '&#128992; Dormant &mdash; no public launch; site and docs parked, newest repository push 14 November 2025 (read 10 September 2026)',
      'infobox status');
  sub(`<td><a href="${ARCHIVE['https://proven.network']}" target="_blank" rel="noopener">proven.network</a> &middot; <a href="${ARCHIVE['https://docs.proven.network/']}" target="_blank" rel="noopener">docs</a></td>`,
      `<td><code>proven.network</code> and <code>docs.proven.network</code> both serve a Cloudflare Registrar parking page. Archived: ${A(ARCHIVE['https://proven.network'], 'landing page')} &middot; ${A(ARCHIVE['https://docs.proven.network/'], 'docs')}</td>`,
      'infobox website');

  // 3. Replace the Development Status block.
  const at = blocks.findIndex((b) => (b.text || '').startsWith('<h2>Development Status</h2>'));
  if (at < 0) throw new Error('Development Status block not found');
  blocks[at] = { ...blocks[at], text: STATUS };

  const metadata = { ...(page.metadata || {}), status: '🟠 Dormant' };
  const version = '3.0.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  citations repointed: ${repointed}   status: ${page.metadata?.status} -> ${metadata.status}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, metadata=$2, version=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [json, JSON.stringify(metadata), version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'major', AUTHOR_ID,
       `Status to Dormant. proven.network and docs.proven.network both serve the Cloudflare Registrar parking page, read twice on 10 September 2026; the domain is paid through August 2027 and simply no longer points at a site. The GitHub organisation's newest push across sixteen repositories is 14 November 2025. All ${repointed} citations to the vanished documentation repointed at their newest Internet Archive captures rather than dropped, and the Development Status section rewritten with the readings.`,
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} catch (e) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('  FAILED:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
