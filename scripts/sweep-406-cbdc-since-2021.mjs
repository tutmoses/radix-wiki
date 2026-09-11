// Sweep 406 — /contents/tech/core-concepts/central-bank-digital-currencies
//
// The category staleness head (updated 5 July 2026, never verified). The page is
// accurate about the 2014–2021 official-sector literature and says nothing after it,
// so its adoption section still opens "As of 2019, no central bank had found strong
// advantages" with no signal that the sentence is historical. This edit leaves the
// literature intact, dates it, and adds a sourced section on where the experiment
// stands, read 11 September 2026:
//
//   Atlantic Council CBDC Tracker (May 2026)  — 146 countries/unions, 77 advanced,
//                                                41 pilots, 3 launched
//   BIS Paper 159, 22 August 2025            — 2024 survey, 93 banks, 91% exploring
//   PRC State Council, 29 December 2025      — e-CNY interest-bearing + deposit-insured
//                                                from 1 January 2026; cumulative usage
//   Bank of Canada, digitaldollar            — retail CBDC work scaled down
//   Executive Order 14178, 23 January 2025   — CBDC prohibited for US agencies
//   ECB digital euro                         — potential first issuance 2029
//
// The through-line is that the interest-rate design question the cited 2017–2018
// literature treated as hypothetical has now been answered in the largest live
// deployment, while the United States has banned the instrument outright.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'central-bank-digital-currencies';
const SENTINEL = 'Where the experiment stands';

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const INFOBOX_ROW =
  '<tr><td><strong>Live retail CBDCs</strong></td><td>Three as of May 2026 &ndash; the Bahamas (Sand Dollar), Jamaica (JAM-DEX) and Nigeria (eNaira)</td></tr>';

const NEW_SECTION = [
  '<h2>Where the experiment stands</h2>',
  '<p>The work cited above was published between 2014 and 2021, when no central bank of a large economy had issued a CBDC and the design questions were hypothetical. They are no longer hypothetical. The Atlantic Council’s CBDC Tracker counted <a href="https://www.atlanticcouncil.org/cbdctracker/" target="_blank" rel="noopener">146 countries and currency unions exploring a CBDC</a> in May 2026, representing over 98 percent of global GDP and up from 87 in May 2022, with 77 in the advanced phase of development, pilot or launch and 41 pilot projects running. Three retail CBDCs have fully launched – the Bahamas’ Sand Dollar, Jamaica’s JAM-DEX and Nigeria’s eNaira – and all three are still working on domestic adoption. The Bank for International Settlements’ 2024 survey of 93 central banks, published in August 2025, found <a href="https://www.bis.org/publ/bppdf/bispap159.htm" target="_blank" rel="noopener">91 percent of them exploring a retail CBDC, a wholesale CBDC or both</a>, wholesale exploration at the more advanced stage of the two, and more than one in three jurisdictions accelerating the work in response to stablecoins and other cryptoassets.</p>',
  '<p>The interest-rate question that Bordo and Levin, Kumhof and Noone and Stevens treated as a design choice has since been answered in the largest live deployment. From 1 January 2026 the People’s Bank of China requires commercial banks to <a href="https://english.www.gov.cn/news/202512/29/content_WS69526d4ec6d00ca5f9a08511.html" target="_blank" rel="noopener">pay interest on e-CNY wallet balances at prevailing deposit rates</a> and covers those balances by deposit insurance on the same terms as ordinary deposits, brings e-CNY into its reserve framework, and requires non-bank payment institutions to hold 100 percent reserves against the e-CNY they manage. The announcement describes the change as moving the digital yuan beyond a cash-like instrument toward a form of digital deposit money, and puts cumulative usage to November 2025 at 3.48 billion transactions worth 16.7 trillion yuan, about 2.37 trillion US dollars. An interest-bearing, deposit-insured retail CBDC distributed through commercial banks is close to the account-based, interest-bearing design Bordo and Levin advocated in 2017.</p>',
  '<p>Two of the jurisdictions whose central banks produced the early analysis have stepped back from it. The Bank of Canada, which published a long series of CBDC working papers, states that it is <a href="https://www.bankofcanada.ca/digitaldollar/" target="_blank" rel="noopener">scaling down its work on a retail central bank digital currency</a> and shifting to broader payments system research and policy development. In the United States the instrument was prohibited outright rather than declined: section 5 of <a href="https://www.govinfo.gov/content/pkg/FR-2025-01-31/pdf/2025-02123.pdf" target="_blank" rel="noopener">Executive Order 14178 of 23 January 2025</a> bars agencies, except to the extent required by law, from any action to establish, issue or promote CBDCs within the jurisdiction of the United States or abroad, orders any ongoing agency CBDC plans immediately terminated, and revokes the 2022 order under which that work had been conducted.</p>',
  '<p>The euro area is on a published timetable rather than a decision. In October 2025 the ECB’s Governing Council moved the digital euro project into its next phase, preparing for <a href="https://www.ecb.europa.eu/euro/digital_euro/html/index.en.html" target="_blank" rel="noopener">a potential first issuance during 2029</a> on the assumption that the necessary EU legislation is adopted during 2026, with a pilot scheduled to begin in 2027. No decision to issue has been taken.</p>',
].join('');

