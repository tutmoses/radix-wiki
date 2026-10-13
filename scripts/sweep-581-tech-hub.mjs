// Run 581 (contents/tech rotation): staleness head. The Radix Technology hub (v1.0.1, never verified) called
// Scrypto "a dialect of Rust" and its contract language, against the 2 Sep 2026 ruling that Scrypto is a Rust
// SDK (t.me/hyperscale_rs/11575); described Cerberus by its sharded design without saying mainnet runs it
// unsharded as a variant of the original HotStuff; and stopped at Babylon with no protocol update since. The
// intro and close carried lines VOICE.md §2 rules out. Two backlog patches ride along: the Developers hub
// infobox said "a Rust dialect", and the homepage infobox named node-runner 1.3.3 (2023) as the Radix node
// (latest babylon-node release v1.4.0.0, 10 Sep 2026) while its Governance Handover paragraph still listed
// Peachy and Faraz, both replaced (ecosystem/radix-accountability-council, t.me/RadixAccountabilityCouncil/867).
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;

const HUB = {
  infobox: `<table>
<tr><th>Consensus</th><td>${int('/contents/tech/core-protocols/cerberus-consensus-protocol', 'Cerberus')}, unsharded on mainnet</td></tr>
<tr><th>Execution</th><td>${int('/contents/tech/core-protocols/radix-engine', 'Radix Engine')}</td></tr>
<tr><th>Developer SDK</th><td>${int('/contents/tech/core-protocols/scrypto-programming-language', 'Scrypto')}, for Rust</td></tr>
<tr><th>Model</th><td>${int('/contents/tech/core-concepts/asset-oriented-programming', 'Asset-oriented programming')}</td></tr>
<tr><th>Current release</th><td>${int('/contents/tech/releases/radix-mainnet-babylon', 'Babylon')}, since September 2023</td></tr>
<tr><th>Latest protocol update</th><td>${int('/contents/tech/releases/protocol-updates', 'Eagle Ray')}, 11 September 2026</td></tr>
<tr><th>Sharding</th><td>Planned for ${int('/contents/tech/releases/radix-mainnet-xian', 'Xi&rsquo;an')}</td></tr>
</table>`,
  intro: `<h2>Introduction</h2>
<p>Radix is a layer-one network on which the ledger itself holds and moves assets. On most other networks a token is a balance stored inside a smart contract, and it follows whatever rules, and carries whatever bugs, that contract&rsquo;s author wrote. On Radix a token is a ${int('/contents/tech/core-concepts/resources', 'resource')}: an object the ${int('/contents/tech/core-protocols/radix-engine', 'Radix Engine')} creates, keeps in vaults and moves itself, so application code moves a resource by asking the engine to and never edits a balance directly.</p>
<p>This section covers how that design works, what of it runs on mainnet today, and what is still being built.</p>`,
  stackFind: `is the consensus layer, a BFT protocol designed so that transactions touching unrelated state can be agreed in parallel rather than serialized into one chain. Above it the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> executes transactions against a state model of typed objects, and <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a>, a dialect of Rust, is how developers write for it.</p>`,
  stackNew: `is the consensus layer, a BFT protocol whose sharded design lets transactions that touch unrelated state be agreed in parallel. Mainnet runs it unsharded, as a single shard group, which makes it a variant of the original ${ext('https://arxiv.org/abs/1803.05069', 'HotStuff')} protocol. Above it the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> executes transactions against a state model of typed objects. Developers write for the engine in Rust with <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a>, Radix&rsquo;s Rust SDK: a library of types and macros, and a command-line tool that compiles a blueprint to WebAssembly.</p>`,
  settled: `<h2>What is settled and what is not</h2>
<p>The execution half of the design has been live since Babylon in September 2023. ${int('/contents/tech/core-concepts/asset-oriented-programming', 'Asset-oriented')} programming, badges, ${int('/contents/tech/core-protocols/transaction-manifests', 'manifests')} and the wallet are all in production, and the properties they claim can be checked against mainnet today. Mainnet has taken four ${int('/contents/tech/releases/protocol-updates', 'protocol updates')} since launch, the latest Eagle Ray on 11 September 2026.</p>
<p>The scalability half is not live. The braided cross-shard consensus in the Cerberus whitepaper has never shipped, and sharding waits on ${int('/contents/tech/releases/radix-mainnet-xian', 'Xi&rsquo;an')}. The leading candidate for Xi&rsquo;an, ${int('/contents/tech/research/hyperscale-rs', 'hyperscale-rs')}, does not implement Cerberus: each of its shards runs a consensus derived from HotStuff-2, and it replaces the Radix Engine with a purpose-built virtual machine, ${int('/contents/tech/research/hyperscale-vm', 'hyperscale-vm')}. Its milestones and current status are on the hyperscale-rs page.</p>`,
};

