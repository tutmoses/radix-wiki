// sweep 431 – contents/tech rotation. Three edits, every source read on 14 September 2026.
//
// 1. /contents/tech/core-concepts/transactions-per-second-tps (v1.2.2, stalest non-operations page in the
//    category, never verified; the run-406 backlog lead). Its infobox held only a video, and its Radix section
//    credited "over 1.4 million TPS" to Cerberus while linking radixdlt.com/blog/replaying-bitcoin, a post of
//    11 June 2019 that says the network "peaked at over 1 million" and names Tempo. The 1.4m figure is real
//    and first-party: radixdlt.com/blog/scaling-dlt-to-over-1m-tps-on-google-cloud (28 August 2019) gives
//    1.4 million financial TPS, 1,187 Google servers across 17 countries, about 700 US dollars per run, and
//    states the Tempo results "do not necessarily apply" to Cerberus. The Radix Knowledge Base article on the
//    1M TPS question agrees on 1,187 servers and on Tempo. Hyperscale figures: the 31 January 2026 post says
//    500,000 sustained and peaks over 700k; the 20 February closing post says peaks above 800k and roughly
//    250k on 64 shards. Bitcoin's 7 TPS and Visa's 2,000 are cited to en.bitcoin.it/wiki/Scalability; the
//    unsourced "around 15 TPS" for Ethereum is dropped, and congestion is cited to ethereum.org's scaling doc.
// 2. /contents/tech/research/hyperscale-rs (v6.28.0). Three links to https://proven.network, which no longer
//    resolves (NXDOMAIN on 8.8.8.8 and 1.1.1.1). They name flightofthefox's organisation, so they now point
//    at github.com/proven-network, which his GitHub profile lists as his company.
// 3. /ecosystem/proven-network (v3.0.0). RDAP for proven.network: expiration 2026-08-05, status
//    "redemption period", last changed 2026-09-14. On 10 September both hostnames served a Cloudflare
//    Registrar parking page; now neither resolves. Newest push in the org is still proven-2pc, 14 November
//    2025, so the rest of the infobox stands and the page is stamped.
//
// Run:  node scripts/sweep-431-tps-sources-proven-domain.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const L = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;

const TEMPO_1_4M = 'https://www.radixdlt.com/blog/scaling-dlt-to-over-1m-tps-on-google-cloud';
const HS_JAN = 'https://www.radixdlt.com/blog/hyperscale-update-500k-public-test-done';
const HS_FEB = 'https://www.radixdlt.com/blog/interim-hyperscale-closing-the-chapter';

function rep(block, from, to) {
  if (!block.text.includes(from)) throw new Error(`no match: ${from.slice(0, 80)}`);
  block.text = block.text.replace(from, to);
}

