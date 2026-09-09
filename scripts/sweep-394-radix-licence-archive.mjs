import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 394, closing the ecosystem-rotation backlog item opened at run 393.
// www.radixfoundation.org still fails every TLS handshake: DNS points at
// proxy-ssl.webflow.com, the proxy answers a tlsv1 alert internal error with no
// peer certificate, and the port-80 nginx 301s to the https URL that fails.
// Re-probed 11:14 UTC on 9 September 2026, two days after the first reading.
// /ecosystem/radix-foundation and /ecosystem/rdx-works were already converted to
// Wayback captures; these two citations on /babylon-node are the last live ones
// on the wiki. Per the backlog instruction they keep the live URL and gain the
// archive capture alongside it, rather than being repointed.

const TAG_PATH = 'contents/tech/core-protocols';
const SLUG = 'babylon-node';
const SENTINEL = 'radix-licence-archive';
const DRY = process.argv.includes('--dry-run');

const LIVE = 'https://www.radixfoundation.org/licenses/license-v1';
const ARCH = 'https://web.archive.org/web/20230402033642/https://www.radixfoundation.org/licenses/license-v1';

const OLD_BOX = '<tr><th>Licence</th><td><a href="' + LIVE + '" target="_blank" rel="noopener">Radix License 1.0</a>, July 2021</td></tr>';
const NEW_BOX = '<tr><th>Licence</th><td><a href="' + LIVE + '" target="_blank" rel="noopener">Radix License 1.0</a>, July 2021; radixfoundation.org does not answer over HTTPS, so the text is readable only in the <a href="' + ARCH + '" target="_blank" rel="noopener" id="radix-licence-archive">2 April 2023 archive capture</a></td></tr>';

const OLD_LI = '<li><a href="' + LIVE + '" target="_blank" rel="noopener">Radix License 1.0</a></li>';
const NEW_LI = '<li><a href="' + LIVE + '" target="_blank" rel="noopener">Radix License 1.0</a> &ndash; the domain refuses every TLS handshake, read 9 September 2026; the text is in the <a href="' + ARCH + '" target="_blank" rel="noopener">Internet Archive capture of 2 April 2023</a></li>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  if (/\u00A0/.test(NEW_BOX + NEW_LI)) throw new Error('U+00A0 in new copy');
  if (/\u2014/.test(NEW_BOX + NEW_LI)) throw new Error('em dash in new copy');

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const box = blocks.find((b) => b.type === 'infobox');
  if (!box?.blocks?.[0]?.text?.includes(OLD_BOX)) throw new Error('licence row not matched');
  box.blocks[0].text = box.blocks[0].text.replace(OLD_BOX, NEW_BOX);

  const ext = blocks.find((b) => b.type === 'content' && b.text?.includes(OLD_LI));
  if (!ext) throw new Error('external links entry not matched');
  ext.text = ext.text.replace(OLD_LI, NEW_LI);

  const version = '1.2.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  infobox ${page.content.find((b) => b.id === box.id).blocks[0].text.length} -> ${box.blocks[0].text.length} chars`);
  console.log(`  block ${ext.id}: ${page.content.find((b) => b.id === ext.id).text.length} -> ${ext.text.length} chars`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       'The two Radix License 1.0 citations on this page were the last live radixfoundation.org links on the wiki, and the domain cannot be reached: its DNS points at proxy-ssl.webflow.com, the proxy answers a tlsv1 alert internal error with no peer certificate, and nginx on port 80 redirects to the HTTPS URL that fails. Re-probed 11:14 UTC on 9 September 2026. Both citations keep the live URL and gain the Internet Archive capture of 2 April 2023, which is the newest one carrying the licence text.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
