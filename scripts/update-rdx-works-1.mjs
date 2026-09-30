import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'rdx-works';
const AFTER = 'f2f4d23b-38d1-4178-a93d-20502ab06e84'; // Corporate Status (Companies House)
const SENTINEL = 'XRD Holdings';

const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const XRD = '/contents/tech/core-protocols/xrd-token#founder-retention';

const text = `<h2>${SENTINEL}</h2>
<p>RDX Works was allocated the 2.4bn XRD Founder Retention when the Radix ledger launched and held it as a company treasury asset; the tokens now belong to its parent, RDX Holdings (${a('https://t.me/Trade_Radix/133572', 'Dan Hughes, Telegram')}). The <a href="${XRD}" rel="noopener">$XRD Token</a> page records every figure given for the holding. The group accounts to 31 March 2024, filed on 29 July 2025, record a 75m XRD dividend to shareholders in the year to March 2023, one of the two paid from the holding. They also state that on 31 May 2025 the group held £1.5m in cash and £19.0m of digital assets, £16.2m of it XRD and eXRD, and that its forecasts assumed selling its other tokens, but not XRD or eXRD, and drawing on a loan facility to meet its obligations. The directors reported a material uncertainty over the group's ability to continue as a going concern (${a('https://find-and-update.company-information.service.gov.uk/company/14648189/filing-history', 'Companies House')}).</p>
<p>On the ledger, RDX's XRD can be followed from the 1,166.67m it put into the Radix Endowment Fund in September 2024. After that stake came back in January 2026, the group consolidated it with other wallets into seven accounts, which held 1.49bn XRD on 30 September 2026. RDX Holdings said in January 2026 that it had no plans to sell. Since July 2026 four of the seven accounts have sent 233m XRD to a deposit address that forwards everything to an account with the traffic of an exchange wallet. The accounts and the transfers are listed on the <a href="${XRD}" rel="noopener">$XRD Token</a> page.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(`<h2>${SENTINEL}</h2>`))) {
    console.log('  already applied – no write');
    process.exit(0);
  }
  const i = blocks.findIndex((b) => b.id === AFTER);
  if (i < 0) throw new Error('anchor block not found');
  blocks.splice(i + 1, 0, { id: uid(), type: 'content', text });

  const version = '3.5.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}, +1 block after index ${i}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'New XRD Holdings section: the Founder Retention now owned by RDX Holdings, the group accounts to 31 March 2024 (31 May 2025: £16.2m XRD and eXRD, £1.5m cash, going-concern uncertainty), and the ledger trail summarised from the $XRD Token page (1.49bn XRD in seven accounts; 233m to an exchange deposit address since July 2026).', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
