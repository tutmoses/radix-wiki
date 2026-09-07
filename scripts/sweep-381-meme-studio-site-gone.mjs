import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID } from './seed-utils.mjs';
import { isLockedPage } from '../src/lib/tags.ts';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'the-meme-studio';
const SENTINEL = 'the-site-went-dark';
const DRY = process.argv.includes('--dry-run');

const EDITS = [
  ['infobox',
   "🟠 Dormant – no Radix work established; the agency's own site carries a 2024 copyright",
   "🟠 Dormant – no Radix work established, and the agency's site went offline between 26 August and 7 September 2026"],
  ['infobox',
   '<strong>Measured</strong></td><td>26 August 2026</td>',
   '<strong>Measured</strong></td><td>26 August 2026; re-read 7 September 2026</td>'],
  ['body',
   'The Meme Studio is a real agency with a live site, its connection is unestablished,',
   'The Meme Studio was a real agency, its connection to Radix is unestablished,'],
  ['body',
   'Its <a href="https://thememestudio.com" target="_blank" rel="noopener">website</a> describes it as a creative agency',
   'Its website, now offline, described it as a creative agency'],
  ['body',
   'Its <a href="https://www.thememestudio.com/blog" target="_blank" rel="noopener">blog</a> is the same',
   'Its <a href="https://web.archive.org/web/20260608111131/https://www.thememestudio.com/blog" target="_blank" rel="noopener">blog</a> is the same'],
  ['body',
   '<li><a href="https://thememestudio.com" target="_blank" rel="noopener">The Meme Studio</a></li>',
   '<li><a href="https://web.archive.org/web/20260608111949/https://thememestudio.com/" target="_blank" rel="noopener">The Meme Studio</a> (Internet Archive, 8 June 2026; the live site no longer answers)</li>'],
];

const SECTION = `<h2 id="${SENTINEL}">The site went dark</h2>
<p>Re-read on <strong>7 September 2026</strong>, <code>thememestudio.com</code> no longer serves the agency&#39;s site. The domain still resolves, to the Wix name servers <code>ns4.wixdns.net</code> and <code>ns5.wixdns.net</code> and the addresses 185.230.63.107, .171 and .186, and <code>http://</code> still redirects to <code>https://</code>. Every path then answers <strong>HTTP 404</strong> with the same 2,517-byte page titled <q>ConnectYourDomain Error | Wix.com</q>, served <code>noindex</code>. That is the response Wix gives for a domain pointed at it with no site attached: the registration and the DNS survive, the site behind them does not. The root, <code>www</code> and <code>/blog</code> all return it.</p>
<p>The change is recent. The reading above, and the byte count this page cites for it, were taken on 26 August 2026 when the site answered in full; the newest capture in the <a href="https://web.archive.org/web/20260608111949/https://thememestudio.com/" target="_blank" rel="noopener">Internet Archive</a> is 8 June 2026 and returns 200. The site therefore went offline in the twelve days between this wiki&#39;s last read and this one, and the evidence for the finding above is now archival rather than checkable at the source.</p>
<p>The status stays Dormant rather than moving to Closed. Nothing read here establishes that the agency has wound up, only that the one public artefact it had is gone, and a domain left pointing at an empty Wix account is as consistent with a rebuild as with a closure. What it does settle is the direction of travel for this entry: a Radix connection was never established while the site was up, and it cannot now be established from a site that no longer answers.</p>`;

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

  const ib = blocks[0]?.blocks?.[0];
  const body = blocks[1];
  if (!ib || !body) throw new Error('expected infobox + body');

  for (const [where, from, to] of EDITS) {
    const target = where === 'infobox' ? ib : body;
    if (!target.text.includes(from)) throw new Error(`no match in ${where}: ${from.slice(0, 50)}`);
    target.text = target.text.replace(from, to);
    console.log(`  ${where}: replaced "${from.slice(0, 46)}..."`);
  }

  const MARK = '<h2>External Links</h2>';
  const cut = body.text.indexOf(MARK);
  if (cut < 0) throw new Error('External Links heading not found in body');
  const head = body.text.slice(0, cut).replace(/\s+$/, '');
  const tail = body.text.slice(cut);
  body.text = head;
  blocks.splice(blocks.indexOf(body) + 1, 0,
    { id: uid(), type: 'content', text: SECTION },
    { id: uid(), type: 'content', text: tail });

  const version = '3.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  status ${page.metadata?.status} unchanged  (${blocks.length} blocks)`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'thememestudio.com went offline between this wiki’s 26 August read and 7 September: DNS still points at Wix, every path returns a 404 ConnectYourDomain error, and the newest Wayback capture is 8 June. The page had described the agency as having a live site, which was its remaining verifiable claim. Status stays Dormant since an empty Wix account is not a wind-up; the site link in the intro is removed and the reading recorded.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
