import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/core-protocols';
const SLUG = 'xrd-token';
const AFTER = 'fae6b28f-6fe0-4a7d-9662-792a4ad0f1a3'; // Supply and Emissions
const SENTINEL = 'Founder Retention and Genesis Crew Holdings';

const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const tg = (path, text) => a(`https://t.me/${path}`, text);
const ECON = 'https://assets.website-files.com/6053f7fca5bf627283b582c2/6088147cbbc08674b4975349_Economic-2020-V10.4.pdf';

const intro = `<h2>${SENTINEL}</h2>
<p>Two of the genesis allocations went to private holders rather than to token buyers or the Foundation: the Founder Retention, 2.4bn XRD, to RDX Works, the company that built Radix; and the Radix Community allocation, up to 3bn XRD, to the early backers the community calls the Genesis Crew, or GC (${a(ECON, 'Radix Economic Model, p. 13')}). Every token in both has been transferable since the <a href="/contents/history/token-unlock" rel="noopener">September 2021 unlock</a>. Neither holder labels its accounts on the ledger, so what remains of either is known only from what the holders have said.</p>
<h3>Founder Retention</h3>
<p>RDX Works (formerly Radix DLT Ltd) holds the Founder Retention as a company treasury asset, not in the names of individuals. Investors bought about 10% of the company for 6m USD in 2018 and 2019, which the economic model describes as exposure to those tokens. Each figure given for the holding since genesis:</p>
<table><tbody>
<tr><th>Date</th><th>Holding</th><th>Source</th></tr>
<tr><td>July 2021</td><td>2.4bn XRD at genesis</td><td>${a(ECON, 'Radix Economic Model')}</td></tr>
<tr><td>January 2022</td><td>Plan to release up to 75m XRD a quarter to shareholders and option holders, about 1.2bn over four years</td><td>${a('https://www.radixdlt.com/blog/founder-retention-notice-from-rdx-works-limited', 'RDX Works notice')}</td></tr>
<tr><td>February 2024</td><td>2.25bn XRD, after two 75m distributions; further distributions paused</td><td>${a('https://www.radixdlt.com/blog/rtjl-token-holdings-update', 'RTJL holdings update')}</td></tr>
<tr><td>February 2025</td><td>1.1bn XRD ring-fenced as the founder share, movable only with Dan Hughes's sign-off, plus an estimated 700m to 800m XRD of working capital</td><td>${tg('radix_dlt/862185', 'Dan Hughes, Telegram')}</td></tr>
<tr><td>July 2025</td><td>About 2bn XRD</td><td>${tg('Trade_Radix/133557', 'Dan Hughes, Telegram')}</td></tr>
<tr><td>January 2026</td><td>"A substantial amount", no figure</td><td>${tg('radix_dlt/963124', 'RDX Holdings, Telegram')}</td></tr>
</tbody></table>`;

const moves = `<p>Some of the holding has left or been pledged. RDX Works and the Foundation both contributed XRD, in shares neither has disclosed, to the 1.5bn XRD <a href="/contents/history/radix-ecosystem-funding" rel="noopener">Radix Endowment Fund</a> in 2024 (${tg('radix_dlt/775383', 'Adam Simmons')}). In January 2025 RDX pledged XRD as collateral for a loan of up to 10m USD, depositing the first 17m XRD at KuCoin (${tg('radix_dlt/833223', 'Piers Ridyard')}); RDX Holdings said in February 2026 that less than 10% of the facility was drawn (${tg('radix_dlt/975655', 'RDX Holdings')}). RDX Works stopped work at the end of February 2025 (${tg('Trade_Radix/114458', 'Adam Simmons')}), and its tokens are owned by its parent, RDX Holdings (${tg('Trade_Radix/133572', 'Dan Hughes')}). <a href="/contents/history/dan-hughes" rel="noopener">Dan Hughes</a> said in October 2024 that he would take his own allocation from RDX in full and keep about 10% of its shares (${tg('radix_dlt/773310', 'Telegram')}); it is not public whether that transfer happened before he died in July 2025. Timan Rebel of Astrolescent, who speaks with the company, says his shares and XRD passed to his family, that RDX Holdings acts mostly for the estate, and that its XRD is held with the custodian PrimeVault (${tg('radix_dlt/996751', 'Telegram')}, ${tg('radix_dlt/996726', 'Telegram')}).</p>
<p>In January 2026 RDX Holdings said it had no plans to sell, would keep its XRD unstaked, and would within a month move it into public accounts so anyone could check it stayed untouched (${tg('radix_dlt/963124', 'Telegram')}). It promised a figure by the end of that month (${tg('radix_dlt/963795', 'Telegram')}) and said in February that it had sold no XRD in the previous year (${tg('radix_dlt/977598', 'Telegram')}). As of 30 September 2026 it has published neither the accounts nor a figure, so the roughly 2bn XRD Hughes gave in July 2025 is the latest number, and it cannot be checked on the ledger.</p>`;

const gc = `<h3>Genesis Crew</h3>
<p>Between 2013 and 2017 early supporters sent about 3,000 BTC to Dan Hughes to fund the work that became Radix, and Radix DLT and Hughes agreed to deliver them 3bn XRD, about 1m XRD per BTC (${a(ECON, 'Radix Economic Model, p. 13')}). With BTC at 10,000 USD that is 0.01 USD per XRD. A refund window that closed in April 2020 cut the backers' share to 2.28bn XRD, and the other 720m, 6% of genesis supply, was offered to new buyers before launch (${tg('radix_dlt/44277', 'Piers Ridyard')}).</p>
<p>The allocation was price-locked until the 2021 unlock and has been freely transferable since. It belongs to individuals whose accounts carry no public labels, and no one reports its total. Hughes wrote in October 2022 of a period "when GC bags were dumping" (${tg('radix_dlt/453134', 'Telegram')}), and holders in the main Radix Telegram channel still describe GC selling, but no figure exists for how much has been sold. 2.28bn XRD is the most that could remain. The Foundation's own treasury, including what is left of the Stable Coin Reserve, is set out on the <a href="/ecosystem/radix-foundation" rel="noopener">Radix Foundation</a> page.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied – no write');
    process.exit(0);
  }
  const i = blocks.findIndex((b) => b.id === AFTER);
  if (i < 0) throw new Error('anchor block not found');
  blocks.splice(i + 1, 0, ...[intro, moves, gc].map((text) => ({ id: uid(), type: 'content', text })));

  const version = '1.5.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}, +3 blocks after index ${i}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'New section on the Founder Retention (2.4bn, RDX Works) and Genesis Crew (3bn, 2.28bn after 2020 refunds) allocations: each disclosed figure since genesis, from the October 2020 economic model, the RTJL holdings update and statements by Dan Hughes, Piers Ridyard and RDX Holdings in the Radix Telegram channels. RDX Holdings promised public accounts in January 2026 and has not published them.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