const EDITS = [
  {
    tagPath: 'contents/tech', slug: '', change: 'minor', verified: true, sentinel: 'Latest protocol update',
    apply(blocks) {
      const box = blocks.find((b) => b.type === 'infobox');
      if (box?.blocks?.length !== 1) throw new Error('hub: infobox shape');
      box.blocks[0].text = HUB.infobox;
      const intro = blocks.filter((b) => b.text?.startsWith('<h2>Introduction</h2>'));
      const stack = blocks.filter((b) => b.text?.includes(HUB.stackFind));
      const settled = blocks.filter((b) => b.text?.startsWith('<h2>What is settled and what is not</h2>'));
      if (intro.length !== 1 || stack.length !== 1 || settled.length !== 1) throw new Error('hub: section anchors');
      intro[0].text = HUB.intro;
      stack[0].text = stack[0].text.replace(HUB.stackFind, HUB.stackNew);
      settled[0].text = HUB.settled;
    },
    message: 'Hub refreshed and verified 13 Oct 2026. Scrypto described as Radix\'s Rust SDK rather than a dialect of Rust, and the infobox row renamed Developer SDK (ruling t.me/hyperscale_rs/11575). Cerberus: mainnet runs it unsharded, a variant of the original HotStuff (arXiv 1803.05069, cited in the babylon-node README). Infobox and close add the four protocol updates since Babylon, latest Eagle Ray 11 Sep 2026. Xi\'an close names hyperscale-rs as the leading candidate, with HotStuff-2-derived per-shard consensus and hyperscale-vm in place of the Radix Engine. Intro rewritten to open on what Radix is.',
  },
  {
    tagPath: 'developers', slug: '', change: 'patch', verified: false, sentinel: 'Scrypto</a>, Radix&rsquo;s Rust SDK</td>',
    swaps: [['Scrypto</a>, a Rust dialect</td>', 'Scrypto</a>, Radix&rsquo;s Rust SDK</td>']],
    message: 'Infobox: Scrypto is Radix\'s Rust SDK, not a Rust dialect (ruling t.me/hyperscale_rs/11575, 2 Sep 2026).',
  },
  {
    tagPath: '', slug: '', change: 'patch', verified: false, sentinel: 'babylon-node/releases/tag/v1.4.0.0',
    swaps: [
      ['<a href="https://github.com/radixdlt/node-runner/releases" class="link" target="_blank" rel="noopener"><strong>Radix node 1.3.3</strong></a>',
        '<a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0" class="link" target="_blank" rel="noopener"><strong>Babylon node v1.4.0.0</strong></a>'],
      ['The elected members – Peachy, Faraz, Jazzer_9F, Avaunt, and projectShift – serve as facilitators coordinating the 2026 handover.',
        'Voters elected Peachy, Faraz, Jazzer_9F, Avaunt and projectShift. Tadkis replaced Faraz in February 2026 and Alfred <a target="_blank" rel="noopener" class="link" href="https://t.me/RadixAccountabilityCouncil/867">replaced Peachy</a>, so the council coordinating the 2026 handover is Tadkis, Jazzer_9F, Avaunt, projectShift and Alfred.'],
    ],
    message: 'Infobox: Networking row named node-runner 1.3.3 (Sep 2023) as the Radix node; now babylon-node v1.4.0.0, the latest release (10 Sep 2026). Governance Handover: RAC line-up updated, Tadkis replaced Faraz (Feb 2026) and Alfred replaced Peachy (t.me/RadixAccountabilityCouncil/867).',
  },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug}: page not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(e.sentinel.replace(/"/g, '\\"'))) {
      console.log(`  ${page.title}: already applied – no write`);
      continue;
    }
    const walk = (bs) => bs.flatMap((b) => [b, ...(b.blocks ? walk(b.blocks) : [])]);
    if (e.apply) e.apply(blocks);
    for (const [find, replace] of e.swaps ?? []) {
      const hits = walk(blocks).filter((b) => b.text?.includes(find));
      if (hits.length !== 1) throw new Error(`${e.tagPath}/${e.slug}: anchor found ${hits.length} times: ${find.slice(0, 60)}`);
      hits[0].text = hits[0].text.replace(find, replace);
    }
    const version = await writeRevision(client, page, blocks,
      { change: e.change, message: e.message, verified: e.verified, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
