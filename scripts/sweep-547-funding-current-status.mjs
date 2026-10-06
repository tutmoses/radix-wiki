// Sweep 547: /contents/history/radix-ecosystem-funding. The Current Status section, lead and infobox cited the
// 28 Apr 2026 maintenance-mode post for things it does not say (grant intakes closed, funding stewardship passed
// to the community, the Endowment Fund continuing). Re-read 6 Oct 2026: it names none of the programs; it records
// one grant, $67,000 and 10m XRD to the Radix Accountability Council to set up the DAO's legal entity, with the
// remaining treasury to pass to that entity. The Booster, Foundry, Surge and Trove passages were present tense;
// Surge's builder announced its wind-down on 19 Aug 2026 (t.me/radix_dlt/998739) and Trove is dormant.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'radix-ecosystem-funding';
const SENTINEL = 'href="/ecosystem/radix-accountability-council"';
const MM = 'https://www.radixdlt.com/blog/foundation-update-moving-to-maintenance-mode';
const ext = (href, text) => `<a target="_blank" rel="noopener" href="${href}"><strong>${text}</strong></a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;

const EDITS = [
  ['<td>2022 – 2026 (Endowment Fund ongoing)</td>', '<td>2022 – 2026</td>'],
  ['<td>Grant programs wound down by May 2026; Endowment Fund continues</td>',
    '<td>Foundation essentials-only from May 2026; remaining treasury to pass to the Radix DAO</td>'],
  ['in May 2026, the grant and incubation programs stopped taking new intakes; the Endowment Fund continues under external management.</p>',
    'in May 2026, none of these programs appears in the Foundation’s plans, and the treasury that funded them is to pass to a community-led DAO.</p>'],
  ['program is a funding initiative designed to support and accelerate the development of decentralized applications (dApps) within the',
    'program was the Foundation’s main track for funding decentralized applications (dApps) in the'],
  [', this program aims to foster innovation and growth in the <a href="https://www.radixdlt.com" target="_blank" rel="noopener" title="Radix DLT">Radix network</a> by providing financial support to developers and entrepreneurs.</p>',
    ', it paid developers in $XRD as their dApps reached agreed stages on the <a href="https://www.radixdlt.com" target="_blank" rel="noopener" title="Radix DLT">Radix network</a>.</p>'],
  ['Program</strong> is an incubator initiative launched in 2024', 'Program</strong> was an incubator launched in 2024'],
  ['The program aims to incubate decentralized applications (dApps) in high-potential categories to drive significant growth in users, Total Value Locked (TVL), and on-chain activity within the Radix ecosystem.</p>',
    'It incubated dApps in categories the Foundation judged high-potential, and measured them by users, Total Value Locked (TVL) and on-chain activity.</p>'],
  ['<h4><strong>Surge</strong></h4>', `<h4><strong>${int('/ecosystem/surge', 'Surge')}</strong></h4>`],
  ['The project is being developed by a team with expertise in mathematics, derivatives trading, and quantitative finance. Surge aims to build upon lessons learned from established perpetual platforms such as Drift, GMX, DyDx, and Jupiter.</p>',
    'The announcement described a team with expertise in mathematics, derivatives trading and quantitative finance, building on lessons from established perpetual platforms such as Drift, GMX, dYdX and Jupiter.</p>'],
  ['for their initial token allocation</strong></a>.</p>',
    `for their initial token allocation</strong></a>.</p><p>On 19 August 2026 ${int('/ecosystem/caviarnine', 'CaviarNine')}, Surge’s lead builder, ${ext('https://t.me/radix_dlt/998739', 'announced it was winding down its products and leaving Radix')}, Surge among them. The exchange’s pool has committed no transaction since 27 August 2026; its page records the unwind.</p>`],
  ['Under the Foundry Program, Trove is developing an enhanced platform focused on professional traders, featuring real-time data aggregation, visualized analytics, and improved collection liquidity. The upgraded platform plans to include floor price charting tools, complex trade execution, customizable trading interfaces, collection bidding capabilities, and competitive fee structures. The project also aims to support emerging NFT standards within the ecosystem, such as 404-style tokens, dynamic traits, and nestable tokens.</p>',
    `Under the Foundry Program, Trove set out to build a platform for professional traders, with real-time data aggregation, visual analytics, floor-price charts, complex trade execution, collection bidding and support for newer NFT standards such as 404-style tokens, dynamic traits and nestable tokens. ${int('/ecosystem/trove', 'Trove')} is now dormant: trove.tools has served nothing since at least 30 July 2026.</p>`],
];

const STATUS = `<h2><strong>Current Status</strong></h2><p>On 28 April 2026 the Radix Foundation ${ext(MM, 'announced')} that from May it would move to an essentials-only phase, with development and community management in “MVP mode”. The post names none of the programs above. The one grant it records went to the ${int('/ecosystem/radix-accountability-council', 'Radix Accountability Council')}: $67,000 and 10m XRD, in two stages, to set up the legal entity of a community-led DAO, to which the Foundation’s remaining treasury is to pass once it exists. The DAO’s founding documents are tracked on the ${int('/ideas/radix-network-dao-charter', 'Radix DAO Charter')} page, and how it should fund core functions is the open question on the ${int('/ideas/dao-operating-budgets', 'operating budgets')} card.</p><p>The Ecosystem Asset Fund had already been paused in May 2025. The last public word on the Radix Endowment Fund is the ${ext('https://www.radixdlt.com/blog/radix-endowment-manager-selected', 'announcement of 2 September 2024')} that Brevan Howard Digital would manage it; nothing published since says whether that arrangement still stands. The record above documents the programs as they ran during the active funding era.</p>`;

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied — no write'); return; }

  const all = (bs) => bs.flatMap((b) => [b, ...all(b.blocks ?? [])]);
  const texts = all(blocks).filter((b) => typeof b.text === 'string');
  for (const [from, to] of EDITS) {
    const hits = texts.filter((b) => b.text.includes(from));
    if (hits.length !== 1) throw new Error(`expected 1 match, got ${hits.length}: ${from.slice(0, 60)}`);
    hits[0].text = hits[0].text.replace(from, () => to);
  }
  const status = texts.filter((b) => b.text.startsWith('<h2><strong>Current Status</strong></h2>'));
  if (status.length !== 1) throw new Error('Current Status block not found');
  status[0].text = STATUS;

  const version = await writeRevision(client, page, blocks, {
    change: 'minor', verified: true, dry: DRY,
    message: 'Current Status, lead and infobox re-read against the 28 Apr 2026 maintenance-mode post, which names none of these programs: dropped the claims it was cited for (intakes closed, funding passed to the community, Endowment Fund continuing) and recorded what it does say – the $67,000 + 10m XRD RAC grant to set up the DAO entity and the treasury transfer to it. Endowment now dated to its last public word (2 Sep 2024). Booster, Foundry, Surge and Trove passages put in the past tense; Surge wind-down (CaviarNine, 19 Aug 2026) and Trove dormancy linked to their pages.',
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
