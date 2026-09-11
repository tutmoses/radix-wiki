// scripts/update-stablecoins-flux.mjs
//
// Two pages went stale the moment ecosystem/flux was seeded.
//
// 1. contents/tech/core-concepts/stablecoins opened its Radix section with
//    "Radix has one stablecoin of its own". There are two, both from the ILIS
//    DAO. The same paragraph reads its supplies at the last state version
//    before the August halt and calls the ILIS supply "fixed"; mainnet has
//    since restarted and the supply is below issuance because the token is
//    bought back and burned. Re-read all four resources at one state version.
//
// 2. ecosystem/stabilis describes the ILIS ecosystem as two components. It is
//    three, and the page never mentions Flux.
//
// Supplies re-read from mainnet at epoch 340,004, state version 557,865,161,
// 20:29 UTC on 11 September 2026: STAB 2,642.43, fUSD 5,608.56, ILIS
// 99,982,000, hUSDC 1,092.79.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const SENTINEL = '/ecosystem/flux';

const EDITS = [
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'stablecoins',
    version: '1.2.0',
    changeType: 'minor',
    message:
      'Radix has two native stablecoins, not one: add Flux and $fUSD, re-read all four supplies at state version 557,865,161 after the network restarted, and correct the ILIS supply from "fixed" to below issuance.',
    replacements: [
      [
        'Radix has one stablecoin of its own and one route by which anyone else’s reaches it, and both are small enough to state exactly. <a href="/ecosystem/stabilis" rel="noopener">Stabilis</a> pairs the ILIS DAO, incorporated in the Marshall Islands, with the STAB Protocol, which issues $STAB against Radix-native collateral. Read from the ledger at state version 557,840,622 – the last state <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">mainnet committed before it halted</a> on 31 August 2026 – the STAB resource carries a total supply of <strong>2,642.43</strong> and its governance token ILIS a fixed 99,982,000.',

        'Radix has two stablecoins of its own and one route by which anyone else’s reaches it, and all three are small enough to state exactly. Both native ones answer to the same governing body, the ILIS DAO, incorporated in the Marshall Islands. Its <a href="/ecosystem/stabilis" rel="noopener">STAB Protocol</a> issues $STAB against Radix-native collateral and lets the internal price drift rather than holding a peg; its later protocol, <a href="/ecosystem/flux" rel="noopener">Flux</a>, issues $fUSD against $XRD and liquid-stake-unit collateral at a rigid one-to-one dollar peg, with each borrower setting the interest rate they pay. Read from the ledger at state version 557,865,161 on 11 September 2026, hours after mainnet <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">resumed from its ten-day halt</a>, the STAB resource carries a total supply of <strong>2,642.43</strong> and the fUSD resource <strong>5,608.56</strong>. The DAO’s governance token ILIS stands at 99,982,000, below the 100,000,000 its documentation says was issued, because Flux spends a tenth of the interest it collects buying the token back and burning it.',
      ],
    ],
  },
  {
    tagPath: 'ecosystem',
    slug: 'stabilis',
    version: '2.2.0',
    changeType: 'minor',
    message:
      'The ILIS ecosystem is three protocols, not two: name Flux in the lead and the overview, and add a section pointing at its page.',
    replacements: [
      [
        'comprising two main components: the ILIS DAO and the STAB Protocol.',
        'comprising three main components: the ILIS DAO, the STAB Protocol and <a href="/ecosystem/flux" rel="noopener">Flux</a>.',
      ],
      [
        'the system consists of two main components</a>: the ILIS DAO (I Like It Stable DAO) and the STAB Protocol.',
        'the system consists of three main components</a>: the ILIS DAO (I Like It Stable DAO), the STAB Protocol and Flux.',
      ],
      [
        '<h3>Development History</h3>',
        '<h3>Flux</h3>\n<p><a href="/ecosystem/flux" rel="noopener">Flux</a> is the second protocol governed by the ILIS DAO, live on Radix mainnet since 31 May 2025 and described by the DAO as the successor to the STAB Protocol. It issues $fUSD against $XRD and $LSULP collateral, holds it to a rigid one-to-one dollar peg rather than letting an internal price drift, and lets each borrower set the interest rate on their own loan. A tenth of the interest it collects buys $ILIS back and burns it.</p>\n<h3>Development History</h3>',
      ],
    ],
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const edit of EDITS) {
    const where = `${edit.tagPath}/${edit.slug}`;
    if (isLockedPage(edit.tagPath, edit.slug)) throw new Error(`${where} is LOCKED`);

    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [edit.tagPath, edit.slug],
    );
    if (!rows.length) throw new Error(`${where} not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(SENTINEL)) {
      console.log(`  ${where}: already links ${SENTINEL} — no write`);
      continue;
    }

    for (const [find, put] of edit.replacements) {
      const hits = blocks.filter((b) => typeof b.text === 'string' && b.text.includes(find));
      if (hits.length !== 1) {
        const codes = [...find.slice(0, 60)].map((ch) => ch.charCodeAt(0)).join(' ');
        throw new Error(`${where}: find-string matched ${hits.length} blocks, expected 1\n  "${find.slice(0, 80)}"\n  codepoints: ${codes}`);
      }
      hits[0].text = hits[0].text.replace(find, put);
    }

    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${edit.version}  (${edit.replacements.length} replacement(s))`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
        [json, edit.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, edit.version, edit.changeType, AUTHOR_ID, edit.message, now]);
      await client.query('COMMIT');
    }
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
