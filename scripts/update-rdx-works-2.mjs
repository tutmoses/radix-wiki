import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'rdx-works';
const OLD = '<p>In October 2020, RDX Works <a target="_blank" rel="noopener noreferrer nofollow" class="link" href="https://www.uktechnews.info/2020/10/29/radix-dlt-secures-9-82-million-series-a-follow-on-investment/">raised £9.82m</a> from its token sale of $eXRD.</p>';
const ECON = 'https://assets.website-files.com/6053f7fca5bf627283b582c2/6088147cbbc08674b4975349_Economic-2020-V10.4.pdf';
const NEW = `<p>The public sale of eXRD, the Ethereum token later swapped 1:1 for XRD, ran from 8 to 22 October 2020 and <a href="https://www.uktechnews.info/2020/10/29/radix-dlt-secures-9-82-million-series-a-follow-on-investment/" target="_blank" rel="noopener">raised 12.7m USD</a> (about £9.82m) from 652 buyers. RDX Works did not receive it: the seller was Radix Tokens (Jersey) Ltd, the <a href="/ecosystem/radix-foundation" rel="noopener">Radix Foundation</a>'s token issuer, and the receipts went to that company's endowment (<a href="${ECON}" target="_blank" rel="noopener">Radix Economic Model, p. 6</a>). RDX Works took no eXRD and was allocated the Founder Retention instead (see XRD Holdings below).</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes('RDX Works did not receive it'))) {
    console.log('  already applied – no write');
    process.exit(0);
  }
  const b = blocks.find((x) => x.text?.includes(OLD));
  if (!b) throw new Error('old sentence not found');
  b.text = b.text.replace(OLD, NEW);

  const version = '3.5.1';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
        'Corrected the October 2020 eXRD sale: it raised 12.7m USD (about £9.82m) for Radix Tokens (Jersey), the Foundation\'s token issuer, not for RDX Works, per the Radix Economic Model (p. 6, published by RTJ). RDX Works took no eXRD and held the Founder Retention instead.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
