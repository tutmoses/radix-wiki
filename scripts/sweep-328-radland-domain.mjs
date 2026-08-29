import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'radland';
const SENTINEL = 'the redirect itself has now gone';

const OLD_INFOBOX_ROW = '<tr><td><strong>Domain</strong></td><td>radland.io re-registered; redirects off-network</td></tr>';
const NEW_INFOBOX_ROW = '<tr><td><strong>Domain</strong></td><td>radland.io re-registered; parked and unreachable (checked 29 August 2026)</td></tr>';

const OLD_P = '<p>RadLand is closed. As of 2026-07-30 the marketplace host <code>app.radland.io</code> has no DNS record at all, and the apex domain <code>radland.io</code> has been re-registered: it answers HTTP 200 and issues a 301 redirect to <code>www.earnforex.com</code>, an unrelated forex-affiliate page carrying a <code>utm_campaign=radland.io</code> tag. Nothing at the live domain is connected to the project or to Radix.</p>';

const NEW_P = `<p>RadLand is closed, and its domain has since changed hands twice over. On 30 July 2026 <code>app.radland.io</code> had no DNS record at all while the re-registered apex <code>radland.io</code> answered HTTP 200 and issued a 301 to <code>www.earnforex.com</code>, an unrelated forex-affiliate page carrying a <code>utm_campaign=radland.io</code> tag. Re-checked on <strong>29 August 2026</strong>, the redirect itself has now gone: both <code>radland.io</code> and <code>app.radland.io</code> resolve to <code>185.53.179.128</code> on the parking nameservers <code>ns1.dyna-ns.net</code> and <code>ns2.dyna-ns.net</code>, and that host accepts TCP on ports 80 and 443 while returning nothing on HTTP and failing the TLS handshake outright on HTTPS. The marketplace subdomain has its DNS back and still serves no marketplace. Nothing at either name is connected to the project or to Radix.</p>`;

const NEW_TAIL = `<p>The month between those two readings is the useful part. A re-registered domain is not a fixed state that a page can record once: it moved from an affiliate redirect that a link checker scores as healthy, to a host that answers at the TCP level and nothing above it, which a checker scores as a timeout. Neither reading tells a reader anything about RadLand, and only a dated one tells them that.</p>`;

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
  const hay = JSON.stringify(blocks);
  if (hay.includes(SENTINEL)) { console.log('  already applied — no write'); process.exit(0); }

  const info = blocks.find((b) => b.type === 'infobox');
  const infoInner = info && info.blocks.find((y) => (y.text || '').includes(OLD_INFOBOX_ROW));
  if (!infoInner) throw new Error('infobox domain row not found');
  infoInner.text = infoInner.text.replace(OLD_INFOBOX_ROW, NEW_INFOBOX_ROW);

  const body = blocks.find((b) => (b.text || '').includes(OLD_P));
  if (!body) throw new Error('shutdown paragraph not found');
  body.text = body.text.replace(OLD_P, NEW_P) + '\n' + NEW_TAIL;

  const version = '2.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  blocks.forEach((b, i) => {
    const a = JSON.stringify(page.content[i]), c = JSON.stringify(b);
    if (a !== c) console.log(`  block[${i}] ${b.type}: ${a.length} -> ${c.length} B`);
  });
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'The published domain status was a month old and no longer true: the 301 to earnforex.com is gone. Re-read 29 August 2026, radland.io and app.radland.io both resolve to a parking host that accepts TCP on 80 and 443 and answers nothing on either. Infobox row and shutdown section updated and dated.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
