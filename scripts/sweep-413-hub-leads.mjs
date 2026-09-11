/**
 * sweep 413 — the category hubs that introduce a listing by retelling it.
 *
 * Sweep 412 cut the Ecosystem hub; measuring the rest showed three more hubs
 * with the same shape, an introduction followed by a section that walks each
 * child page in turn, above a card grid that already carries every one of those
 * titles with a snippet. Measured at 1280px on 11 September 2026, the first
 * card sat 1,683px down on Research, 1,659px on Releases and 1,218px on
 * Comparisons.
 *
 * Each hub keeps its infobox, a lead, and the one section that says something
 * the cards cannot: how a status is judged; what the Hyperscale test actually
 * measured; how a protocol release reaches the network; why a comparison
 * written on a Radix wiki should be read carefully.
 *
 * Ecosystem is cut a second time, from four paragraphs to two.
 *
 * Not touched, and why:
 *   contents/history and developers  — the article is the page, not a blurb
 *     over a listing, and /developers routes to its subsections so no grid is
 *     suppressed behind it
 *   contents/tech                    — links every child, so the card grid is
 *     already suppressed; the whole page is 1,601px
 *   policy                           — its seven-row table adds the type, the
 *     question and the enforcement of each policy, which the cards do not carry
 *
 * Run:  node scripts/sweep-413-hub-leads.mjs [--dry-run]
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');

const HUBS = [
  {
    tagPath: 'ecosystem',
    version: '2.2.0',
    changeType: 'minor',
    sentinel: 'so more than half of the pages below',
    excerpt: 'A directory of the projects built on Radix or serving it, the closed ones included, with what each entry records and how its status is judged.',
    blocks: [
      `<p>This section is a directory of the projects built on <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix</a> or built to serve it. An entry stays after the project stops, so more than half of the pages below describe something that has ended.</p>`,
      `<h2>How a status is decided</h2><p>The <code>status</code> on each page records whether the people behind a project are still operating it, not whether its website answers: a domain outlives the project on it. The <a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">operational-status index</a> groups every entry by status and sets out the checks that settle it.</p>`,
    ],
    message:
      'Halve the hub a second time, from four paragraphs to two. The entry shape, the two context links and the Gateway caveat go; the caveat is on the operational-status index, which this page links twice. The excerpt stops carrying a page count, which the results bar states live and which moved the day it was written.',
  },
  {
    tagPath: 'contents/tech/research',
    version: '2.0.0',
    changeType: 'major',
    sentinel: 'each names a failure mode the next design had to survive',
    blocks: [
      `<p>Most of Radix exists because one problem was refused for thirteen years: a single-threaded ledger cannot serve the world&rsquo;s financial traffic, and bigger or faster blocks buy time rather than remove the ceiling. This section holds the designs tried against it, from <a href="/contents/tech/research/emunie" rel="noopener">eMunie</a> in 2013 through <a href="/contents/tech/research/tempo-consensus-mechanism" rel="noopener">Tempo</a> and <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a> to <a href="/contents/tech/research/cassandra" rel="noopener">Cassandra</a>. The abandoned ones are kept because each names a failure mode the next design had to survive.</p>`,
      `<h2>Hyperscale, and what the tests measured</h2><p>The current line is Hyperscale. In January 2026 the Radix Foundation sustained more than 500,000 transactions per second, peaking above 700,000, on commodity AWS instances of four cores and 16&nbsp;GB each. That measured the Foundation&rsquo;s implementation: it was not a measurement of Cerberus as specified, and the braided cross-shard consensus in the Cerberus paper has not shipped in any implementation. <a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a>, the community-built Rust implementation led by flightofthefox of proven.network, is the leading candidate to deliver <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi&rsquo;an</a>.</p>`,
    ],
    message:
      'Cut the page-by-page walk of eMunie, Tempo, Cerberus and Cassandra, which the card grid below already lists with a snippet each, and the closing section arguing for keeping the record, which is now a clause in the lead. What the 500,000 TPS test measured, and did not, is kept in full.',
  },
  {
    tagPath: 'contents/tech/releases',
    version: '2.0.0',
    changeType: 'major',
    sentinel: 'added a layer the last had done without',
    blocks: [
      `<p>Radix names its major network releases after cities of the ancient world, and each added a layer the last had done without: <a href="/contents/tech/releases/radix-mainnet-olympia" rel="noopener">Olympia</a> opened the public ledger in July 2021 with staking and the native <a href="/contents/tech/core-protocols/xrd-token" rel="noopener">XRD</a> token and no smart contracts at all; <a href="/contents/tech/releases/radix-developer-environment-alexandria" rel="noopener">Alexandria</a> gave developers a <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a> environment in December 2021, for an engine mainnet could not yet run; <a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">Babylon</a> brought that engine live on 28 September 2023; and <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi&rsquo;an</a> is where <a href="/contents/tech/core-concepts/sharding" rel="noopener">sharding</a>, the half of the design every release so far has deferred, has to arrive.</p>`,
      `<h2>How a release lands</h2><p>A release changes the rules every node runs, so it cannot be adopted piecemeal: operators upgrade, the validator set signals readiness, and the network crosses over at a nominated epoch. Smaller <a href="/contents/tech/releases/protocol-updates" rel="noopener">protocol updates</a> land two to three times a year, and Radix&rsquo;s documentation notes that these are what other networks call hard forks. <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a>, the public test network, carries the same protocol version as mainnet and is periodically reset, which destroys every balance and deployed package on it.</p>`,
    ],
    message:
      'Compress the four mainnets to a clause each in the lead and cut the closing reading of the sequence; the cards below carry Olympia, Alexandria, Babylon, Xi’an, Stokenet and RCnet with a snippet each. What a release does to a running network, which no card states, becomes the one section.',
  },
  {
    tagPath: 'contents/tech/comparisons',
    version: '2.0.0',
    changeType: 'major',
    sentinel: 'a list of adjectives, so each page here',
    blocks: [
      `<p>Radix makes choices that have no counterpart on most networks: assets are engine primitives rather than balances inside contracts, authority is carried by <a href="/contents/tech/core-concepts/badges" rel="noopener">badges</a> that are themselves <a href="/contents/tech/core-concepts/resources" rel="noopener">resources</a>, and the state model is sharded by design rather than by appended rollups. Described in isolation those choices read as a list of adjectives, so each page here takes one network the reader already knows and works out where Radix diverges, what the divergence buys and what it costs.</p>`,
      `<h2>How to read them</h2><p><a href="/contents/tech/comparisons/radix-vs-ethereum" rel="noopener">Radix vs Ethereum</a> is the load-bearing one, because the account-and-contract model is the picture most readers arrive with. All of these pages are written on a wiki about Radix, so read them with the caution that deserves: where a claim is contested or a Radix feature has not shipped they say so, and Radix&rsquo;s branch of the architectural fork is the one with the least mainnet evidence behind it.</p>`,
    ],
    message:
      'Cut the walk through the Solana, Cosmos, Polkadot and BFT comparisons, which the infobox names and the cards below list with a snippet each. The caution about who wrote them, and the Ethereum page that carries most of the weight, stay.',
  },
];

const strip = (html) => html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
});
const client = await pool.connect();

try {
  for (const hub of HUBS) {
    if (isLockedPage(hub.tagPath, '')) throw new Error(`${hub.tagPath} hub is LOCKED`);

    const { rows } = await client.query(
      "SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = ''",
      [hub.tagPath],
    );
    if (!rows.length) throw new Error(`no hub page at ${hub.tagPath}`);
    const page = rows[0];

    if (JSON.stringify(page.content).includes(hub.sentinel)) {
      console.log(`  ${hub.tagPath}: already applied — no write`);
      continue;
    }

    const infobox = page.content.find((b) => b.type === 'infobox');
    const content = [
      ...(infobox ? [infobox] : []),
      ...hub.blocks.map((text) => ({ id: uid(), type: 'content', text })),
    ];

    const textOf = (blocks) => blocks
      .filter((b) => b.type !== 'infobox')
      .reduce((n, b) => n + strip(b.text ?? '').length, 0);
    const before = textOf(page.content);
    const after = textOf(content);

    console.log(`  ${DRY ? '[dry] ' : ''}${hub.tagPath} — ${page.title}  v${page.version} -> v${hub.version}`);
    console.log(`      blocks ${page.content.length} -> ${content.length}, prose ${before} -> ${after} words-of-text chars (${Math.round((1 - after / before) * 100)}% cut)`);

    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(content);
      const metadata = hub.excerpt
        ? JSON.stringify({ ...(page.metadata ?? {}), excerpt: hub.excerpt })
        : JSON.stringify(page.metadata ?? {});
      await client.query('BEGIN');
      await client.query(
        'UPDATE pages SET content = $1, version = $2, metadata = $3, updated_at = $4 WHERE id = $5',
        [json, hub.version, metadata, now, page.id],
      );
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, hub.version, hub.changeType, AUTHOR_ID, hub.message, now],
      );
      await client.query('COMMIT');
      console.log('      written');
    }
  }
} finally {
  client.release();
  await pool.end();
}