const EDITS = [
  {
    tagPath: 'contents/tech/core-concepts', slug: 'transactions-per-second-tps', version: '1.3.0', changeType: 'minor', verified: true,
    sentinel: 'do not necessarily apply',
    message: 'Sources for the throughput figures. The 1.4m TPS result belongs to the August 2019 Tempo test, not Cerberus, and now cites RDX Works\' own write-up of it (the old link went to the June 2019 run, which reports over 1m). Added a facts infobox, the January 2026 Hyperscale public test with both published peak figures, and mainnet\'s single shard group. Bitcoin\'s 7 TPS is cited to the Bitcoin Wiki; the unsourced Ethereum figure is dropped.',
    apply(blocks) {
      const info = blocks.find((b) => b.type === 'infobox');
      if (info.blocks.some((b) => b.text?.includes('<table'))) throw new Error('TPS infobox already has a table');
      info.blocks.unshift({
        id: uid(), type: 'content',
        text: [
          '<table><tbody>',
          '<tr><th colspan="2">Transactions per second (TPS)</th></tr>',
          '<tr><td><strong>Measures</strong></td><td>Transactions a network commits each second</td></tr>',
          `<tr><td><strong>Highest Radix test</strong></td><td>${A(TEMPO_1_4M, '1.4m TPS')}, August 2019, on ${L('/contents/tech/research/tempo-consensus-mechanism', 'Tempo')} with 1,187 Google Cloud servers</td></tr>`,
          `<tr><td><strong>Latest Radix test</strong></td><td>${A(HS_JAN, '500,000 TPS sustained')}, January 2026, ${L('/contents/tech/research/hyperscale-500k-tps', 'Hyperscale public test')}</td></tr>`,
          `<tr><td><strong>Related</strong></td><td>${L('/contents/tech/core-concepts/sharding', 'Sharding')} &middot; ${L('/contents/tech/core-protocols/cerberus-consensus-protocol', 'Cerberus')} &middot; ${L('/contents/tech/core-concepts/blockchain-trilemma', 'Blockchain trilemma')}</td></tr>`,
          '</tbody></table>',
        ].join(''),
      });

      const overview = blocks.find((b) => b.id === '4121eedf-f0de-433d-ae79-a41a21c736a0');
      if (!overview) throw new Error('overview block missing');
      const cut = overview.text.indexOf('<h2>TPS Limits of Early Blockchains</h2>');
      if (cut < 0) throw new Error('early-blockchains heading missing');
      overview.text = overview.text.slice(0, cut);

      const early = {
        id: uid(), type: 'content',
        text: [
          '<h2>TPS Limits of Early Blockchains</h2>',
          `<p>${A('https://bitcoin.org', 'Bitcoin')} and ${A('https://ethereum.org', 'Ethereum')} put every transaction into a single chain of blocks that every node validates, so throughput is capped by how much a block holds and how often one is produced.</p>`,
          `<p>Bitcoin produces a block about every ten minutes, and its protocol limit on block size holds sustained throughput to about 7 TPS, according to the ${A('https://en.bitcoin.it/wiki/Scalability', 'Bitcoin Wiki')}. The same page puts Visa's average at about 2,000 TPS.</p>`,
          `<p>Ethereum produces blocks far more often, which raises throughput, but ${A('https://ethereum.org/en/developers/docs/scaling/', 'high demand still slows transactions and raises fees')}. Both designs favour decentralisation and security over throughput, the tradeoff the ${L('/contents/tech/core-concepts/blockchain-trilemma', 'blockchain trilemma')} describes.</p>`,
        ].join(''),
      };

      const radix = {
        id: uid(), type: 'content',
        text: [
          '<h2>Radix TPS</h2>',
          `<p>Radix's throughput figures come from test networks, and each test ran different software. The highest came in August 2019 from ${L('/contents/tech/research/tempo-consensus-mechanism', 'Tempo')}, a consensus design Radix later replaced. RDX Works engineers replayed ten years of Bitcoin transaction history, with full signature validation, on servers spread across 17 countries, at about 700 US dollars of Google Cloud capacity per run. ${A(TEMPO_1_4M, 'Their write-up')} states that the results do not necessarily apply to ${L('/contents/tech/core-protocols/cerberus-consensus-protocol', 'Cerberus')}, the design that succeeded Tempo. A ${A('https://www.radixdlt.com/blog/replaying-bitcoin', 'first public run in June 2019')} peaked at over 1m TPS.</p>`,
          `<p>The ${L('/contents/tech/research/hyperscale-500k-tps', 'Hyperscale public test')} in January 2026 ran real cross-shard swaps across 128 shards on commodity hardware, and more than 590 nodes joined it. ${A(HS_JAN, 'The report on the day')} gave peaks over 700k TPS; the ${A(HS_FEB, 'closing report')} a month later gave peaks above 800k, and recorded that a run on 64 shards had sustained about half the throughput, the linear scaling the design aims for.</p>`,
          `<p>Radix mainnet runs neither design at those rates. It runs as a single shard group, and the braided cross-shard consensus in the Cerberus paper has not shipped in any implementation (${L('/contents/tech/research', 'Radix Research')}). ${L('/contents/tech/research/hyperscale-rs', 'hyperscale-rs')}, a community-built Rust implementation, is the leading candidate to bring sharded consensus to mainnet through the ${L('/contents/tech/releases/radix-mainnet-xian', "Xi'an")} upgrade.</p>`,
        ].join(''),
      };

      blocks.splice(blocks.indexOf(overview) + 1, 0, early, radix);
    },
  },
  {
    tagPath: 'contents/tech/research', slug: 'hyperscale-rs', version: '6.28.1', changeType: 'patch', verified: false,
    sentinel: '>Proven Network</a>',
    message: 'proven.network no longer resolves: the domain expired on 5 August 2026 and was in its redemption period on 14 September. The three links naming flightofthefox\'s organisation now point to github.com/proven-network, which his GitHub profile lists as his company.',
    apply(blocks) {
      const from = '<a href="https://proven.network" target="_blank" rel="noopener">proven.network</a>';
      const to = A('https://github.com/proven-network', 'Proven Network');
      let n = 0;
      const walk = (bs) => bs.forEach((b) => {
        if (b.text?.includes(from)) { n += b.text.split(from).length - 1; b.text = b.text.replaceAll(from, to); }
        if (b.blocks) walk(b.blocks);
      });
      walk(blocks);
      if (n !== 3) throw new Error(`expected 3 proven.network links, replaced ${n}`);
      if (JSON.stringify(blocks).includes('https://proven.network')) throw new Error('a proven.network link survived');
    },
  },
  {
    tagPath: 'ecosystem', slug: 'proven-network', version: '3.0.1', changeType: 'patch', verified: true,
    sentinel: 'redemption period',
    message: 'Domain re-read 14 September 2026: proven.network\'s registration expired on 5 August 2026 and RDAP showed it in the redemption period, so proven.network and docs.proven.network no longer resolve (on 10 September both served a parking page). Newest push in the GitHub organisation is still 14 November 2025.',
    apply(blocks) {
      const info = blocks.find((b) => b.type === 'infobox').blocks[0];
      rep(info,
        '&#128992; Dormant &mdash; no public launch; site and docs parked, newest repository push 14 November 2025 (read 10 September 2026)',
        '&#128992; Dormant &ndash; no public launch; domain lapsed, newest repository push 14 November 2025 (read 14 September 2026)');
      rep(info,
        '<code>proven.network</code> and <code>docs.proven.network</code> both serve a Cloudflare Registrar parking page. Archived:',
        `<code>proven.network</code> and <code>docs.proven.network</code> no longer resolve. The domain's registration expired on 5 August 2026, and ${A('https://rdap.org/domain/proven.network', 'RDAP')} showed it in the redemption period on 14 September; four days earlier both hostnames served a parking page. Archived:`);
    },
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }
    const blocks = JSON.parse(JSON.stringify(page.content));
    e.apply(blocks);
    const json = JSON.stringify(blocks);
    if (!json.includes(e.sentinel)) throw new Error(`${e.slug}: sentinel missing after apply`);
    console.log(`  ${DRY ? '[dry] ' : ''}${e.tagPath}/${e.slug}  v${page.version} -> v${e.version}  (${JSON.stringify(page.content).length} -> ${json.length} chars)`);
    if (DRY) continue;
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query(
      `UPDATE pages SET content = $1, version = $2, updated_at = $3${e.verified ? ', last_verified_at = $3' : ''} WHERE id = $4`,
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
