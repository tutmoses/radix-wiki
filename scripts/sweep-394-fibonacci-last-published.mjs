import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 394, ecosystem rotation, staleness head. This page called the project
// dormant on the grounds of "no active product traffic", which is not a thing
// the web can be asked. fibonacci.fi is a Webflow site and Webflow stamps the
// publish date into the page source: it reads 9 November 2023. That is a date a
// reader can check, so it replaces the assertion.

const TAG_PATH = 'ecosystem';
const SLUG = 'fibonacci-finance';
const SENTINEL = 'id="fibonacci-last-published-2023"';
const DRY = process.argv.includes('--dry-run');

const OLD_STATUS = '<tr><td><strong>Status</strong></td><td>\u{1F7E0} Dormant – site online (<a href="https://www.fibonacci.fi" target="_blank" rel="noopener">fibonacci.fi</a>) but no active product traffic</td></tr>';
const NEW_STATUS = '<tr><td><strong>Status</strong></td><td>\u{1F7E0} Dormant – <a href="https://www.fibonacci.fi" target="_blank" rel="noopener">fibonacci.fi</a> answers, and says in its own source that it was last published on 9 November 2023 (read 9 September 2026)</td></tr>';

const SECTION =
  '<h2 id="fibonacci-last-published-2023">The site has not been republished since 2023</h2>'
  + '<p>This page records Fibonacci Finance as dormant rather than closed because <a href="https://www.fibonacci.fi" target="_blank" rel="noopener">fibonacci.fi</a> '
  + 'still answers. How long it has been standing still is something the site itself will say. It is built on '
  + '<a href="https://webflow.com" target="_blank" rel="noopener">Webflow</a>, which writes the publication date into the page source of everything it serves, and read on '
  + '9 September 2026 that line says <code>Last Published: Thu Nov 09 2023 18:04:08 GMT+0000</code>. Nothing on the site has changed in almost three years.</p>'
  + '<p>What the site says about Radix has not changed either. <a href="https://www.radixdlt.com" target="_blank" rel="noopener">Radix</a> appears on it once, as a logo in the partner strip, '
  + 'with no Radix product page and no mention of the API integration the 2023 material describes. The three products it advertises, a risk API, a risk terminal and risk reports, '
  + 'are described in general terms and route to an email address for a demo. The project’s X account, '
  + '<a href="https://x.com/fib_finance" target="_blank" rel="noopener">@fib_finance</a>, resolved on the same day, with a one-line bio reading <q>Institutional-Grade Alpha</q>.</p>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  if (/\u00A0/.test(SECTION + NEW_STATUS)) throw new Error('U+00A0 in new copy');
  if (/\u2014/.test(SECTION + NEW_STATUS)) throw new Error('em dash in new copy');

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
  if (!box?.blocks?.[0]?.text?.includes(OLD_STATUS)) throw new Error('status row not matched');
  box.blocks[0].text = box.blocks[0].text.replace(OLD_STATUS, NEW_STATUS);

  blocks.push({ id: uid(), type: 'content', text: SECTION });

  const version = '2.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  infobox ${page.content.find((b) => b.id === box.id).blocks[0].text.length} -> ${box.blocks[0].text.length} chars`);
  console.log(`  blocks ${page.content.length} -> ${blocks.length} (new section ${SECTION.length} chars)`);

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
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Dormant status given a date a reader can check. The infobox claimed "no active product traffic", which nothing can verify; fibonacci.fi is a Webflow site and its source carries Last Published: Thu Nov 09 2023 18:04:08 GMT+0000, read 9 September 2026. New section records that, that Radix now appears on the site only as a partner logo with no product page, and that @fib_finance still resolves.',
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
