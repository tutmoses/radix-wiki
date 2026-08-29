import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/history';
const SLUG = 'partnerships';
const SENTINEL = 'Where the partners are now';
const DRY = process.argv.includes('--dry-run');

const NEW_SECTION = `
<h3>Where the partners are now</h3>
<p>An archive of announcements is only as useful as the reader&rsquo;s ability to tell which of the parties still exists. Every domain this page links was read on <strong>29 August 2026</strong>. Five answer normally under the same name: <a href="https://quantstamp.com" target="_blank" rel="noopener">Quantstamp</a>, <a href="https://objectcomputing.com" target="_blank" rel="noopener">Object Computing</a>, <a href="https://copper.co" target="_blank" rel="noopener">Copper</a> &ndash; which also appears in this wiki&rsquo;s record of the <a href="/contents/history/radix-ecosystem-funding" rel="noopener">Radix Endowment Fund</a> &ndash; the <a href="https://expolab.org" target="_blank" rel="noopener">ExpoLab</a> research group, and <a href="https://www.stakingrewards.com" target="_blank" rel="noopener">Staking Rewards</a>.</p>
<p>Two do not. <strong>Argent</strong>, the wallet named in the August 2020 announcement, no longer answers under that name: <code>www.argent.xyz</code> returns an HTTP 301 to <code>ready.co</code>, and so does its blog path, so the link in the table above lands on a differently-named product. <strong>Ren Protocol</strong> is the one entry on this page with no link at all, and that is now the accurate state of it: <code>renproject.io</code> still resolves in DNS &ndash; to <code>162.255.119.181</code>, on registrar nameservers &ndash; but returns nothing at all over HTTP, timing out twice at thirty seconds. A domain that resolves without answering is parked rather than served.</p>
<p>Neither is a dead link on this page, and neither changes what was announced at the time. They are recorded here because a partnership archive that quietly implies all its counterparties are still trading is misleading in a way no link checker will catch.</p>
`;

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
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const TAIL = 'formally closing the era of Foundation-led partnership announcements archived on this page.</p>';
  if (!blocks[2].text.includes(TAIL)) throw new Error('block 2 tail anchor missing');
  blocks[2].text = blocks[2].text.trimEnd() + '\n' + NEW_SECTION.trim() + '\n';

  const version = '1.2.0';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  block2 ${page.content[2].text.length} -> ${blocks[2].text.length} B`);
  if (!DRY) {
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'First verification pass on this page. Adds a measured status for every counterparty in the archive, read 29 August 2026: five domains answer under the same name, argent.xyz now 301-redirects to ready.co, and renproject.io resolves in DNS without answering over HTTP. Neither is a broken link, which is why a link audit had not surfaced either.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
