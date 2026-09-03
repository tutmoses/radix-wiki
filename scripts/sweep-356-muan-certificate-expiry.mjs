import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 356, ecosystem rotation. Read at 23:00 UTC on 2 September 2026:
//   openssl s_client muanprotocol.com  -> notBefore Jun  4 08:32:41 2026 GMT, notAfter Sep  2 08:32:40 2026 GMT
//   curl https://muanprotocol.com            -> 000 (certificate has expired);  curl -k -> 200, 7,501 bytes
//   curl https://testnet.muanprotocol.com    -> 000 (same certificate);         curl -k -> 200, 17,163 bytes
// The hosts are up and unchanged. Only the certificate lapsed, and it covers both names.

const TAG_PATH = 'ecosystem';
const SLUG = 'muan-protocol';
const VERSION = '1.4.0';
const SENTINEL = 'expired at <strong>08:32:40';

const STATUS_OLD = '<tr><td><strong>Status</strong></td><td>In development (mainnet interface paused pending V2)</td></tr>';
const STATUS_NEW = '<tr><td><strong>Status</strong></td><td>In development (mainnet interface paused pending V2; both sites behind an expired certificate since 2 September 2026)</td></tr>';

const SECTION = `<h2>The certificate expired and both sites went behind a browser warning (2 September 2026)</h2>
<p>Read at <strong>23:00 UTC on 2 September 2026</strong>, neither address this page points a reader at opens in a browser without a security warning. Both hosts are up and their content is unchanged: a request that skips certificate validation returns the same upgrade notice as before, 7,501 bytes from <a href="https://muanprotocol.com" target="_blank" rel="noopener">muanprotocol.com</a>, and the application shell, 17,163 bytes from the <a href="https://testnet.muanprotocol.com" target="_blank" rel="noopener">Stokenet instance</a>. A single <a href="https://letsencrypt.org/docs/faq/" target="_blank" rel="noopener">Let's Encrypt</a> certificate covers both names. It was issued on 4 June 2026 and expired at <strong>08:32:40 UTC on 2 September 2026</strong>, fourteen and a half hours before this reading.</p>
<p>Let's Encrypt issues for ninety days and expects renewal at sixty, so a certificate that runs to its final day is one whose renewal has not completed for about a month. Nothing else about the deployment has changed and the project has announced nothing. Those two addresses are the only public surfaces Muan has, and since this morning both open an interstitial before a reader sees the page.</p>`;

const MESSAGE = "The site went behind a browser certificate warning this morning. The Let's Encrypt certificate covering muanprotocol.com and testnet.muanprotocol.com was issued 4 June 2026 and expired at 08:32:40 UTC on 2 September 2026; both hosts still answer and still serve the same bytes behind -k (7,501 and 17,163), so the deployment is up and only the renewal has lapsed. New dated section plus an infobox status note.";

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const [label, s] of [['STATUS_NEW', STATUS_NEW], ['SECTION', SECTION], ['STATUS_OLD', STATUS_OLD]]) {
    if (s.includes(' ')) throw new Error(`${label} carries U+00A0`);
    if (s.includes('—')) throw new Error(`${label} carries an em dash`);
  }
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  const flat = JSON.stringify(blocks);
  if (flat.includes(SENTINEL)) { console.log('  already applied - no write'); process.exit(0); }

  const info = blocks[0];
  if (info.type !== 'infobox' || !info.blocks?.[0]?.text?.includes(STATUS_OLD)) throw new Error('status row find-string did not match');
  info.blocks[0].text = info.blocks[0].text.replace(STATUS_OLD, STATUS_NEW);

  const extIdx = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes('<h2>External Links</h2>'));
  if (extIdx < 0) throw new Error('External Links block not found');
  blocks.splice(extIdx, 0, { id: uid(), type: 'content', text: SECTION });

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  ${page.content.length} blocks -> ${blocks.length}, section inserted at ${extIdx}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now]);
    await client.query('COMMIT');
    console.log('    written');
  }
} finally {
  client.release();
  await pool.end();
}
