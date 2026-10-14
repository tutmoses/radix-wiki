// Sweep 587 (ecosystem): re-read the three stalest pages (Nest Finance, Trove, Gable
// Finance) against their live sources. Trove gains the infobox every ecosystem page
// carries and loses three promotional passages whose claims no source backed; Gable's
// See also gives the orphaned Nest Finance page an inbound link. Nest Finance and Gable
// needed no other change and are stamped verified with mark-verified.mjs.
import { uid, isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const TROVE_INFOBOX = `<table><tbody>
<tr><th colspan="2">Trove</th></tr>
<tr><td><strong>Type</strong></td><td>Peer-to-peer NFT and token swap tool on <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix</a></td></tr>
<tr><td><strong>Status</strong></td><td>🟠 Dormant. trove.tools answers 404; the domain is renewed to 4 July 2027</td></tr>
<tr><td><strong>Developer</strong></td><td>ripsource</td></tr>
<tr><td><strong>Founded</strong></td><td>2023</td></tr>
<tr><td><strong>Token</strong></td><td>${ext('https://dashboard.radixdlt.com/resource/resource_rdx1tkl09e0ahgrxpwm4t5frseadp80thu5hm6n0zlzrn6ztddlm60wex8', 'TROVE')}, fixed supply 500,000,000</td></tr>
<tr><td><strong>Code</strong></td><td>${ext('https://github.com/ripsource/TROVE', 'ripsource/TROVE')}</td></tr>
<tr><td><strong>Telegram</strong></td><td>${ext('https://t.me/TroveTools', 't.me/TroveTools')}</td></tr>
<tr><td><strong>Verified</strong></td><td>14 October 2026</td></tr>
</tbody></table>`.replace(/\n/g, '');

const OVERVIEW_FROM = '<h2>Overview</h2>';
const OVERVIEW_TO = '<h2>History</h2>';
const OVERVIEW = `<h2>Overview</h2>
<p>Trove let two people swap NFTs and tokens directly. One side drew up an offer naming the assets on both sides, the other checked it and accepted, and the swap settled in a single transaction with no escrow agent holding either side's assets in between. The ${ext('https://github.com/ripsource/TROVE', 'public repository')} holds the trade logic as one blueprint, ${ext('https://github.com/ripsource/TROVE/blob/main/barter_olc.rs', 'barter_olc.rs')}, 365 lines long, alongside two bootstrap blueprints for testing.</p>
`;

const ROLE_FROM = '<h3><strong>Role of Radix in Web3 Development</strong></h3>';
const WHY_FROM = '<h2><strong>Features</strong></h2>';
const WHY_TO = '<h2><strong>Trove in Action: A User&#39;s Guide</strong></h2>';
const FEATURES = `<h2><strong>Features</strong></h2>
<ul>
<li><strong>Single or bundle trades:</strong> one NFT, a bundle of NFTs, or several tokens could go into one deal.</li>
<li><strong>A badge for the proposer:</strong> creating an offer minted an NFT badge recording its terms, which the proposer later used to release the swap or cancel it.</li>
</ul>
`;

const GABLE_FROM = 'the grant programme Gable was funded under</li>';
const GABLE_TO = `${GABLE_FROM}<li><a href="/ecosystem/nest-finance" rel="noopener">Nest Finance</a>, a Radix lending and leverage protocol announced in March 2024 that never launched</li>`;

const cut = (text, from, to, insert) => {
  const a = text.indexOf(from);
  const b = text.indexOf(to, a + 1);
  if (a < 0 || b < 0 || text.indexOf(from, a + 1) >= 0) throw new Error(`cut: "${from}" .. "${to}" not found exactly once`);
  return text.slice(0, a) + insert + text.slice(b);
};

await withClient(async (client) => {
  const load = async (slug) => {
    if (isLockedPage('ecosystem', slug)) throw new Error(`${slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ecosystem', slug]);
    if (!rows.length) throw new Error(`${slug} not found`);
    return rows[0];
  };

  const trove = await load('trove');
  const tBlocks = JSON.parse(JSON.stringify(trove.content));
  if (tBlocks[0].type === 'infobox') {
    console.log('  trove: already applied — no write');
  } else {
    if (tBlocks.length !== 1) throw new Error(`trove: expected 1 block, found ${tBlocks.length}`);
    let t = tBlocks[0].text;
    t = cut(t, OVERVIEW_FROM, OVERVIEW_TO, OVERVIEW);
    t = cut(t, ROLE_FROM, WHY_FROM, '');
    t = cut(t, WHY_FROM, WHY_TO, FEATURES);
    if (/unparalleled|outperforming|frictionless/.test(t)) throw new Error('trove: promotional text survived');
    tBlocks[0].text = t;
    tBlocks.unshift({ id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: TROVE_INFOBOX }] });
    const v = await writeRevision(client, trove, tBlocks, {
      change: 'minor', verified: true, dry: DRY,
      message: 'Ecosystem sweep 587: re-read 14 Oct 2026 (trove.tools and www 404; RDAP renewed to 4 Jul 2027, last changed 12 Aug 2026; TROVE supply 500,000,000, one transaction ever, 10 Feb 2025; repo last pushed 4 Jun 2023). Added the infobox. Replaced the Overview and Features claims ("unparalleled", "outperforming Ethereum or Polygon") with what the repository shows, a 365-line barter_olc.rs blueprint, and removed the unsourced "Role of Radix", "Why build on Radix?" and "Benefits" passages.',
    });
    console.log(`  ${DRY ? '[dry] ' : ''}${trove.title}  v${trove.version} -> v${v}`);
  }

  const gable = await load('gable-finance');
  const gBlocks = JSON.parse(JSON.stringify(gable.content));
  if (JSON.stringify(gBlocks).includes('/ecosystem/nest-finance')) {
    console.log('  gable-finance: already applied — no write');
  } else {
    const hits = gBlocks.filter((b) => b.text?.includes(GABLE_FROM));
    if (hits.length !== 1) throw new Error(`gable-finance: anchor matched ${hits.length} blocks`);
    hits[0].text = hits[0].text.replace(GABLE_FROM, GABLE_TO);
    const v = await writeRevision(client, gable, gBlocks, {
      change: 'patch', verified: true, dry: DRY,
      message: 'Ecosystem sweep 587: re-read 14 Oct 2026, unchanged (gable.finance Last-Modified 23 Apr 2024; dApp definition account last transaction 22 Apr 2024; both repos last pushed 13 Dec 2023). See also links Nest Finance, which had no inbound link.',
    });
    console.log(`  ${DRY ? '[dry] ' : ''}${gable.title}  v${gable.version} -> v${v}`);
  }
});
