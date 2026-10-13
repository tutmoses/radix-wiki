// Run 582 (ecosystem rotation, order index 4). Three edits:
// - radit: RADIT re-read on Ociswap 07:10 UTC 13 Oct 2026. The 29 Aug figure "148,279.64 XRD against
//   3,489,171.29 RADIT" was the API's total liquidity valued in XRD, not the XRD side; the two pools hold
//   66,603.81 + 3,066.05 = 69,669.86 XRD and 3,561,418.77 + 167,121.10 = 3,728,539.87 RADIT. Volume 24h and
//   7d both 0, lifetime 3,133,227 XRD. The USD figure is dropped: Ociswap prices XRD at $0.00033 today.
//   radit.io still has no address (whois: Route 53 NS, expiry 26 Jan 2027).
// - project-elysium: Tapas series still one episode, 553 views (539 on 16 Sep), one subscriber.
// - nfts-on-radix: links three orphaned ecosystem pages (project-elysium, world-cup-badge-arena,
//   abandoned-arena) from the Digital Art and Gaming use cases, the fix-forward orphan queue.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');

const RADIT_OLD_START = 'The token is also still traded.';
const RADIT_OLD_END = 'its governance token turns over a few thousand XRD a week.</p>';
const RADIT_NEW = 'The token is still listed, and it has stopped trading. Ociswap, which <a href="https://ociswap.com/radit" target="_blank" rel="noopener">listed RADIT on 6 October 2023</a>, holds it in two pools. Read on 13 October 2026, they hold <strong>69,669.86 XRD and 3,728,539.87 RADIT</strong> between them, and neither has taken a trade in the previous seven days. Lifetime volume is 3,133,227&nbsp;XRD, up from 3,107,062&nbsp;XRD on 29 August, when the token still turned over a few thousand XRD a week.</p>';

const EDITS = [
  {
    tagPath: 'ecosystem',
    slug: 'radit',
    change: 'patch',
    verified: true,
    sentinel: '69,669.86 XRD',
    swaps: [],
    splice: [RADIT_OLD_START, RADIT_OLD_END, RADIT_NEW],
    message: 'RADIT re-read on Ociswap 13 Oct 2026: two pools hold 69,669.86 XRD and 3,728,539.87 RADIT; 0 volume over 7 days; lifetime 3,133,227 XRD. Corrects the 29 Aug figure, which was the pools\' total value in XRD rather than their XRD side, and drops the USD estimate. radit.io still has no address.',
  },
  {
    tagPath: 'ecosystem',
    slug: 'project-elysium',
    change: 'patch',
    verified: true,
    sentinel: '553 views',
    swaps: [
      ['as of 16 September 2026 the series still carries that one episode – 539 views', 'as of 13 October 2026 the series still carries that one episode – 553 views'],
    ],
    message: 'Tapas series re-read 13 Oct 2026: still one episode, 553 views, one subscriber.',
  },
  {
    tagPath: 'contents/tech/core-protocols',
    slug: 'nfts-on-radix',
    change: 'patch',
    verified: false,
    sentinel: '/ecosystem/world-cup-badge-arena',
    swaps: [
      ['<li><p>Automating royalties to artists on secondary sales via payment splitters</p></li></ul>', '<li><p>Automating royalties to artists on secondary sales via payment splitters</p></li></ul><p><a href="/ecosystem/project-elysium" rel="noopener">Project Elysium</a> planned an NFT drop in 2023 around a community-owned graphic novel and tabletop game; one trailer episode appeared and the drop never did.</p>'],
      ['left its token on the ledger.</p>', 'left its token on the ledger. During the 2026 FIFA World Cup, <a href="/ecosystem/world-cup-badge-arena" rel="noopener">World Cup Badge Arena</a> minted 1,009 sealed match-call cards against 42 Passport NFTs, and <a href="/ecosystem/abandoned-arena" rel="noopener">Abandoned Arena</a>, an NFT game that never launched, left a 100,000-unit yield token.</p>'],
    ],
    message: 'Linked three Radix projects from the use cases: Project Elysium under Digital Art, World Cup Badge Arena and Abandoned Arena under Gaming. None had an inbound link. wiki-sweep run 582.',
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
      if (hits.length !== 1 || hits[0].text.split(find).length !== 2) throw new Error(`${e.slug}: anchor not unique: ${find.slice(0, 60)}`);
      hits[0].text = hits[0].text.replace(find, () => replace);
    }
    if (e.splice) {
      const [start, end, text] = e.splice;
      const hits = walk(blocks).filter((b) => b.text?.includes(start) && b.text.includes(end));
      if (hits.length !== 1) throw new Error(`${e.slug}: splice anchors found ${hits.length} times`);
      const t = hits[0].text;
      hits[0].text = t.slice(0, t.indexOf(start)) + text + t.slice(t.indexOf(end) + end.length);
    }

    const version = await writeRevision(client, page, blocks,
      { change: e.change, message: e.message, verified: e.verified, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
