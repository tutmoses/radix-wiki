// Sweep 559: the History of Radix hub still gave Xi'an as "targeting 2027" in three places.
// That date is from the Radix Labs roadmap of 30 Nov 2024 (radixdlt.com/blog/radix-labs-roadmap---to-hyperscale-and-beyond),
// whose sharded-Radix-Engine track was dropped in Aug 2026 for a purpose-built VM; the hyperscale-rs
// lead has declined to give new dates (recorded on /contents/tech/research/hyperscale-rs). Also: Scrypto
// is an SDK, not a language; the Dan Hughes section's eulogy and unsourced "DeFi continued to grow"
// bullet go; em dashes in the composability section become colons and commas.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = '';
const SENTINEL = 'xian-schedule';
const ROADMAP = 'https://www.radixdlt.com/blog/radix-labs-roadmap---to-hyperscale-and-beyond';
const HSRS = '/contents/tech/research/hyperscale-rs';
const XIAN = '/contents/tech/releases/radix-mainnet-xian';

const EDITS = [
  // infobox
  [`Xi'an</a> (targeting 2027)</td>`,
   `Xi'an</a>, in development as <a href="${HSRS}">hyperscale-rs</a>; no current date</td>`],
  // Babylon list
  [`– Radix's <a href="/contents/tech/core-concepts/asset-oriented-programming">asset-oriented</a> programming language</li>`,
   `– Radix's Rust SDK for writing <a href="/contents/tech/core-concepts/asset-oriented-programming">asset-oriented</a> smart contracts</li>`],
  // Dan Hughes section
  [`<p>Dan Hughes, the founder and visionary behind Radix, passed away on <strong>July 27, 2025</strong>. His death was a profound loss for the Radix community and the broader distributed systems field. Hughes had dedicated over a decade to solving the scalability trilemma, and his work on <a href="https://arxiv.org/abs/2008.04450" target="_blank" rel="noopener" title="Cerberus: Sharded BFT Consensus">Cerberus consensus</a> represents one of the most significant contributions to distributed ledger research.</p>\n<p>In the months following his passing, the Radix community demonstrated remarkable resilience:</p>`,
   `<p>Dan Hughes, who founded Radix, died on <strong>27 July 2025</strong>. He had spent more than a decade on how a ledger could scale without giving up composability, work published as the <a href="https://arxiv.org/abs/2008.04450" target="_blank" rel="noopener" title="Cerberus: Sharded BFT Consensus">Cerberus consensus paper</a>.</p>\n<p>In the months after his death:</p>`],
  [`<a href="/contents/tech/research/hyperscale-rs">Hyperscale-RS</a>, a community-led implementation, continued development</li>\n  <li>The <a href="/contents/tech/releases/radix-mainnet-xian">Xi'an roadmap</a> was maintained and advanced by Radix Labs</li>\n  <li>The <a href="https://en.wikipedia.org/wiki/Decentralized_finance" target="_blank" rel="noopener" title="Decentralized Finance">DeFi</a> ecosystem continued to grow and mature</li>\n</ul>\n<p>Hughes' vision of a scalable, composable, <a href="/contents/tech/core-concepts/asset-oriented-programming">asset-oriented</a> ledger lives on in the protocol he created and the community he inspired.</p>`,
   `<a href="/contents/tech/research/hyperscale-rs">hyperscale-rs</a>, a community-led implementation, continued development</li>\n</ul>`],
  // Road to Xi'an
  [`<h2>Road to Xi'an (2025–2027)</h2>`, `<h2>Road to Xi'an</h2>`],
  [/<p>With that work and the <a href="https:\/\/docs\.radixdlt\.com\/docs\/cuttlefish"[\s\S]*?serve the world\.<\/p>/,
   `<p id="${SENTINEL}">The last schedule Radix published for Xi'an is the <a href="${ROADMAP}" target="_blank" rel="noopener">Radix Labs roadmap of 30 November 2024</a>, which put its launch in the second half of 2027 and planned to get there by sharding the Radix Engine. The virtual machine replaced that plan, the lead developer of hyperscale-rs <a href="${HSRS}">has declined to give new dates</a>, and nobody has published one since.</p>`],
  // Composability section
  [`<h2>The Composability Gap (2020–2027)</h2>`, `<h2>The Composability Gap</h2>`],
  [/<p>One thread runs through the whole of this timeline[\s\S]*?has never run on a Radix production network\.<\/p>/,
   `<p>The property Radix was built to deliver has been demonstrated once, in a prototype, and has never run on a Radix production network: <a href="/contents/tech/core-concepts/atomic-composability">atomic composability</a> across <a href="/contents/tech/core-concepts/sharding">shards</a>, so that a single transaction touching state on many shards either commits everywhere or nowhere.</p>`],
  [`<strong>December 2020</strong> \u2014 the`, `<strong>December 2020</strong>: the`],
  [`<strong>28 July 2021</strong> \u2014 <a`, `<strong>28 July 2021</strong>: <a`],
  [`<strong>28 September 2023</strong> \u2014 <a`, `<strong>28 September 2023</strong>: <a`],
  [`smart accounts</a> \u2014 and also runs`, `smart accounts</a>, and also runs`],
  [/<li><strong>2027<\/strong> \u2014 multiple shard groups[\s\S]*?takes nothing from the Flexathon build\.<\/li>/,
   `<li><strong>30 November 2024</strong>: the <a href="${ROADMAP}" target="_blank" rel="noopener">Radix Labs roadmap</a> scheduled multiple shard groups for <a href="${XIAN}">Xi'an</a> in 2027, on a sharded Radix Engine. That plan was dropped in August 2026. The work proceeds in <a href="${HSRS}">hyperscale-rs</a>, on a purpose-built virtual machine, with no published date, and takes nothing from the Flexathon build.</li>`],
  [`<p>Six years separate the demonstration from the network that is meant to run it, and the`,
   `<p>Nearly six years have passed since the demonstration, and the`],
  [` misses what actually shipped; reading the demonstrations as production capability overstates what runs today. Both halves belong in the record.</p>`,
   ` misses what shipped; reading the demonstrations as production capability overstates what runs today.</p>`],
];

const swap = (b, from, to) => {
  let n = 0;
  const hit = typeof from === 'string' ? b.text?.includes(from) : from.test(b.text ?? '');
  if (hit) { b.text = b.text.replace(from, to); n++; }
  for (const c of b.blocks ?? []) n += swap(c, from, to);
  return n;
};

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error('history hub is LOCKED');
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied – no write'); return; }
  for (const [from, to] of EDITS) {
    const n = blocks.reduce((s, b) => s + swap(b, from, to), 0);
    if (n !== 1) throw new Error(`edit matched ${n} times: ${String(from).slice(0, 60)}`);
  }
  if (/\u2014/.test(JSON.stringify(blocks))) console.log('  note: em dash still present elsewhere');
  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: "Xi'an no longer given as 'targeting 2027': that is the Radix Labs roadmap of 30 Nov 2024, whose sharded-Radix-Engine track was dropped Aug 2026; hyperscale-rs has no published date. Infobox, Road to Xi'an closing paragraph and the composability timeline's 2027 entry rewritten; Scrypto described as Rust SDK; Dan Hughes section's eulogy and unsourced DeFi-growth and Radix Labs bullets removed; em dashes replaced.",
    verified: true, dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
