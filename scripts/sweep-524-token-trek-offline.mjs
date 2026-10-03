// Sweep 524: /ecosystem/token-trek, 3 Oct 2026. Ecosystem staleness head. tokentrek.io and
// www.tokentrek.io answer a Cloudflare 404 (read 03:06 UTC 3 Oct); app.tokentrek.io does not
// resolve. Wayback CDX holds only assets (23 May 2024) and /user/hi (20 Dec 2024), no root
// capture. The infobox Website row labelled tokentrek.io but linked the Radix blog post, so a
// reader could not tell the site was gone. Engage (TREK) is still listed on Ociswap
// (api.ociswap.com/tokens/resource_rdx1t42rr...). Status stays Dormant.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'token-trek';
const SENTINEL = 'tokentrek.io answers';
const OLD_ROW = '<tr><td><strong>Website</strong></td><td><a href="https://www.radixdlt.com/blog/welcome-to-token-trek" target="_blank" rel="noopener">tokentrek.io</a></td></tr>';
const NEW_ROW = '<tr><td><strong>Website</strong></td><td>tokentrek.io (offline)</td></tr>';
const OCI = 'https://ociswap.com/resource_rdx1t42rruapdsndh5anxye5kwus7c0qn5qxxpdych99z99sdwa56w2q24';
const NEW_P = `<p>The platform is no longer online: read on 3 October 2026, tokentrek.io answers 404, and the Internet Archive's last capture of the site dates from December 2024. The Engage (TREK) token is still <a href="${OCI}" target="_blank" rel="noopener">listed on Ociswap</a>.</p>`;
const OLD_LINK = '<li><a href="https://www.radixdlt.com/blog/welcome-to-token-trek" target="_blank" rel="noopener">Token Trek – Official Website</a></li>\n';

const DRY = process.argv.includes('--dry-run');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) { console.log('  already applied, no write'); process.exit(0); }
  const blocks = JSON.parse(JSON.stringify(page.content));
  const box = blocks[0].blocks[0];
  if (!box.text.includes(OLD_ROW)) throw new Error('infobox row not found');
  box.text = box.text.replace(OLD_ROW, NEW_ROW);
  const overview = blocks.find((b) => b.text?.startsWith('<h2>Overview</h2>'));
  if (!overview) throw new Error('overview not found');
  overview.text += NEW_P;
  const ext = blocks.find((b) => b.text?.startsWith('<h2>External Links</h2>'));
  if (!ext?.text.includes(OLD_LINK)) throw new Error('external link not found');
  ext.text = ext.text.replace(OLD_LINK, '');
  if (/\u2014|\u00a0/.test(NEW_P + NEW_ROW)) throw new Error('em dash or nbsp in new text');

  const version = '1.2.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (DRY) console.log(box.text, '\n', overview.text, '\n', ext.text);
  if (!DRY) {
    const json = JSON.stringify(blocks);
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 524: tokentrek.io answers 404 (Cloudflare, read 3 Oct 2026); last Wayback capture December 2024. The infobox Website row labelled tokentrek.io but linked the Radix blog, and the External Links list carried the blog post twice, once as the official website. Recorded the site as offline and noted TREK is still listed on Ociswap.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
