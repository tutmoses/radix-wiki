import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/core-protocols';
const SLUG = 'xrd-token';
const HEADING = 'Founder Retention and Genesis Crew Holdings';
const SENTINEL = 'The ledger shows the consolidation';

const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const tg = (path, text) => a(`https://t.me/${path}`, text);
const CH = 'https://find-and-update.company-information.service.gov.uk/company/14648189/filing-history';
const ECON = 'https://assets.website-files.com/6053f7fca5bf627283b582c2/6088147cbbc08674b4975349_Economic-2020-V10.4.pdf';

const intro = `<h2>${HEADING}</h2>
<p>Two of the genesis allocations went to private holders rather than to token buyers or the Foundation: the Founder Retention, 2.4bn XRD, to RDX Works, the company that built Radix; and the Radix Community allocation, up to 3bn XRD, to the early backers the community calls the Genesis Crew, or GC (${a(ECON, 'Radix Economic Model, p. 13')}). Every token in both has been transferable since the <a href="/contents/history/token-unlock" rel="noopener">September 2021 unlock</a>. Neither holder labels its accounts on the ledger, so what remains is known from what the holders have said and, for the Founder Retention, from accounts traced to RDX through its own transactions.</p>
<h3>Founder Retention</h3>
<p>RDX Works (formerly Radix DLT Ltd) holds the Founder Retention as a company treasury asset, not in the names of individuals. Investors bought about 10% of the company for 6m USD in 2018 and 2019, which the economic model describes as exposure to those tokens. Each figure given for the holding since genesis:</p>
<table><tbody>
<tr><th>Date</th><th>Holding</th><th>Source</th></tr>
<tr><td>July 2021</td><td>2.4bn XRD at genesis</td><td>${a(ECON, 'Radix Economic Model')}</td></tr>
<tr><td>January 2022</td><td>Plan to release up to 75m XRD a quarter to shareholders and option holders, about 1.2bn over four years</td><td>${a('https://www.radixdlt.com/blog/founder-retention-notice-from-rdx-works-limited', 'RDX Works notice')}</td></tr>
<tr><td>February 2024</td><td>2.25bn XRD, after two 75m distributions; further distributions paused</td><td>${a('https://www.radixdlt.com/blog/rtjl-token-holdings-update', 'RTJL holdings update')}</td></tr>
<tr><td>February 2025</td><td>1.1bn XRD ring-fenced as the founder share, movable only with Dan Hughes's sign-off, plus an estimated 700m to 800m XRD of working capital</td><td>${tg('radix_dlt/862185', 'Dan Hughes, Telegram')}</td></tr>
<tr><td>May 2025</td><td>£16.2m of XRD and eXRD at 31 May, valuation basis not stated; forecasts assumed selling other tokens but not XRD</td><td>${a(CH, 'RDX Holdings group accounts')}</td></tr>
<tr><td>July 2025</td><td>About 2bn XRD</td><td>${tg('Trade_Radix/133557', 'Dan Hughes, Telegram')}</td></tr>
<tr><td>January 2026</td><td>"A substantial amount", no figure</td><td>${tg('radix_dlt/963124', 'RDX Holdings, Telegram')}</td></tr>
<tr><td>September 2026</td><td>1.49bn XRD in seven unlabelled accounts traced to RDX, listed below</td><td>Radix ledger</td></tr>
</tbody></table>`;

const moves = `<p>Some of the holding has left or been pledged. RDX Works and the Foundation both contributed to the 1.5bn XRD <a href="/contents/history/radix-ecosystem-funding" rel="noopener">Radix Endowment Fund</a> in 2024 (${tg('radix_dlt/775383', 'Adam Simmons')}). The ledger shows the split: on 2 September 2024, the day Brevan Howard Digital was named its manager, one account sent 1,166.67m XRD and another 333.33m into 20 new accounts, and RDX's 16 staked with Twinstake the next day. The 333.33m came from an account that also held stake with four validators run by the Radix Foundation, which leaves the 1,166.67m as RDX's. In January 2025 RDX pledged XRD as collateral for a loan of up to 10m USD, depositing the first 17m XRD at KuCoin (${tg('radix_dlt/833223', 'Piers Ridyard')}); RDX Holdings said in February 2026 that less than 10% of the facility was drawn (${tg('radix_dlt/975655', 'RDX Holdings')}). RDX Works stopped work at the end of February 2025 (${tg('Trade_Radix/114458', 'Adam Simmons')}), and its tokens are owned by its parent, RDX Holdings (${tg('Trade_Radix/133572', 'Dan Hughes')}). <a href="/contents/history/dan-hughes" rel="noopener">Dan Hughes</a> said in October 2024 that he would take his own allocation from RDX in full and keep about 10% of its shares (${tg('radix_dlt/773310', 'Telegram')}); it is not public whether that transfer happened before he died in July 2025. Timan Rebel of Astrolescent, who speaks with the company, says his shares and XRD passed to his family, that RDX Holdings acts mostly for the estate, and that its XRD is held with the custodian PrimeVault (${tg('radix_dlt/996751', 'Telegram')}, ${tg('radix_dlt/996726', 'Telegram')}).</p>`;

