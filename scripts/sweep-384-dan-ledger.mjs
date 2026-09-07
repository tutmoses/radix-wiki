// Run 384, ecosystem rotation. /ecosystem/dan was the category's stalest never-verified
// page (v1.1.1, updated 30 July 2026, last_verified_at null). Its entire body is one
// auto-generated block in which every claim cites the same Wayback snapshot of the
// project's own marketing site, and that site's domain no longer resolves. Nothing on
// the page had ever been checked against the ledger, where the token still exists.
//
// Read this run, all pinned at state version 557,840,622 (the last state mainnet
// committed before the 31 August halt, so these are the ledger's final numbers):
//   POST mainnet.radixdlt.com/state/entity/details
//     resource_rdx1tk4y4ct50fzgyjygm7j3y6r3cw5rgsatyfnwdz64yp5t388v0atw8w
//     total_supply 100000000000, total_minted 100000000000, total_burned 0, divisibility 18
//     minter / burner / freezer all DenyAll
//     info_url = https://danxrd.xyz, symbol DAN, tags dan/degen/memecoin
//   dig danxrd.xyz A and NS  -> empty, no DNS record (unchanged from the 30 July reading)
//   t.me/dancoinxrd          -> 200, "350 members, 16 online"
//   xread --search from:dancoinxrd -> 0 results
//
// Status stays 🟠 Dormant and is now evidenced rather than asserted. The closing italic
// note about the domain is folded into the new section rather than repeated.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'dan';
const SENTINEL = 'What the ledger says';

const SECTION = `<h2>What the ledger says</h2>
<p>Everything above is drawn from an archived copy of the project&rsquo;s own website and describes what $DAN said about itself. The token is a separate matter, and it is still on the ledger. Read at state version 557,840,622 &ndash; the last state Radix mainnet committed before <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">it halted on 31 August 2026</a>, so these are the ledger&rsquo;s final figures rather than a live reading &ndash; the resource <code>resource_rdx1tk4y4ct50fzgyjygm7j3y6r3cw5rgsatyfnwdz64yp5t388v0atw8w</code> holds a total supply of 100,000,000,000 $DAN at 18 decimal places, all of it minted and none of it burned.</p>
<p>Three of its authorities are closed. The <code>minter</code>, <code>burner</code> and <code>freezer</code> roles are each set to <code>DenyAll</code>, which means no further $DAN can be created, no existing $DAN can be destroyed, and no holder&rsquo;s balance can be frozen. The supply is fixed at what was minted, whatever happens to the people who minted it. Ownership of the resource sits behind a badge, <code>resource_rdx1t4atxnakqgccg34ql22r2hpmnyfrjy9lqa57n8flxxj7nerr2yym6p</code>, so the metadata can still be changed by whoever holds it.</p>
<p>That metadata is where the project&rsquo;s absence shows. The <code>info_url</code> the resource publishes, the pointer a wallet or explorer follows to find out what a token is, reads <code>https://danxrd.xyz</code>, and that domain has no DNS record of any kind: no address record and no name servers, re-checked on 7 September 2026 and unchanged since the reading of 30 July. An unregistered domain can be bought by anyone, and four defunct Radix projects&rsquo; domains have already been re-registered as unrelated landing pages, so the link is not reproduced in this page&rsquo;s facts table. The token points at a website that no longer exists, and only the badge holder can change that.</p>
<p>What is left of the project is the chat. The Telegram group <a href="https://t.me/dancoinxrd" target="_blank" rel="noopener">@dancoinxrd</a> answers with 350 members. A search of X for posts from the handle the resource pages carry, <code>@dancoinxrd</code>, returns none. The status recorded here is dormant rather than closed on that basis: the token exists, its supply cannot be altered, its holders keep it, and nobody is publishing anything about it.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (/[\u00A0\u2014]/.test(SECTION)) throw new Error('new prose contains U+00A0 or an em dash');
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  if (JSON.stringify(page.content).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const blocks = JSON.parse(JSON.stringify(page.content));

  // Fold the closing 30 July website note into the new section rather than repeat it.
  const marker = '<p><em>Website (30 July 2026)';
  const body = blocks[0];
  const at = body.text.indexOf(marker);
  if (at < 0) throw new Error('closing website note not found');
  if (!body.text.trimEnd().endsWith('</em></p>')) throw new Error('website note is not the last paragraph');
  blocks[0] = { ...body, text: body.text.slice(0, at).trimEnd() };

  blocks.push({ id: uid(), type: 'content', text: SECTION });

  const version = '1.2.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (dropped ${body.text.length - blocks[0].text.length} chars of closing note, appended ledger section)`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Added "What the ledger says", the first section on this page sourced from anything other than an archived copy of the project website. Pinned read at state version 557,840,622: total supply 100,000,000,000 $DAN at 18 decimals, all minted, none burned, and minter/burner/freezer all DenyAll, so the supply is fixed. The on-ledger info_url points at danxrd.xyz, which still has no DNS record (re-checked 7 September). Telegram group at 350 members; no X posts from the handle. Dormant status now evidenced rather than asserted. The standalone 30 July website note is folded into the section instead of repeated.',
        now,
      ],
    );
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
