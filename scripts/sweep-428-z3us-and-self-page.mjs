// sweep 428 — ecosystem rotation. The two thin, stale pages at the head of the queue that
// still had facts to check (unisci and vikingland ahead of them were verified 8 September).
//
// /ecosystem/z3us (v2.0.2, 1,460 chars, last edited 3 August) cited z3us.com for every
// claim. Read 14 September 2026: www.z3us.com is GitHub Pages serving a 1-byte index,
// last-modified Fri, 01 May 2026 00:01:55 GMT; Wayback holds the full 12.5 KB product page
// at 20260411141708 and ~850 B empty captures at 20260514055320 and 20260518182150. The
// site's source link github.com/z3us-dapps/z3us answers 404, and the org's only public repo
// is z3us-nft (pushed 2024-06-11). The Chrome Web Store listing
// (icpikagpkkbldbfjlbefnmmmcohbjije) is live: 2.0.49, updated 19 October 2024, 4,000 users,
// 3.9 from 19 ratings. Status stays Dormant because the extension is still installable.
// The unsourced History paragraph (founded 2021) contradicts metadata.founded 2022-04-01;
// left as it stands and banked rather than guessed.
//
// /ecosystem/radix-wiki (v3.2.0) had drifted from the code: 348 articles (377 page rows
// on 14 September), XRD gates of "5,000-50,000" (src/lib/tags.ts: create 10,000 default,
// 20,000 ecosystem, 50,000 blog; edit 20,000 default, 10,000 ideas; comment 10,000), the
// community section (retired 9 September) and RFPs as author-only (AUTHOR_ONLY_PATHS is
// blog alone), sixteen block types (src/types/blocks.ts has fourteen), Next.js 15
// (package.json ^16.3.0), and no mention of /api/mcp, the most-visited path on the site.
//
// Run:  node scripts/sweep-428-z3us-and-self-page.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const CWS = 'https://chromewebstore.google.com/detail/z3us/icpikagpkkbldbfjlbefnmmmcohbjije';

const Z3US_TEXT = [
  `<p><strong>Z3US</strong> is an open-source browser extension wallet for the Radix network, which its ${A(CWS, 'Chrome Web Store listing')} describes as community-centred. The extension was last updated in October 2024, and since May 2026 its website has served an empty page.</p>`,
  `<h2>Functionality</h2>`,
  `<p>The ${A('https://web.archive.org/web/20260411141708/https://www.z3us.com/', 'last archived copy of z3us.com with content')}, from 11 April 2026, lists managing accounts and multiple wallets, importing existing wallets alongside new ones, sending and receiving tokens, connecting to dApps, an address book, viewing and transferring NFTs, and asset and transaction analytics.</p>`,
  `<h2>History</h2>`,
  `<p>The project was founded in 2021 and launched its Beta version in June of the same year. By August 2021, Z3US had integrated with decentralized exchanges (DEX).</p>`,
  `<h2>Roadmap</h2>`,
  `<p>The ${A('https://web.archive.org/web/20230225221454/https://z3us.com/roadmap', 'roadmap')} archived in February 2023 planned Babylon upgrades for the first half of 2023 and a Z3US iOS app for the second half.</p>`,
  `<h2>Status (September 2026)</h2>`,
  `<p>Read on 14 September 2026:</p>`,
  `<ul>`,
  `<li>The ${A(CWS, 'Chrome Web Store listing')} is live and installable at version 2.0.49, last updated on 19 October 2024, with 4,000 users and a 3.9 rating from 19 ratings.</li>`,
  `<li>${A('https://www.z3us.com/', 'z3us.com')} is served by GitHub Pages and returns a one-byte page, last modified at 00:01 UTC on 1 May 2026. Wayback Machine captures from 14 and 18 May 2026 are already empty.</li>`,
  `<li>The source repository the site linked, github.com/z3us-dapps/z3us, returns 404. The only public repository left in the ${A('https://github.com/z3us-dapps', 'z3us-dapps organisation')} is z3us-nft, last pushed on 11 June 2024.</li>`,
  `</ul>`,
  `<p>The status stays Dormant: the extension can still be installed.</p>`,
].join('\n');

