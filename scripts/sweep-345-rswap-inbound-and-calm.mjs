// Companion to seed-rswap.mjs. Three jobs:
//
// 1. CORRECTION. /ecosystem/reddicks attributed the CALM algorithm to CaviarNine and
//    called it "concentrated-liquidity", then built an argument on it - that "both of
//    RSwap's structural dependencies point at the venue that is leaving". CALM is
//    DefiPlaza's (docs.defiplaza.net/radix/overview: "DefiPlaza's CALM algorithm";
//    OmegaSyndicate/RadixPlaza is described as "CALM (DefiPlaza on Radix)"), and
//    DefiPlaza's docs present it as a deliberate ALTERNATIVE to liquidity
//    concentration. The wiki's own /ecosystem/dogecube already credited it correctly.
//    So one of the two dependencies is CaviarNine's (LSULP) and the other is not.
// 2. DEDUPLICATION. That block was an article about the DEX living on the token's
//    page. It moves to /ecosystem/rswap; reddicks keeps a summary and a link.
//    "Roughly ten pools" is also wrong - the pair API lists 65.
// 3. INBOUND LINKS. caviarnine, deliver and weft-finance all rendered "RSwap" over a
//    link to /ecosystem/reddicks, the DCKS token page. Repointed.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const LINK = '<a href="/ecosystem/rswap" rel="noopener">RSwap</a>';

const REDDICKS_NEW = `<h2>RSwap</h2>
<p>Reddicks operates its own decentralised exchange, <a href="/ecosystem/rswap" rel="noopener"><strong>RSwap</strong></a>, at <a href="https://dex.reddicks.meme" target="_blank" rel="noopener">dex.reddicks.meme</a>. It is built on <a href="/ecosystem/defiplaza" rel="noopener">DefiPlaza</a>'s CALM pair contracts, with swap routing worked on together with <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a>, and it lists 65 pairs of which DCKS quotes 37. The treasury takes a 1% fee on RSwap buys and sells. A secondary game and utility token, DCKSLAP, is minted on-chain by the project's dispenser component.</p>
<p>The venue's own liquidity is the largest thing Reddicks controls. Its deepest pair, LSULP/DCKS, held <strong>17,293,134.15 <a href="https://dashboard.radixdlt.com/resource/resource_rdx1thksg5ng70g9mmy9ne7wz0sc7auzrrwy7fmgcxzel2gvp8pj0xxfmf" target="_blank" rel="noopener">LSULP</a></strong> when read from the <a href="https://docs.radixdlt.com/docs/network-gateway" target="_blank" rel="noopener">Radix Gateway</a> at epoch&nbsp;336,462 (19 August 2026, 23:07&nbsp;UTC), which was 6.5% of all LSULP outstanding and the largest holding on the network after <a href="/ecosystem/weft-finance" rel="noopener">Weft Finance</a>'s. That is a dependency on <a href="/ecosystem/caviarnine" rel="noopener">CaviarNine</a>, whose departure from Radix RSwap answered on <a href="https://t.me/radix_dlt/998767" target="_blank" rel="noopener">19 August 2026</a> by saying it was staying. LSULP cannot be frozen or recalled by its issuer and the LSU Pool's contracts stay callable on ledger, so the position is not at risk of seizure; what a wind-down removes is the venue that quotes it.</p>
<p>RSwap's liquidity, the two incompatible measures of it, and what the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain</a> of 31 August 2026 took out of its pools are covered on <a href="/ecosystem/rswap" rel="noopener">its own page</a>.</p>`;

const EDITS = [
  {
    tagPath: 'ecosystem', slug: 'reddicks', version: '2.0.0', changeType: 'major',
    message: 'Move the RSwap article to /ecosystem/rswap and correct the CALM attribution. CALM is DefiPlaza’s algorithm, not CaviarNine’s, and DefiPlaza presents it as an alternative to liquidity concentration rather than an instance of it, so only one of the two dependencies named here pointed at CaviarNine. "Roughly ten pools" was also wrong: the pair API lists 65.',
    replaceBlock: { match: '<h2>RSwap</h2>', text: REDDICKS_NEW },
  },
  {
    tagPath: 'ecosystem', slug: 'caviarnine', version: '5.4.2', changeType: 'patch',
    message: 'Point the RSwap mention at /ecosystem/rswap. It rendered the DEX’s name over a link to the DCKS token page.',
    from: '<a href="/ecosystem/reddicks" rel="noopener">RSwap</a> LSULP/DCKS pool',
    to: `${LINK} LSULP/DCKS pool`,
  },
  {
    tagPath: 'ecosystem', slug: 'weft-finance', version: '4.9.2', changeType: 'patch',
    message: 'Point the RSwap mention at /ecosystem/rswap. It rendered the DEX’s name over a link to the DCKS token page.',
    from: '<a href="/ecosystem/reddicks" rel="noopener">RSwap</a> LSULP/DCKS pool',
    to: `${LINK} LSULP/DCKS pool`,
  },
  {
    tagPath: 'ecosystem', slug: 'deliver', version: '1.2.1', changeType: 'patch',
    message: 'Point the RSwap mention in the infobox at /ecosystem/rswap. It rendered the DEX’s name over a link to the DCKS token page.',
    from: '<a href="/ecosystem/reddicks" rel="noopener">RSwap</a>',
    to: LINK,
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    const ref = `${e.tagPath}/${e.slug}`;
    if (isLockedPage(e.tagPath, e.slug)) { console.log(`  SKIP ${ref} - LOCKED`); continue; }

    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) { console.log(`  SKIP ${ref} - not found`); continue; }
    const page = rows[0];

    if (JSON.stringify(page.content).includes('/ecosystem/rswap')) {
      console.log(`  SKIP ${ref} - already links the page`);
      continue;
    }

    const blocks = JSON.parse(JSON.stringify(page.content));
    let hits = 0;

    if (e.replaceBlock) {
      const i = blocks.findIndex((b) => (b.text || '').includes(e.replaceBlock.match));
      if (i < 0) { console.log(`  FAIL ${ref} - block "${e.replaceBlock.match}" not found`); continue; }
      const before = blocks[i].text.length;
      blocks[i].text = e.replaceBlock.text;
      hits = 1;
      console.log(`    block ${i}: ${before} -> ${blocks[i].text.length} chars`);
    } else {
      for (const b of blocks) {
        if (typeof b.text === 'string' && b.text.includes(e.from)) { b.text = b.text.split(e.from).join(e.to); hits++; }
        if (b.type === 'infobox') {
          for (const ib of b.blocks || []) {
            if (typeof ib.text === 'string' && ib.text.includes(e.from)) { ib.text = ib.text.split(e.from).join(e.to); hits++; }
          }
        }
      }
      if (!hits) { console.log(`  FAIL ${ref} - anchor not found verbatim, left untouched`); continue; }
    }

    console.log(`  ${DRY ? '[dry] ' : ''}${ref}  v${page.version} -> v${e.version}  (${hits} block(s))`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, e.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
