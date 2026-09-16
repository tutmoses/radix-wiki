// sweep 443 – ecosystem rotation, the Dormant/Closed tail verified 2–3 August that
// run 441 banked as the next slice, with the metadata-only URLs re-probed.
//
// radit: radit.io and www.radit.io stopped resolving. The domain is registered to
//   26 January 2027 (whois updated 11 August 2026), but the Route 53 nameservers it
//   delegates to answer REFUSED for the zone, and 1.1.1.1 / 8.8.8.8 return SERVFAIL,
//   read 16 September 2026. The page's 29 August reading said the site was up and
//   the RADIT icon_url resolved; the on-ledger metadata still names radit.io.
// caviarnine: its one link to www.radit.io repointed to the Radit article.
// etherealdao: ethereal.systems serves a GoDaddy parking lander on every path, the
//   litepaper PDF included (114-byte script redirecting to /lander; RDAP last
//   changed 11 August 2026, expires 4 April 2027). Both litepaper links removed;
//   the Internet Archive answered 429/503, so no capture is linked yet.
// fidenaro: future tense from 2023 rewritten. app.fidenaro.com's bundle names only
//   Stokenet addresses; all 23 components, the package and the app's five
//   resources are absent from Stokenet after the 29 August 2026 reset.
//   razi90/fidenaro-core: Apache-2.0, last commit 22 October 2024. Neither the site,
//   the app nor the docs mention an FDN token.
// project-elysium: Tapas series re-read, 539 views (499 in August).
//
//   node scripts/sweep-443-ecosystem-dark-domains.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;
const STOKENET = int('/contents/tech/releases/stokenet', 'Stokenet');

const EDITS = [
  {
    slug: 'radit',
    version: '2.4.0',
    sentinel: 'By 16 September 2026 the domain no longer resolved',
    swaps: [
      ['<p>As of mid-2023, <a href="https://www.radit.io">Radit.io</a> had seen', '<p>As of mid-2023, Radit.io had seen'],
      [/<p>Radit closed as an <a href="\/contents\/tech\/releases\/radix-mainnet-olympia"[\s\S]*?more common end for a retired Radix front-end\.<\/p>\n<p>The consequence is that the \$RADIT token still resolves properly[\s\S]*?kept one small web host alive\.<\/p>/,
       `<p>Radit closed as an ${int('/contents/tech/releases/radix-mainnet-olympia', 'Olympia')}-era product and never reopened on ${int('/contents/tech/releases/radix-mainnet-babylon', 'Babylon')}. On 29 August 2026 <code>radit.io</code> still served a farewell card from Vercel, &ldquo;Bye bye, hope to see you after Babylon!&rdquo;, with one link, to ${int('/ecosystem/caviarnine', 'CaviarNine')}. By 16 September 2026 the domain no longer resolved. It is registered until January 2027, but the Amazon Route 53 nameservers it delegates to refuse to answer for it, so neither <code>radit.io</code> nor <code>www.radit.io</code> has an address.</p>
<p>The RADIT token&rsquo;s on-ledger ${int('/contents/tech/core-concepts/metadata-module', 'metadata')} still names that host. The ${ext('https://dashboard.radixdlt.com/resource/resource_rdx1th7jrjlpfz5dxtpa6v2thsxarqa5mgygcqm8qgm37ntyy6dj7l7dxs', 'resource')} carries a fixed <strong>100,000,000</strong> supply, and read on 16 September its <code>info_url</code> is <code>radit.io</code> and its <code>icon_url</code> is <code>radit.io/radit32.png</code>. That icon returned a 2,555-byte PNG on 29 August and returns nothing now, so wallets and explorers that fetch it show no image. ${int('/ecosystem/dexter', 'DeXter')}&rsquo;s token is in the same state: its metadata points at an icon host and an IPFS gateway that have no DNS record left.</p>`],
    ],
    message: 'radit.io and www.radit.io stopped resolving by 16 September 2026: the domain is registered to January 2027, but its Route 53 nameservers refuse the zone. Rewrote the Status section, which described the 29 August farewell page as live and the RADIT icon_url as working; the on-ledger metadata still names radit.io. Removed the dead site link from the mid-2023 usage figures.',
  },
  {
    slug: 'caviarnine',
    version: null,
    sentinel: 'its domain stopped resolving in September 2026',
    swaps: [
      ['<p><a target="_blank" rel="noopener noreferrer nofollow" class="link" href="https://www.radit.io">Radit.io</a> was an on-chain messaging service but has been discontinued.</p>',
       `<p>${int('/ecosystem/radit', 'Radit.io')} was an investable message board. It closed before Babylon, and its domain stopped resolving in September 2026.</p>`],
    ],
    message: 'Repointed the Radit link from www.radit.io, which no longer resolves (16 September 2026), to the Radit article.',
  },
  {
    slug: 'etherealdao',
    version: '2.3.0',
    sentinel: 'serves a GoDaddy parking page',
    swaps: [
      ['the <a href="https://ethereal.systems/EtherealUSD_Litepaper.pdf">Litepaper</a> proposed',
       'the project&#39;s litepaper proposed'],
      ['<h2>Further Reading</h2>\n<ul>\n<li><a href="https://ethereal.systems/EtherealUSD_Litepaper.pdf">Litepaper</a></li>\n</ul>',
       '<h2>Status</h2>\n<p>The project site and the EtherealUSD litepaper were both hosted at <code>ethereal.systems</code>. Read on 16 September 2026, that domain serves a GoDaddy parking page: every path, the litepaper&#39;s included, returns a short script that redirects to <code>/lander</code>. The domain is registered until April 2027, and its registration record was last changed on 11 August 2026. The litepaper is no longer online, so the description of EtherealUSD above has no live source.</p>'],
    ],
    message: 'ethereal.systems now serves a GoDaddy parking page on every path, the EtherealUSD litepaper PDF included (read 16 September 2026; registration last changed 11 August 2026). Removed both litepaper links and replaced Further Reading with a dated Status section.',
  },
  {
    slug: 'fidenaro',
    version: '2.2.0',
    sentinel: 'app.fidenaro.com',
    swaps: [
      ['but full "real-money" launch (planned Q1 2024) not shipped</td>',
       'but the beta runs on Stokenet and the real-money launch planned for 2024 has not shipped</td>'],
      ['<a href="https://x.com/fidenaro" target="_blank" rel="noopener">X</a></td>',
       `<a href="https://x.com/fidenaro" target="_blank" rel="noopener">X</a> · ${ext('https://docs.fidenaro.com', 'Docs')} · ${ext('https://github.com/razi90/fidenaro-core', 'GitHub')}</td>`],
      ['<p>Fidenaro was founded in late 2022. The full launch of the platform is planned for the first quarter of 2024, at which point traders and investors will be able to use the platform to its full extent and with real money.</p>',
       `<p>Fidenaro was founded in late 2022. The team planned a full launch with real money for 2024, and it has not happened. What shipped is a beta: ${ext('https://app.fidenaro.com', 'app.fidenaro.com')} is a trading front-end whose code, read on 16 September 2026, names only ${STOKENET} addresses. Stokenet is Radix&#39;s public test network, where tokens have no value. None of those addresses works now. The test network was reset on 29 August 2026 and everything deployed on it was lost, and none of the 23 components the app calls, nor its package or its five tokens, exists on the new network. The ${ext('https://docs.fidenaro.com', 'documentation')} still describes the beta as a recent milestone ahead of a mainnet launch &ldquo;in the coming months&rdquo;. The code is public in ${ext('https://github.com/razi90/fidenaro-core', 'fidenaro-core')}, a Rust and TypeScript repository under the Apache 2.0 licence, last changed on 22 October 2024.</p>`],
      [/<h2>\$<strong>FDN Token<\/strong><\/h2>\n<p>In 2024, Fidenaro plans to launch the \$FDN Token\.[^<]*<\/p>\n/, ''],
      [/<li><strong>Q4, 2023 \| Beta Launch - SAPPHIRE<\/strong>[\s\S]*?towards Fidenaro\.<\/li>/,
       `<li><strong>Q4 2023, beta launch (SAPPHIRE)</strong>: an open beta using virtual money. It shipped on ${STOKENET}, and the network reset of 29 August 2026 removed it.</li>
<li><strong>Q2 2024, full launch (EMERALD)</strong>: traders and investors using real money. Not shipped.</li>
<li><strong>2024, FDN token launch (DIAMOND)</strong>: a token users could buy, or earn by supporting the platform. Neither the site, the app nor the documentation mentions it.</li>`],
    ],
    message: 'Rewrote the 2023 future tense. The beta at app.fidenaro.com names only Stokenet addresses, and none of its 23 components, its package or its five tokens survived the 29 August 2026 Stokenet reset (read 16 September 2026). The real-money launch and the FDN token did not ship; fidenaro-core was last changed on 22 October 2024. Folded the token section into the roadmap and added docs and GitHub links.',
  },
  {
    slug: 'project-elysium',
    version: '2.2.3',
    sentinel: '539 views',
    swaps: [
      ['and as of August 2026 the series still carries that one episode – 499 views,',
       'and as of 16 September 2026 the series still carries that one episode – 539 views,'],
    ],
    message: 'Re-read the Tapas series on 16 September 2026: still one episode, 539 views (499 in August), one subscriber, no comments.',
  },
];

