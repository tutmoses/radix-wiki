// scripts/sweep-515-early-bardix.mjs
//
// Ecosystem rotation, run 515. The two Active pages at the head of the staleness queue
// (bardix, early; 1 Sep, never verified), re-read on 1 October 2026:
//   - early: block 1 was 25,700 characters of generated text that cited "the provided
//     documentation", repeated each feature three times, listed members' joke titles and
//     wrote the ticker as a cashtag, which the renderer reads as maths. Rewritten from
//     stillearly.tech's own bundle (earlyTech tools, Studio Pass rules), the Gateway
//     (supply 1bn minted, 0 burned, mint/burn and their updaters DenyAll, created
//     9 Jan 2024) and Ociswap (0.0172 XRD, ~6,400 USD circulating cap, ~70 USD 7d volume).
//   - bardix: the page had no on-ledger record. The Bar component (from the dApp bundle)
//     was deployed 27 May 2026 and has 160 transactions: 112 May, 45 Jun, 2 Jul, 1 Aug
//     (26 Aug the latest), read at state version 560,609,073.
//
//   node scripts/sweep-515-early-bardix.mjs --dry-run
//   node scripts/sweep-515-early-bardix.mjs
//
// Idempotent per page: skipped if that page's sentinel is already present.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, assertLinkShapes } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const I = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;
const DASH = 'https://dashboard.radixdlt.com';
const EARLY_RES = 'resource_rdx1t5xv44c0u99z096q00mv74emwmxwjw26m98lwlzq6ddlpe9f5cuc7s';
const OCI = `https://ociswap.com/${EARLY_RES}`;
const SE = 'https://stillearly.tech/';

const earlyBody = [
  `<p>EARLY is a community token on ${I('/contents/tech/core-protocols/radix-engine', 'Radix')}, created on ${A(`${DASH}/transaction/txid_rdx1gt03urg0p9x6zddvknne85hmjkl9l3h83n3ekxdlvugqvwrcet8sx5v3cd/summary`, '9 January 2024')}, named for the Radix community's habit of telling itself it is still early. Its site, ${A(SE, 'stillearly.tech')}, carries two products built around it: earlyTech, a set of trading and chat tools, and earlyStudios, an NFT drop house that gates its mints on EARLY holdings. The ${I('/ecosystem/rly-fun', 'rlyfun')} launchpad spends its profit buying EARLY back.</p>`,
  `<h2>Market</h2>`,
  `<p>On 1 October 2026 EARLY traded at about 0.0172 XRD (0.0000066 USD) on ${A(OCI, 'Ociswap')}, for a circulating market capitalisation near 6,400 USD and about 70 USD of volume over seven days. On 25 July 2026 the same reads gave 0.0259 XRD and about 32,000 USD: EARLY fell by a third against XRD over those ten weeks, and XRD itself lost about 70% of its dollar price. The site reported a market capitalisation of about 1.1m USD in October 2024.</p>`,
  `<h2>Token</h2>`,
  `<p>The ${A(`${DASH}/resource/${EARLY_RES}`, 'resource')} holds a fixed supply of 1,000,000,000 EARLY, all minted when it was created, with none burned. Minting and burning are denied, and so are the roles that could change those two rules, so no one can alter the supply. About 980m EARLY are in circulation by Ociswap's count.</p>`,
  `<h2>earlyTech</h2>`,
  `<p>${A(SE, 'stillearly.tech')} lists four tools:</p>`,
  `<ul><li><strong>earlyBot</strong>, a trading bot for Radix DEXs, which the site shows with a feed of its recent trades;</li><li><strong>earlyAlerts</strong>, notices of newly created pools and of pools it flags as likely rugs;</li><li><strong>earlyIntern</strong>, which lets users tip each other in more than 20 tokens and pays for content;</li><li><strong>earlyGPT</strong>, a chat assistant that comments on the contents of a wallet.</li></ul>`,
  `<h2>earlyStudios and the Studio Pass</h2>`,
  `<p>${A('https://stillearly.tech/studios/about', 'earlyStudios')} releases art from curated artists and experimental projects as NFT drops. Minting a drop needs a ${A('https://stillearly.tech/studios/studio-pass', 'Studio Pass')}, an NFT that is free to claim apart from the transaction fee, and an EARLY balance in the same account when the drop's snapshot is taken. After each snapshot the pass's metadata is updated to record whether its holder qualified. The first passes were airdropped to accounts holding 50,000 EARLY or more.</p>`,
].join('\n');

const earlyLinks = `<h2>External Links</h2>\n<ul>\n<li>${A(SE, 'stillearly.tech')}</li>\n<li>${A('https://stillearly.tech/studios/about', 'earlyStudios')}</li>\n<li>${A(OCI, 'EARLY on Ociswap')}</li>\n<li>${A(`${DASH}/resource/${EARLY_RES}`, 'EARLY on the Radix Dashboard')}</li>\n<li>${A('https://x.com/early_radix', 'EARLY on X (@early_radix)')}</li>\n<li>${A('https://t.me/early_xrd', 'EARLY on Telegram')}</li>\n</ul>`;

