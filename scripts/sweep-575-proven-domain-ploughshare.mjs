// Run 575 (ecosystem rotation): Proven Network's Development Status still said the domain "has not
// lapsed" and was "paid through 5 August 2027", contradicting its own infobox. The registry record
// read 12 October 2026 shows it expired 5 August 2026 and in the redemption period since 14 September,
// and the name returns NXDOMAIN. Both Proven Network and Ploughshare were linked from no other article:
// hyperscale-rs's intro now names Proven Network's wiki page, and SRWA's Products section names
// Ploughshare's. Proven's infobox gains the reciprocal link to hyperscale-rs.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const RDAP = 'https://rdap.identitydigital.services/rdap/domain/proven.network';

const EDITS = [
  {
    tagPath: 'ecosystem',
    slug: 'proven-network',
    change: 'minor',
    verified: true,
    sentinel: 'redemption period since 14 September',
    swaps: [
      [
        'The domain has not lapsed &ndash; the <a href="https://rdap.org/domain/proven.network" target="_blank" rel="noopener">registry record</a> shows it registered on 5 August 2022, paid through 5 August 2027, last changed on 12 August 2026, and still on Cloudflare nameservers. It is simply no longer pointed at a site.',
        `The registration has since lapsed. The <a href="${RDAP}" target="_blank" rel="noopener">registry record</a>, read on 12 October 2026, shows the domain registered on 5 August 2022, expired on 5 August 2026, and in the redemption period since 14 September, the last window in which the holder can still renew it. The name no longer resolves in DNS.`,
      ],
      ['newest repository push 14 November 2025 (read 14 September 2026)', 'newest repository push 14 November 2025 (read 12 October 2026)'],
      [
        'rel="noopener">proven-node</a>)</td></tr>',
        'rel="noopener">proven-node</a>); now leads <a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a></td></tr>',
      ],
    ],
    message: 'Development Status: the domain did lapse. Registry RDAP read 12 Oct 2026 shows proven.network expired 5 Aug 2026 and in the redemption period since 14 Sep, NXDOMAIN; the old sentence saying it was paid through 2027 contradicted the infobox. Status read date refreshed (newest push still 14 Nov 2025); infobox Developer links hyperscale-rs.',
  },
  {
    tagPath: 'contents/tech/research',
    slug: 'hyperscale-rs',
    change: 'patch',
    sentinel: 'href="/ecosystem/proven-network"',
    swaps: [[
      'of <a href="https://github.com/proven-network" target="_blank" rel="noopener">Proven Network</a> and was opened',
      'of <a href="/ecosystem/proven-network" rel="noopener">Proven Network</a> and was opened',
    ]],
    message: 'Intro: Proven Network links its wiki page (previously linked from no article) instead of the GitHub org, which the infobox and Contributors list still link.',
  },
  {
    tagPath: 'ecosystem',
    slug: 'srwa',
    change: 'patch',
    sentinel: 'href="/ecosystem/ploughshare"',
    swaps: [[
      '<h3>Ploughshare</h3><p><a target="_blank" rel="noopener" href="https://ploughshare.nz/">Ploughshare</a> is',
      '<h3>Ploughshare</h3><p><a href="/ecosystem/ploughshare" rel="noopener">Ploughshare</a> (<a target="_blank" rel="noopener" href="https://ploughshare.nz/">ploughshare.nz</a>) is',
    ]],
    message: 'Products: Ploughshare links its wiki page, previously linked from no article; the external site link stays.',
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