// Apply a swap to whichever block (or nested infobox block) holds it, exactly once.
function swapOnce(blocks, [from, to]) {
  let hits = 0;
  const visit = (list) => list.map((b) => {
    let next = b;
    if (typeof b.text === 'string') {
      const has = from instanceof RegExp ? from.test(b.text) : b.text.includes(from);
      if (has) { hits++; next = { ...b, text: b.text.replace(from, to) }; }
    }
    if (Array.isArray(b.blocks)) next = { ...next, blocks: visit(b.blocks) };
    return next;
  });
  const out = visit(blocks);
  if (hits !== 1) throw new Error(`expected 1 match, got ${hits}: ${String(from).slice(0, 60)}`);
  return out;
}

const bump = (v) => { const [a, b, c] = v.split('.').map(Number); return `${a}.${b}.${c + 1}`; };

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage('ecosystem', e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      "SELECT id, title, version, content FROM pages WHERE tag_path = 'ecosystem' AND slug = $1", [e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied - no write`);
      continue;
    }
    let blocks = JSON.parse(JSON.stringify(page.content));
    for (const s of e.swaps) blocks = swapOnce(blocks, s);
    const json = JSON.stringify(blocks);
    const [NBSP, EMDASH] = [0xa0, 0x2014].map((c) => String.fromCharCode(c));
    if (json.includes(NBSP) || (json.includes(EMDASH) && !JSON.stringify(page.content).includes(EMDASH))) {
      throw new Error(`${e.slug}: U+00A0 or a new em dash in output`);
    }
    if (!json.includes(e.sentinel)) throw new Error(`${e.slug}: sentinel missing after swaps`);
    const version = e.version ?? bump(page.version);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${e.swaps.length} swaps)`);
    if (DRY) continue;

    const now = new Date().toISOString();
    const type = version.endsWith('.0') ? 'minor' : 'patch';
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, type, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
    console.log('    written and stamped');
  }
});
