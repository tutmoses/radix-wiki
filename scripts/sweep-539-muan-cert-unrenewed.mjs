// Sweep 539: /ecosystem/muan-protocol recorded on 2 Sep 2026 that the single Let's Encrypt
// certificate covering muanprotocol.com and testnet.muanprotocol.com expired at 08:32:40 UTC that
// day. Re-read 15:05 UTC 5 Oct 2026: the hosts still present the same certificate (notBefore
// 4 Jun, notAfter 2 Sep, issuer Let's Encrypt YR1), a validating request fails, and a request that
// skips validation returns the same upgrade notice (7,501 bytes) and app shell (17,163 bytes).
// Infobox status and the dated section re-dated; status value left as it is (the team has
// announced nothing, and an unrenewed certificate is not a statement that work has stopped).
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'muan-protocol';
const SENTINEL = 'Re-read at 15:05 UTC on 5 October 2026';
const STATUS_OLD = 'both sites behind an expired certificate since 2 September 2026)';
const STATUS_NEW = 'both sites behind an expired certificate since 2 September 2026, still unrenewed on 5 October)';
const SECTION_ANCHOR = 'both open an interstitial before a reader sees the page.</p>';
const SECTION_ADD = `<p>${SENTINEL}, nothing has moved. Both hosts still present the certificate that expired on 2 September, so a browser still shows the warning, and behind it they still serve the same upgrade notice and the same application shell, byte for byte. The certificate has now been expired for 33 days. The team has said nothing about it, so this page keeps the project's own description of its state: the interface is paused while V2 is prepared, and the positions on the ledger are untouched.</p>`;
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

  const walk = (bs) => bs.flatMap((b) => (b.blocks ? walk(b.blocks) : [b]));
  const leaves = walk(blocks);
  const infobox = leaves.find((b) => b.text?.includes(STATUS_OLD));
  if (!infobox) throw new Error('status anchor not found');
  infobox.text = infobox.text.replace(STATUS_OLD, STATUS_NEW);
  const section = leaves.find((b) => b.text?.includes(SECTION_ANCHOR));
  if (!section) throw new Error('section anchor not found');
  section.text = section.text.replace(SECTION_ANCHOR, SECTION_ANCHOR + SECTION_ADD);

  const version = '1.4.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
        'Sweep 539: certificate section and infobox status re-dated to 5 Oct 2026. Both hosts still present the Let\'s Encrypt certificate that expired 08:32:40 UTC 2 Sep (openssl s_client), and still serve the same upgrade notice (7,501 bytes) and app shell (17,163 bytes).', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
