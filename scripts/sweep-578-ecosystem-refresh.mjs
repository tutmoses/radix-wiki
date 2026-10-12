// Run 578 (ecosystem rotation): staleness head and orphans. The RADIX.wiki entry gave 377 pages and the
// database holds 381; every other fact on it (XRD gates in src/lib/tags.ts, fourteen block types, the
// stack in package.json, /api/mcp) re-checked and current. $HYDR re-read on 12 October 2026: supply still
// 965,199,999, so the weekly burns that paused through the halt never resumed. Three pages linked from
// no other article gain an inbound link: Fidenaro and 3Syde, the two Radix copy-trading projects, name
// each other, and RadixRadio's episode list links Nerds Republic.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const HYDR = 'https://dashboard.radixdlt.com/resource/resource_rdx1t4kc2yjdcqprwu70tahua3p8uwvjej9q3rktpxdr8p5pmcp4almd6r';

const EDITS = [
  {
    tagPath: 'ecosystem',
    slug: 'radix-wiki',
    change: 'patch',
    verified: true,
    sentinel: 'hosts 381 pages',
    swaps: [['hosts 377 pages', 'hosts 381 pages']],
    message: 'Page count 377 -> 381, counted in the pages table 12 Oct 2026. XRD gates (src/lib/tags.ts), the fourteen block types (src/types/blocks.ts), the stack (package.json) and the /api/mcp route re-checked against the code and unchanged.',
  },
  {
    tagPath: 'ecosystem',
    slug: 'hydraswap',
    change: 'minor',
    verified: true,
    sentinel: 'never resumed',
    swaps: [
      [
        '(read on-ledger 16 September 2026, epoch 341331, state version 558418248)',
        '(read on-ledger 12 October 2026, epoch 348868, state version 562704064)',
      ],
      [
        'rel="noopener">network halt</a>.',
        `rel="noopener">network halt</a>. The burns never resumed after it: <a href="${HYDR}" target="_blank" rel="noopener">re-read</a> on 12 October 2026 (epoch 348868, state version 562704064), the supply was still 965,199,999, so none has been burned since 14 September.`,
      ],
    ],
    message: '$HYDR re-read 12 Oct 2026 at epoch 348868, state version 562704064: supply unchanged at 965,199,999. The weekly 100,000 burns that paused through the network halt never resumed; the last was 14 Sep. Infobox read date refreshed; hydraxrd.com/swap answers 200.',
  },
  {
    tagPath: 'ecosystem',
    slug: 'fidenaro',
    change: 'patch',
    sentinel: 'href="/ecosystem/3syde"',
    swaps: [[
      'the transaction model underpinning on-ledger copy trading</li></ul>',
      'the transaction model underpinning on-ledger copy trading</li><li><a href="/ecosystem/3syde" rel="noopener">3Syde</a> – a Radix trading toolkit whose plans also include follow-and-copy trading, likewise not launched on mainnet</li></ul>',
    ]],
    message: 'See also: 3Syde, the other Radix project planning copy trading, previously linked from no article.',
  },
  {
    tagPath: 'ecosystem',
    slug: '3syde',
    change: 'patch',
    sentinel: 'href="/ecosystem/fidenaro"',
    swaps: [[
      'allowing beginners to learn from experienced traders and experienced traders to diversify their approaches.</li>',
      'allowing beginners to learn from experienced traders and experienced traders to diversify their approaches. <a href="/ecosystem/fidenaro" rel="noopener">Fidenaro</a> set out to build the same feature on Radix, and its beta never left Stokenet.</li>',
    ]],
    message: 'Social Trading: names Fidenaro, the other Radix copy-trading project, previously linked from no article.',
  },
  {
    tagPath: 'ecosystem',
    slug: 'radixradio',
    change: 'patch',
    sentinel: 'href="/ecosystem/nerds-republic"',
    swaps: [['his projects Nerds Republic and', 'his projects <a href="/ecosystem/nerds-republic" rel="noopener">Nerds Republic</a> and']],
    message: 'Episode 4: Nerds Republic links its wiki page, previously linked from no article.',
  },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.slug}: page not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(e.sentinel)) {
      console.log(`  ${page.title}: already applied – no write`);
      continue;
    }
    const walk = (bs) => bs.flatMap((b) => [b, ...(b.blocks ? walk(b.blocks) : [])]);
    for (const [find, replace] of e.swaps) {
      const hits = walk(blocks).filter((b) => b.text?.includes(find));
      if (hits.length !== 1) throw new Error(`${e.slug}: anchor found ${hits.length} times: ${find.slice(0, 60)}`);
      hits[0].text = hits[0].text.replace(find, replace);
    }

    const version = await writeRevision(client, page, blocks,
      { change: e.change, message: e.message, verified: e.verified, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
