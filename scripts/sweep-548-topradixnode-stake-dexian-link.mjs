// Sweep 548: TopRadixNode's stranded stake re-read on-ledger (radixscan, live, epoch 347283, 03:04 UTC 7 Oct 2026:
// 24,917,368 XRD, still unregistered; Juicy Stake 12,000,281 XRD, so "roughly twice" still holds). The "(from a former ~2%)"
// parenthetical is the stored fee next to the charged one, which the 1 Oct scope change keeps off the wiki.
// DeXian Protocol, closed and orphaned, gets an inbound link from the LSU page's instant-exit paragraph.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const S = '[\\s\\u00a0]+';

const EDITS = [
  {
    tagPath: 'ecosystem', slug: 'topradixnode', sentinel: '24,917,368', change: 'patch', verified: true,
    subs: [
      [new RegExp(`its${S}validator${S}fee${S}has${S}been${S}raised${S}to${S}25%${S}\\(from${S}a${S}former${S}~2%\\)`), 'its validator fee has been raised to 25%'],
      [new RegExp(`At${S}epoch${S}331662${S}\\(3${S}August${S}2026\\)${S}<strong>25,392,103${S}XRD${S}remained${S}delegated${S}to${S}it</strong>`),
        'At epoch 347,283 (7 October 2026) <strong>24,917,368 XRD remained delegated to it</strong>, down from 25,392,103 XRD on 3 August'],
    ],
    message: 'Stranded stake re-read on-ledger at epoch 347,283 (7 Oct 2026): 24,917,368 XRD, validator still unregistered; dropped the former stored-fee figure.',
  },
  {
    tagPath: 'contents/tech/core-concepts', slug: 'liquid-stake-units', sentinel: 'href="/ecosystem/dexian-protocol"', change: 'patch',
    subs: [
      [/(seller receives XRD at once, and the delay falls on the buyer\.)<\/p>/,
        '$1 <a href="/ecosystem/dexian-protocol" rel="noopener">DeXian Protocol</a> offered the same instant exit through a pooled liquid-staking service before it closed.</p>'],
    ],
    message: 'Linked DeXian Protocol, the closed pooled liquid-staking service that offered instant XRD redemption; its page had no inbound link.',
  },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(e.sentinel)) { console.log(`  ${e.slug}: already applied – no write`); continue; }
    const all = blocks.flatMap((b) => (b.type === 'infobox' ? b.blocks : [b]));
    for (const [from, to] of e.subs) {
      const block = all.find((b) => b.type === 'content' && from.test(b.text ?? ''));
      if (!block) throw new Error(`${e.slug}: anchor not found ${from}`);
      block.text = block.text.replace(from, to);
    }
    const version = await writeRevision(client, page, blocks, { change: e.change, message: e.message, verified: !!e.verified, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
