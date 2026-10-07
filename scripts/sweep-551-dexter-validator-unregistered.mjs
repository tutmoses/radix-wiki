// Sweep 551: the DeXter validator was unregistered on 7 Oct 2026 (t.me/radix_dlt/1006921, Timan, 13:28 UTC: "With 2.8M XRD
// stake and the project no longer active, it wasn't viable to keep it running"). Read live through radixscan at epoch 347,427
// (15:05 UTC 7 Oct): registered false, 3,286,950.80 XRD still delegated. The page said the validator "was kept running".
// Orphan queue: Radix Arena gets an inbound link from DELPHIBETS, Radix Kingdoms from NFTwars.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const S = '[\\s\\u00a0]+';

const EDITS = [
  {
    tagPath: 'ecosystem', slug: 'dexter', sentinel: 't.me/radix_dlt/1006921', change: 'minor', verified: true,
    subs: [
      [new RegExp(`<p>The${S}validator${S}was${S}kept${S}running${S}rather${S}than${S}sold:${S}its${S}operator${S}lowered${S}the${S}fee${S}from${S}100%${S}to${S}10%${S}so${S}existing${S}delegators${S}continue${S}to${S}earn${S}XRD${S}rewards,${S}with${S}no${S}further${S}DEXTR${S}incentives\\.`),
        '<p>The validator was kept running rather than sold: its operator lowered the fee from 100% to 10% so existing delegators kept earning XRD rewards, with no further DEXTR incentives. That ended on 7 October 2026, when the operator <a href="https://t.me/radix_dlt/1006921" target="_blank" rel="noopener">announced in Radix DLT Official</a> that the validator had been unregistered, because the stake left behind no longer paid for running the node. Read on-ledger at epoch 347,427 the same afternoon, the <a href="https://dashboard.radixdlt.com/component/validator_rdx1s0sr7xsr286jwffkkcwz8ffnkjlhc7h594xk5gvamtr8xqxr23a99a" target="_blank" rel="noopener">DeXter validator</a> is unregistered with <strong>3,286,950.80 XRD</strong> still delegated to it. An unregistered validator cannot join the active set, so that stake earns nothing until its holders move it; the stake units still unstake normally.'],
    ],
    message: 'The DeXter validator was unregistered on 7 Oct 2026 (t.me/radix_dlt/1006921); read on-ledger at epoch 347,427: unregistered, 3,286,950.80 XRD still delegated.',
  },
  {
    tagPath: 'ecosystem', slug: 'delphibets', sentinel: 'href="/ecosystem/radix-arena"', change: 'patch',
    subs: [
      [/(billed as the first prediction market protocol exclusively on the network\.)/,
        '$1 The newest betting app on Radix, <a href="/ecosystem/radix-arena" rel="noopener">Radix Arena</a>, a parimutuel pool on horse races, went live on Stokenet in September 2026 and has no mainnet deployment.'],
    ],
    message: 'Linked Radix Arena, the Stokenet parimutuel betting pool; its page had no inbound link.',
  },
  {
    tagPath: 'ecosystem', slug: 'nftwars', sentinel: 'href="/ecosystem/radix-kingdoms"', change: 'patch',
    subs: [
      [/(alongside Root Finance and Selfi Social reflected its standing as one of the ecosystem's high-potential projects during the Babylon launch window\.)<\/p>/,
        '$1 <a href="/ecosystem/radix-kingdoms" rel="noopener">Radix Kingdoms</a>, an on-chain strategy game still being played on mainnet in September 2026, also makes an NFT the key to play: a kingdom key NFT authorises every action its kingdom takes.</p>'],
    ],
    message: 'Linked Radix Kingdoms, the on-chain strategy game; its page had no inbound link.',
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
