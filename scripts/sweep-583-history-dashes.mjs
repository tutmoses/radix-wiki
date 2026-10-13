// Run 583 (contents/history rotation, order index 5). Three edits:
// - hyperlane-asset-drain-2026 (third most-read page, 48 visitors in 30d): 18 em dashes in the page's own
//   prose, banned by VOICE.md; each rewritten to a comma, colon, full stop or parentheses. Quoted testimonials
//   on the two dApp-in-a-Day workshop pages keep theirs.
// - hyperlane-asset-drain-2026-timeline: the same, 5 em dashes.
// - infrastructure-rfps: Pawel_XRD's 18 May Gateway-maintenance thread still has one post (radixtalk.com
//   /t/2300.json, read 13 Oct 2026); no Gateway release or commit since v1.10.7 on 7 Sep. Date moved, verified.
// The hUSDC recovery has not paid out (radix_dlt 1007408, 20:52 UTC 12 Oct, still asking), so the drain
// page's Recovery row stands.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');

const EDITS = [
  {
    tagPath: 'contents/history',
    slug: 'hyperlane-asset-drain-2026',
    change: 'patch',
    verified: false,
    sentinel: 'eight minutes earlier: an outstanding',
    swaps: [
      ['eight minutes earlier — an outstanding', 'eight minutes earlier: an outstanding'],
      ['reference — and injected', 'reference, and injected'],
      ['frame — when its blueprint', 'frame, when its blueprint'],
      ['of the resource — not by anything', 'of the resource, not by anything'],
      ['</code> — which is why the transactions', '</code>, which is why the transactions'],
      ['not of the bridge — the Foundation', 'not of the bridge: the Foundation'],
      ['Last round on the ledger — epoch', 'Last round on the ledger: epoch'],
      ['returned at the halt — state version', 'returned at the halt: state version'],
      ['21:19:06.179 UTC — which puts', '21:19:06.179 UTC, which puts'],
      ['>Timan</a> — the DeFiPlaza', '>Timan</a>, the DeFiPlaza'],
      ['10 November 2025 — wrote at', '10 November 2025, wrote at'],
      ['>0xOmarA</a> — the fifth-largest', '>0xOmarA</a>, the fifth-largest'],
      ['Radix Engine Toolkit</a> — who observed', 'Radix Engine Toolkit</a>, who observed'],
      ['efforts are separate — the Foundation', 'efforts are separate: the Foundation'],
      ['flightofthefox leads — and on the night', 'flightofthefox leads. On the night'],
      ['this page records — 0.00084948', 'this page records (0.00084948'],
      ['hUSDC at 16:22 — arrive as', 'hUSDC at 16:22) arrive as'],
      ['any of that — the ledger', 'any of that: the ledger'],
    ],
    message: 'Em dashes out of the page\'s own prose (18), each rewritten as a comma, colon, full stop or parentheses. No facts changed. wiki-sweep run 583.',
  },
  {
    tagPath: 'contents/history',
    slug: 'hyperlane-asset-drain-2026-timeline',
    change: 'patch',
    verified: false,
    sentinel: 'producing rounds: epoch',
    swaps: [
      ['producing rounds — epoch', 'producing rounds: epoch'],
      ['four hours earlier — so the planned', 'four hours earlier, so the planned'],
      ['248,959,959 XRD — roughly', '248,959,959 XRD, roughly'],
      ['since March 2025 — which is why', 'since March 2025, which is why'],
      ['339,898 exclusive — one epoch', '339,898 exclusive: one epoch'],
    ],
    message: 'Em dashes out of the timeline\'s prose (5). No facts changed. wiki-sweep run 583.',
  },
  {
    tagPath: 'contents/history',
    slug: 'infrastructure-rfps',
    change: 'patch',
    verified: true,
    sentinel: 'no replies as of 13 October 2026',
    swaps: [
      ['It had no replies as of 15 September 2026.', 'It had no replies as of 13 October 2026.'],
    ],
    message: 'Re-read 13 Oct 2026: the Gateway future discussion thread still has no replies, and babylon-gateway has had no release or commit since v1.10.7 on 7 Sep 2026. Date moved; page verified.',
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
    const left = (JSON.stringify(blocks).match(/—/g) || []).length;

    const version = await writeRevision(client, page, blocks,
      { change: e.change, message: e.message, verified: e.verified, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (em dashes left: ${left})`);
  }
});