const NEW_REFS = [
  '<li>Atlantic Council (2026). <a href="https://www.atlanticcouncil.org/cbdctracker/" target="_blank" rel="noopener">Central Bank Digital Currency Tracker</a>. GeoEconomics Center. Figures as of May 2026, read 11 September 2026.</li>',
  '<li>Illes, A., Kosse, A. and Wierts, P. (2025). <a href="https://www.bis.org/publ/bppdf/bispap159.htm" target="_blank" rel="noopener">Advancing in tandem: results of the 2024 BIS survey on central bank digital currencies and crypto</a>. BIS Papers No. 159, Bank for International Settlements, 22 August 2025.</li>',
  '<li>The State Council of the People’s Republic of China (2025). <a href="https://english.www.gov.cn/news/202512/29/content_WS69526d4ec6d00ca5f9a08511.html" target="_blank" rel="noopener">China to enhance digital yuan management with deposit features starting 2026</a>. 29 December 2025.</li>',
  '<li>Bank of Canada. <a href="https://www.bankofcanada.ca/digitaldollar/" target="_blank" rel="noopener">Digital Canadian Dollar</a>. Read 11 September 2026.</li>',
  '<li>Executive Order 14178 of January 23, 2025. <a href="https://www.govinfo.gov/content/pkg/FR-2025-01-31/pdf/2025-02123.pdf" target="_blank" rel="noopener">Strengthening American Leadership in Digital Financial Technology</a>. 90 FR 8647, Federal Register Vol. 90, No. 20, 31 January 2025.</li>',
  '<li>European Central Bank. <a href="https://www.ecb.europa.eu/euro/digital_euro/html/index.en.html" target="_blank" rel="noopener">Digital euro</a>. Read 11 September 2026.</li>',
].join('');

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  // 1. Infobox gains a live-deployment row, above Related.
  const info = blocks[0];
  if (info?.type !== 'infobox') throw new Error('block 0 is not the infobox');
  const infoInner = info.blocks[0];
  const relatedAnchor = '<tr><td><strong>Related</strong></td>';
  if (!infoInner.text.includes(relatedAnchor)) throw new Error('infobox Related row not found');
  infoInner.text = infoInner.text.replace(relatedAnchor, INFOBOX_ROW + relatedAnchor);

  // 2. Date the historical adoption section so its 2019 reading is not read as current.
  const adoption = blocks.find((b) => b.text?.includes('<h2>Adoption and pilot experience</h2>'));
  if (!adoption) throw new Error('adoption section not found');
  adoption.text = adoption.text.replace(
    '<h2>Adoption and pilot experience</h2><p>As of 2019,',
    '<h2>Adoption and pilot experience to 2021</h2><p>This section reflects the cited literature, the newest of which was written in 2021; for the position since, see <em>Where the experiment stands</em> below. As of 2019,');
  if (!adoption.text.includes('Adoption and pilot experience to 2021')) throw new Error('adoption heading replace no-op');

  // 3. New section, inserted directly before References.
  const refIdx = blocks.findIndex((b) => b.text?.includes('<h2>References</h2>'));
  if (refIdx < 0) throw new Error('References block not found');
  blocks.splice(refIdx, 0, { id: uid(), type: 'content', text: NEW_SECTION });

  // 4. Reference list extended.
  const refs = blocks[refIdx + 1];
  if (!refs.text.endsWith('</ol>')) throw new Error('references block does not end in </ol>');
  refs.text = refs.text.slice(0, -'</ol>'.length) + NEW_REFS + '</ol>';

  const version = '1.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${blocks.length} blocks)`);
  if (DRY) {
    console.log('  infobox row  :', INFOBOX_ROW.slice(0, 90));
    console.log('  new section  :', NEW_SECTION.slice(0, 160));
    console.log('  refs added   : 6');
  } else {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Adds "Where the experiment stands": the Atlantic Council tracker reading for May 2026 (146 countries, 77 advanced, 41 pilots, 3 launched), the 2024 BIS survey of 93 central banks (BIS Papers 159), the PBoC framework making e-CNY interest-bearing and deposit-insured from 1 January 2026, the Bank of Canada scaling down retail CBDC work, the US prohibition under Executive Order 14178, and the ECB digital euro timetable to 2029. The existing literature section is dated "to 2021" so its 2019 reading is not read as current.',
        now]);
    await client.query('COMMIT');
    console.log('  written.');
  }
} finally {
  client.release();
  await pool.end();
}
