// Sweep 560: /ecosystem/radix-labs still gave the Radix Labs roadmap of 30 Nov 2024 as a live target
// ("Target: Xi'an Alpha early 2027, full launch H2 2027") and, in a present-tense Roadmap section, said
// "the Xi'an track targets" those dates. Its Overview called Cerberus "Xi'an's consensus design" and had a
// dormant body "continuing core protocol development". The roadmap's plan was a sharded Radix Engine; that
// was dropped on 1 Aug 2026 for a purpose-built VM (t.me/hyperscale_rs/10334, recorded on
// /contents/tech/research/hyperscale-rs). Same correction run 559 made on the history hub. The redundant
// Roadmap section goes (the dormancy section already summarises the three tracks); the unsourced Radix
// Accountability Council line goes; radixdlt.com/labs re-read 9 Oct 2026, unchanged.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'radix-labs';
const SENTINEL = 'labs-xian-overtaken';
const ROADMAP = 'https://www.radixdlt.com/blog/radix-labs-roadmap---to-hyperscale-and-beyond';
const HSRS = '/contents/tech/research/hyperscale-rs';
const VM_MSG = 'https://t.me/hyperscale_rs/10334';
const ROADMAP_BLOCK = 'fe9895d1-ebee-4695-ab1b-81b81a22ad9b';

const EDITS = [
  // infobox
  [`<td><strong>Target</strong></td><td>Xi'an Alpha early 2027, full launch H2 2027, as set out in the <a href="${ROADMAP}" target="_blank" rel="noopener">roadmap of 30 November 2024</a>; no revision published since</td>`,
   `<td><strong>Last schedule</strong></td><td>The <a href="${ROADMAP}" target="_blank" rel="noopener">roadmap of 30 November 2024</a> put Xi'an's launch in H2 2027 on a sharded Radix Engine. That plan was dropped in August 2026 and no date has replaced it</td>`],
  // Overview
  [`, and the successor development entity to <a href="/ecosystem/rdx-works">RDX Works</a>, continuing core protocol development for the <a href="https://www.radixdlt.com" target="_blank" rel="noopener" title="Radix DLT">Radix network</a>. Its stated mission is`,
   `, and the successor development entity to <a href="/ecosystem/rdx-works">RDX Works</a> for the <a href="https://www.radixdlt.com" target="_blank" rel="noopener" title="Radix DLT">Radix network</a>. It has had no development team since June 2026 (<a href="#labs-dormant-2026">below</a>). Its stated mission is`],
  [/<p>Xi'an's consensus design is the fully sharded <a href="\/contents\/tech\/core-protocols\/cerberus-consensus-protocol">Cerberus<\/a> protocol[\s\S]*?on protocol governance\.<\/p>/,
   `<p id="${SENTINEL}">Radix Labs planned Xi'an as the <a href="/contents/tech/core-protocols/cerberus-consensus-protocol">Cerberus</a> consensus protocol running over a sharded <a href="/contents/tech/core-protocols/radix-engine">Radix Engine</a>, with the <a href="/contents/tech/research/cassandra">Cassandra</a> prototype as its test platform. The implementation now carrying Xi'an, <a href="${HSRS}">hyperscale-rs</a>, departs from both: its per-shard consensus derives from HotStuff-2, and on <a href="${VM_MSG}" target="_blank" rel="noopener">1 August 2026</a> its lead developer confirmed a purpose-built virtual machine in place of the Radix Engine, which he said was <q>not in the ballpark</q> for sharding.</p>`],
  // dormancy section
  [`<a href="https://www.radixdlt.com/labs" target="_blank" rel="noopener">The Radix Labs page</a>, read on 9 September 2026, still calls`,
   `<a href="https://www.radixdlt.com/labs" target="_blank" rel="noopener">The Radix Labs page</a>, read again on 9 October 2026, still calls`],
];

const swap = (b, from, to) => {
  let n = 0;
  const hit = typeof from === 'string' ? b.text?.includes(from) : from.test(b.text ?? '');
  if (hit) { b.text = b.text.replace(from, to); n++; }
  for (const c of b.blocks ?? []) n += swap(c, from, to);
  return n;
};

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  let blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied – no write'); return; }
  for (const [from, to] of EDITS) {
    const n = blocks.reduce((s, b) => s + swap(b, from, to), 0);
    if (n !== 1) throw new Error(`edit matched ${n} times: ${String(from).slice(0, 60)}`);
  }
  const before = blocks.length;
  blocks = blocks.filter((b) => b.id !== ROADMAP_BLOCK);
  if (blocks.length !== before - 1) throw new Error('Roadmap block not found');
  if (/2027<\/strong>|targets an/.test(JSON.stringify(blocks))) throw new Error('live 2027 target still present');
  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: "Xi'an's 2027 dates no longer given as a live target: they are the Radix Labs roadmap of 30 Nov 2024, whose sharded-Radix-Engine plan was dropped on 1 Aug 2026 for a purpose-built VM (t.me/hyperscale_rs/10334). Infobox Target row becomes Last schedule; Overview no longer calls Cerberus Xi'an's consensus design or the dormant Labs active; redundant present-tense Roadmap section removed; unsourced Accountability Council line removed; radixdlt.com/labs re-read 9 Oct 2026, unchanged.",
    verified: true, dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