const BAR = 'component_rdx1cr05ctwsknyy3s8zpcrwgqj6xnknn5x8s8vx0g8rppur8s88ckmfzp';
const res = (addr, name, n) => `<tr><td>${A(`${DASH}/resource/${addr}`, name)}</td><td>${n}</td></tr>`;
const bardixRecord = [
  `<h2>On-ledger record</h2>`,
  `<p>The game runs as one component, the ${A(`${DASH}/component/${BAR}`, 'Bar')}, deployed on 27 May 2026; its address was taken from the dApp's own front-end bundle. Read at the ${I('/contents/tech/core-protocols/radix-gateway-api', 'Gateway')} on 1 October 2026, it had appeared in 160 transactions: 112 in May, 45 in June, two in July and one on 26 August 2026, the most recent. A player starts by claiming a Bardix Open NFT, and 19 have been claimed. The NFT collections the Bar controls held these supplies:</p>`,
  `<table><tr><th>Collection</th><th>Supply</th></tr>${[
    res('resource_rdx1n29m3x3x0jjwamvlf07xnznj2qw5r9kfpxut893nv80hr3xvs7vzfq', 'Bardix Open', 19),
    res('resource_rdx1ng5ueya6g2hz3mgutgkgj4v58nl9zam92aepcdjm7zcaecg6ngw3yq', 'BARDIX Liquids', 227),
    res('resource_rdx1n2tm58un88g6fn2fyfhgcq9ctcjkh5jektvj9mpm7c5ecz8539cv7k', 'BARDIX Garnishes', 840),
    res('resource_rdx1ngc5zd927mg5rs0dmeu7tjnjhx2khjxqp4656qqvt7qh55f2m6dd80', 'BARDIX Cocktails', 7),
    res('resource_rdx1ntmqyn2z04cvayp8yr5s0y9rv862rvsggd2vr9t4ruw9uxlx2wspl0', 'BARDIX Achievements', 10),
    res('resource_rdx1nfvvzqgzszzppy4626lremd7ypvxduu43q09xzjd82exkgw3v40frr', 'BARDIX Coffins', 36),
    res('resource_rdx1n2ln8nh7j6xeqxauch6qdlzfhup646j42s5vc8dfcysydfz4z4gkah', 'BARDIX Sealed Shakers', 0),
  ].join('')}</table>`,
  `<p>Seven cocktails have been crafted. The site at bardix.pages.dev still serves the game.</p>`,
].join('\n');

const edits = [
  {
    slug: 'early', version: '4.0.0', changeType: 'major', sentinel: 'earlyStudios and the Studio Pass',
    message: 'Sweep 515: rewrote the body from stillearly.tech, the Gateway and Ociswap (1 Oct 2026). Dropped the generated filler and the members\' title list, wrote the ticker without a cashtag, re-dated the market figures (0.0172 XRD, ~6,400 USD cap) and added External Links.',
    apply(blocks) {
      const big = blocks.findIndex((b) => b.type === 'content' && (b.text || '').length > 20000);
      if (big < 0) throw new Error('early: long body block not found');
      blocks[big] = { id: blocks[big].id, type: 'content', text: earlyBody };
      const buy = blocks.find((b) => (b.text || '').startsWith('<h2>rlyfun buybacks</h2>'));
      if (!buy || !buy.text.includes('$EARLY')) throw new Error('early: buyback block not as expected');
      buy.text = buy.text.replaceAll('$EARLY', 'EARLY');
      blocks.push({ id: uid(), type: 'content', text: earlyLinks });
    },
  },
  {
    slug: 'bardix', version: '1.2.0', changeType: 'minor', sentinel: 'BARDIX Sealed Shakers',
    message: 'Sweep 515: added the on-ledger record of the Bar component (deployed 27 May 2026; 160 transactions, last 26 Aug; seven NFT collection supplies), read at the Gateway on 1 Oct 2026 at state version 560,609,073; infobox row added.',
    apply(blocks) {
      const ext = blocks.findIndex((b) => (b.text || '').startsWith('<h2>External Links</h2>'));
      if (ext < 0) throw new Error('bardix: External Links block not found');
      blocks.splice(ext, 0, { id: uid(), type: 'content', text: bardixRecord });
      const ib = blocks[0].blocks[0];
      const from = '<tr><td><strong>Status</strong></td><td>Active</td></tr>';
      if (!ib.text.includes(from)) throw new Error('bardix: status row not found');
      ib.text = ib.text.replace(from, `${from}\n<tr><td><strong>On-ledger record</strong></td><td>160 transactions, the last on 26 August 2026 (1 October 2026)</td></tr>`);
    },
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
const leaves = (bs) => bs.flatMap((b) => [b, ...(b.blocks || [])]);

try {
  for (const e of edits) {
    if (isLockedPage('ecosystem', e.slug)) throw new Error(`ecosystem/${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ecosystem', e.slug]);
    if (!rows.length) throw new Error(`${e.slug}: page not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (leaves(blocks).some((b) => (b.text || '').includes(e.sentinel))) {
      console.log(`  ${e.slug}: already applied - no write`);
      continue;
    }
    e.apply(blocks);
    assertLinkShapes(blocks, `ecosystem/${e.slug}`);
    if (/[\u2014\u00a0]/.test(earlyBody + earlyLinks + bardixRecord)) throw new Error('em dash or nbsp in new text');
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (${JSON.stringify(page.content).length} -> ${JSON.stringify(blocks).length} chars)`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query(
        'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
        [json, e.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
      await client.query('COMMIT');
      console.log('  written');
    }
  }
} catch (e) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('  FAILED:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