const SELF_REPLACEMENTS = [
  ['the site hosts 348 articles, ecosystem listings and community pages, all with a view',
   'the site hosts 377 pages of articles, ecosystem listings, developer guides and essays, all with a view'],
  ['(e.g., contents, ecosystem, community)', '(e.g., contents, ecosystem, developers)'],
  ['Creating pages requires 5,000–50,000 XRD depending on the section, editing requires 20,000 XRD, and commenting requires 10,000 XRD. Some sections (community, blog, RFPs) are author-only.',
   'Creating a page requires a balance of 10,000 XRD in most sections, 20,000 XRD in the ecosystem directory and 50,000 XRD on the blog. Editing requires 20,000 XRD (10,000 XRD on the ideas board), and commenting requires 10,000 XRD. The balance is checked, never spent. Blog essays are author-only.'],
  ['Author-only sections (community pages, blog, RFPs) help address this for personal content.',
   'The blog is author-only, which addresses this for personal essays.'],
  ['sixteen block types, including rich text, columns, infoboxes, recent pages, page lists, asset price widgets, code tabs, stats, link grids and references.',
   'fourteen block types, including rich text, columns, infoboxes, recent pages, page lists, asset price widgets, code tabs, stats, link grids, references, banners, RSS feeds, testimonials and tip jars.'],
  ['Next.js 15 (App Router)', 'Next.js 16 (App Router)'],
  ['<li><p>Full revision history with structured diffs.</p></li>',
   '<li><p>Full revision history with structured diffs.</p></li><li><p>A Model Context Protocol server at <code>/api/mcp</code> that lets AI agents search and read the wiki.</p></li>'],
];

const EDITS = [
  {
    slug: 'z3us',
    version: '2.1.0',
    sentinel: 'Status (September 2026)',
    apply(blocks) {
      if (blocks.length !== 1 || blocks[0].type !== 'content') throw new Error('z3us: unexpected block shape');
      blocks[0].text = Z3US_TEXT;
    },
    message:
      'New Status (September 2026) section. Chrome Web Store listing: v2.0.49, updated 19 October 2024, 4,000 users. z3us.com has served an empty GitHub Pages index since 1 May 2026 (last-modified header; Wayback captures 14 and 18 May), and github.com/z3us-dapps/z3us returns 404. Functionality re-cited to the 11 April 2026 Wayback capture; unsourced security claim and filler Radix paragraph removed. Status stays Dormant.',
  },
  {
    slug: 'radix-wiki',
    version: '3.3.0',
    sentinel: 'fourteen block types',
    apply(blocks) {
      for (const [from, to] of SELF_REPLACEMENTS) {
        const hits = blocks.filter((b) => b.text?.includes(from));
        if (hits.length !== 1) throw new Error(`radix-wiki: expected 1 match for "${from.slice(0, 40)}", found ${hits.length}`);
        hits[0].text = hits[0].text.replace(from, to);
      }
    },
    message:
      'Facts re-read from the code and DB: 377 pages (was 348 articles); XRD gates per src/lib/tags.ts (create 10,000 / 20,000 ecosystem / 50,000 blog, edit 20,000 / 10,000 ideas, comment 10,000); blog is the only author-only section (community retired 9 September, no RFPs); fourteen block types (was sixteen); Next.js 16; adds the /api/mcp MCP server.',
  },
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage('ecosystem', e.slug)) throw new Error(`ecosystem/${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      ['ecosystem', e.slug],
    );
    if (!rows.length) throw new Error(`ecosystem/${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));

    if (blocks.some((b) => b.text?.includes(e.sentinel))) {
      console.log(`  ecosystem/${e.slug}: already applied — no write`);
      continue;
    }
    e.apply(blocks);

    console.log(`  ${DRY ? '[dry] ' : ''}ecosystem/${e.slug}  v${page.version} -> v${e.version}`);
    if (DRY) continue;

    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json, e.version, now, page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, 'minor', AUTHOR_ID, e.message, now],
    );
    await client.query('COMMIT');
    console.log('    written');
  }
} finally {
  client.release();
  await pool.end();
}