const gc = `<h3>Genesis Crew</h3>
<p>Between 2013 and 2017 early supporters sent about 3,000 BTC to Dan Hughes to fund the work that became Radix, and Radix DLT and Hughes agreed to deliver them 3bn XRD, about 1m XRD per BTC (${a(ECON, 'Radix Economic Model, p. 13')}). With BTC at 10,000 USD that is 0.01 USD per XRD. A refund window that closed in April 2020 cut the backers' share to 2.28bn XRD, and the other 720m, 6% of genesis supply, was offered to new buyers before launch (${tg('radix_dlt/44277', 'Piers Ridyard')}).</p>
<p>The allocation was price-locked until the 2021 unlock and has been freely transferable since. It belongs to individuals whose accounts carry no public labels, and no one reports its total. Hughes wrote in October 2022 of a period "when GC bags were dumping" (${tg('radix_dlt/453134', 'Telegram')}), and holders in the main Radix Telegram channel still describe GC selling, but no figure exists for how much has been sold. 2.28bn XRD is the most that could remain. The Foundation's own treasury, including what is left of the Stable Coin Reserve, is set out on the <a href="/ecosystem/radix-foundation" rel="noopener">Radix Foundation</a> page.</p>`;

const acct = (addr) => a(`https://dashboard.radixdlt.com/account/${addr}`, `<code>${addr.slice(0, 16)}…${addr.slice(-6)}</code>`);
const ledger = `<p>In January 2026 RDX Holdings said it had no plans to sell, would keep its XRD unstaked, and would within a month move it into public accounts so anyone could check it stayed untouched (${tg('radix_dlt/963124', 'Telegram')}). It promised a figure by the end of that month (${tg('radix_dlt/963795', 'Telegram')}), said through Peachy Keehn that its share of the Endowment Fund was back in its custody, unstaked, with no intention to dispose of it (${tg('radix_dlt/963151', 'Telegram')}), and said in February that it had sold no XRD in the previous year (${tg('radix_dlt/977598', 'Telegram')}). It has published neither the accounts nor a figure, and its group accounts for the year to March 2025, due on 31 March 2026, have not been filed (${a("https://find-and-update.company-information.service.gov.uk/company/14648189", 'Companies House')}).</p>
<p>${SENTINEL} it described. Between 16 and 20 February 2026 three accounts received about 1.47bn XRD: one from 12 accounts of about 50m XRD each that had not moved since the Babylon migration in September 2023, the same shape as the 22 accounts that funded RDX's endowment stake; and two from 12 of RDX's 16 endowment accounts, whose stake was withdrawn from Twinstake in January. Four more accounts took the other four endowment tranches. On 30 September 2026 the seven held 1.49bn XRD, all of it unstaked:</p>
<table><tbody>
<tr><th>Account</th><th>Funded from</th><th>XRD, 30 Sep 2026</th></tr>
<tr><td>${acct('account_rdx12xfg9p5mp90ykjxmsu4nhv7z2kw6sdvlwvlruztpmpkndpscqvyjv4')}</td><td>12 accounts of about 50m, 16–18 Feb 2026</td><td>611.5m</td></tr>
<tr><td>${acct('account_rdx1290673wlezauc0y7fpr94sn9acn2wsgquepttv6ynsnetkngae265x')}</td><td>8 endowment accounts, 20 Feb 2026</td><td>601.4m</td></tr>
<tr><td>${acct('account_rdx12xy8nnxu6t705accxk2d2eqm33cs6ak4uh5lrz8ulr4lv29gsyhvgg')}</td><td>4 endowment accounts, 20 Feb 2026; sent 200m to the four below on 25 Sep 2026</td><td>105.9m</td></tr>
<tr><td>${acct('account_rdx12y3gus6gmckd6fhrg3sg0umv38zfspm9u6ynfy6qglu26jptfpssm5')}</td><td rowspan="4">One endowment tranche each, Feb–Mar 2026, then 50m each from the account above</td><td>50.0m</td></tr>
<tr><td>${acct('account_rdx128kj8245u3g5a9ej3dpv8s9rapnamfevg8wykf2lz4chn639w5qfcd')}</td><td>50.0m</td></tr>
<tr><td>${acct('account_rdx129u2hgt5mc5k7m2s7zgwe9ang7luqw6zenkdv64yu9dutzwwljx6sv')}</td><td>50.0m</td></tr>
<tr><td>${acct('account_rdx12xef2sy8dvw5jng3pue0pfszj57vvrawvjs6947agcd2j5f4zczy3t')}</td><td>25.0m</td></tr>
</tbody></table>
<p>The last four accounts have been sending XRD out. Since 17 July 2026 they have sent 233m XRD to one deposit address, ${acct('account_rdx169ajvnvl0skdh6glr273zt833cha3k5qr5c7yx6p27h9hylev7dudl')}, which passes each deposit straight on to an account with the traffic of an exchange wallet: 73 accounts paid into it and 156 were paid from it between mid-July and 30 September. The latest, 25m on 29 September, went four days after the top-up. It also took 13.4m XRD in July from an account funded out of the Foundation's endowment share, so it may belong to a broker serving both rather than to RDX alone. The ledger cannot show whether any of the 233m was sold.</p>`;

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
  const iIntro = blocks.findIndex((b) => b.text?.includes(`<h2>${HEADING}</h2>`));
  const iMoves = blocks.findIndex((b) => b.text?.startsWith('<p>Some of the holding has left'));
  if (iIntro < 0 || iMoves !== iIntro + 1) throw new Error('section blocks not found where expected');
  blocks[iIntro].text = intro;
  blocks[iMoves].text = moves;
  blocks.splice(iMoves + 1, 0, { id: uid(), type: 'content', text: ledger });

  const version = '1.6.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}, rewrote blocks ${iIntro}-${iMoves}, +1 block`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Founder Retention traced on the ledger: the Endowment Fund split (RDX 1,166.67m, Foundation 333.33m, 2 Sep 2024), the February 2026 consolidation into seven RDX-lineage accounts holding 1.49bn XRD, and 233m sent from four of them to one exchange deposit address since 17 Jul 2026. Adds the RDX Holdings group accounts figure (31 May 2025, £16.2m XRD and eXRD) and notes its March 2025 accounts are overdue.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
