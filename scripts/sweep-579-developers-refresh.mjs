// Run 579 (developers rotation): staleness head. Igentix re-read on 12 October 2026: demo.igentix.app and
// the apex still answer a bare 404 on every path, behind a Let's Encrypt certificate renewed on 11 October.
// The page dated the shutdown to 30 August from the apex's TRAEFIK DEFAULT CERT, but two reads a minute
// apart each returned a certificate whose notBefore matched the moment of connection, so that timestamp
// dates nothing; the window becomes 19-31 August. Installing Scrypto re-checked at source: radix-clis
// 1.4.0 is still the latest, the install scripts still pin 1.3.0 (last commit 7 Jan), the docs install
// page still names 1.81.0 and 1.3.0, docs/scrypto-v1-4-0 still 404s; crates.io downloads moved 15 -> 21.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');

const IGENTIX_OLD_START = 'now presents a self-signed';
const IGENTIX_OLD_END = 'the project has announced nothing.';
const IGENTIX_NEW = 'answers the same 404 behind a self-signed <code>TRAEFIK DEFAULT CERT</code>. That certificate does not date the shutdown: read twice a minute apart on 12 October 2026, its start time matched the moment of each connection, so it records when the proxy generated it. The demo was last seen working on 19 August and first seen gone on 31 August, a window that contains the <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet reset</a> of 29 August, which wiped the ledger Igentix ran on. Nothing published connects the two, and the project has announced nothing.';

const EDITS = [
  {
    tagPath: 'developers/ai-agents',
    slug: 'igentix',
    change: 'patch',
    verified: true,
    sentinel: 'renewed on 11 October 2026',
    swaps: [
      ['the demo host stopped serving on or about 30 August 2026', 'the demo host stopped serving between 19 and 31 August 2026'],
      ['Read at <strong>07:05 UTC on 31 August 2026</strong>, every path', 'Read on 31 August 2026 and again on 12 October, every path'],
      ['certificate issued 12 August 2026 and valid to 10 November', 'certificate renewed on 11 October 2026'],
      ['offline since on or about 30 August 2026', 'offline since August 2026'],
    ],
    splice: true,
    message: 'Re-read 12 Oct 2026: every path on demo.igentix.app and the apex still answers a bare 404; the demo host renewed its Let\'s Encrypt certificate on 11 Oct. Shutdown date corrected: the apex TRAEFIK DEFAULT CERT carries a notBefore equal to the moment of connection (two reads a minute apart), so it never dated the restart; the window is now 19-31 Aug, last seen working to first seen gone.',
  },
  {
    tagPath: 'developers/getting-started',
    slug: '01-install-scrypto',
    change: 'patch',
    verified: true,
    sentinel: 'recorded <strong>21</strong> pulls',
    swaps: [
      ['Re-checked at source on 12 September 2026, five days after', 'Re-checked at source on 12 October 2026, five weeks after'],
      [
        'on 12 September 2026 crates.io recorded <strong>15</strong> pulls of 1.4.0, three days after publication, against 325 of 1.3.1 and 4,885 of 1.3.0.',
        'on 12 October 2026, a month after publication, crates.io recorded <strong>21</strong> pulls of 1.4.0, against 332 of 1.3.1 and 4,887 of 1.3.0.',
      ],
    ],
    message: 'Version Pins re-checked at source 12 Oct 2026, all unchanged: radix-clis 1.4.0 latest on crates.io; install scripts pin RADIX_CLI_VERSION=1.3.0 and RUST_VERSION=1.92.0, last commit 7 Jan 2026; docs install page names 1.81.0 and 1.3.0; docs/scrypto-v1-4-0 404. Download counts a month on: 21 pulls of 1.4.0, 332 of 1.3.1, 4,887 of 1.3.0.',
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
    if (e.splice) {
      const hits = walk(blocks).filter((b) => b.text?.includes(IGENTIX_OLD_START) && b.text.includes(IGENTIX_OLD_END));
      if (hits.length !== 1) throw new Error(`${e.slug}: splice anchors found ${hits.length} times`);
      const t = hits[0].text;
      const a = t.indexOf(IGENTIX_OLD_START);
      const b = t.indexOf(IGENTIX_OLD_END) + IGENTIX_OLD_END.length;
      hits[0].text = t.slice(0, a) + IGENTIX_NEW + t.slice(b);
      if (DRY) console.log(hits[0].text);
    }

    const version = await writeRevision(client, page, blocks,
      { change: e.change, message: e.message, verified: e.verified, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
