// Sweep 425 (ecosystem): two findings.
// 1. /ecosystem/defiplaza: DefiLlama stored DeFiPlaza's 31 August Radix volume as each of 1-10 September,
//    because the adapter takes volumeUSD without checking the date of the entry the endpoint returns.
// 2. /ecosystem/backeum: backeum.com was registered by someone else on 1 October 2025 and serves a lottery
//    page; the $THANKS token's locked info_url still points there.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const X = 'target="_blank" rel="noopener"';

const DEFIPLAZA_SENTINEL = 'dimension-adapters/blob/master/dexs/defiplaza';
const DEFIPLAZA_PARA = `<p>DefiLlama's volume series for DeFiPlaza records trading that did not happen. Its <a href="https://github.com/DefiLlama/dimension-adapters/blob/master/dexs/defiplaza/index.ts" ${X}>adapter</a>, the script DefiLlama runs each day to collect a protocol's figures, asks DeFiPlaza's <a href="https://radix.defiplaza.net/api/defillama/volume?timestamp=1788998400" ${X}>volume endpoint</a> for a day and takes the <code>volumeUSD</code> it gets back without checking which day the answer belongs to. The endpoint returns its latest entry, and while the ledger was stopped the latest entry was 31 August: state version 557,840,558, 670 swaps and $17,028 of volume. Read on 13 September 2026, it still returns that entry for every timestamp from 1 to 10 September. DefiLlama's <a href="https://api.llama.fi/summary/dexs/defiplaza" ${X}>per-chain series</a> accordingly shows $17,024 of Radix volume on each of those ten days, $170,240 in all, then $1,564 on 11 September, the day the network restarted, and $132 on 12 September. The <a href="/blog/week-in-review-2026-09-13" rel="noopener">Week in Review for 13 September</a> reported the error.</p>`;

const BACKEUM_SENTINEL = 'Domain Registered by Someone Else';
const BACKEUM_NOTE_START = '<p><em>Status note (July 2026):';
const BACKEUM_NOTE = `<p><em>Status note (September 2026): Backeum is defunct, and its backeum.com domain now belongs to someone else (see <a href="#domain-registered-by-someone-else" rel="noopener">below</a>). The project's <a href="https://github.com/backeum/backeum-blueprint" ${X}>Scrypto blueprint remains public on GitHub</a> as an archived reference.</em></p>`;
const BACKEUM_SECTION = `<h2 id="domain-registered-by-someone-else">Domain Registered by Someone Else</h2><p>Backeum's own site on backeum.com was <a href="https://web.archive.org/web/20250302121804/http://backeum.com/" ${X}>last archived on 2 March 2025</a>. Someone registered the domain again on 1 October 2025, through NameCheap and for one year (<a href="https://rdap.org/domain/backeum.com" ${X}>registry record</a>), and by 13 October it served a Chinese-language results page for a lottery betting game (<a href="https://web.archive.org/web/20251013173857/http://backeum.com/" ${X}>archived capture</a>). It still served that page on 13 September 2026. This page described the site as offline in July 2026, when the domain had already changed hands.</p><p>The ledger still points to the domain. Backeum's $THANKS token, which backers earned for supporting creators, lists https://backeum.com as its <code>info_url</code>, the web address explorers show for a token, and that metadata entry is locked, so it can never be changed. Its <code>icon_url</code>, which is not locked, also points to backeum.com. Read from the <a href="https://mainnet.radixdlt.com/state/entity/details" ${X}>Radix Gateway</a> on 13 September 2026, resource_rdx1t5ygxyqpjx9zn4u369cdwt70dr4s7cknmxskdx6gm4m9e5rcj24rry has a supply of 133,512 $THANKS held by 151 accounts. Anyone following the token's link reaches the lottery page.</p>`;

const EDITS = [
  {
    slug: 'defiplaza',
    version: '3.4.0',
    sentinel: DEFIPLAZA_SENTINEL,
    message: "DefiLlama's Radix volume for DeFiPlaza repeats the 31 August figure (~$17,024) on each of 1-10 September: the adapter (DefiLlama/dimension-adapters dexs/defiplaza) takes volumeUSD without checking the entry's date, and radix.defiplaza.net/api/defillama/volume returns the 31 August entry (state version 557,840,558) for every September timestamp before the restart. $170,240 of recorded volume that the ledger never committed. Read 13 September 2026 via api.llama.fi/summary/dexs/defiplaza.",
    mutate(blocks) {
      const b = blocks[1];
      const anchor = '<h2>Team</h2>';
      if (!b?.text?.includes(anchor)) throw new Error('defiplaza: Team heading not found in block 1');
      b.text = b.text.replace(anchor, DEFIPLAZA_PARA + anchor);
    },
  },
  {
    slug: 'backeum',
    version: '2.4.0',
    sentinel: BACKEUM_SENTINEL,
    message: 'backeum.com was re-registered on 1 October 2025 (NameCheap, RDAP) and serves a Chinese lottery-results page (Wayback 13 Oct 2025; live 13 Sep 2026); the July 2026 note calling it offline was wrong. $THANKS keeps a locked info_url to the domain (Gateway, 133,512 supply, 151 holders). Status note rewritten, new section added. The domain is not linked.',
    mutate(blocks) {
      const b = blocks[0];
      const start = b?.text?.indexOf(BACKEUM_NOTE_START) ?? -1;
      if (start !== 0) throw new Error('backeum: status note not at the start of block 0');
      const end = b.text.indexOf('</em></p>') + '</em></p>'.length;
      b.text = BACKEUM_NOTE + b.text.slice(end);
      blocks.splice(2, 0, { id: uid(), type: 'content', text: BACKEUM_SECTION });
    },
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage('ecosystem', e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ecosystem', e.slug]);
    if (!rows.length) throw new Error(`${e.slug}: page not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }
    e.mutate(blocks);
    const json = JSON.stringify(blocks);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  chars ${JSON.stringify(page.content).length} -> ${json.length}`);
    if (DRY) continue;
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, 'minor', AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
