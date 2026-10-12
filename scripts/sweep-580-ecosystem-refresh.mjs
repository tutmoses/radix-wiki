// Run 580 (ecosystem rotation, order index 2). Three edits:
// - miow: miow.me answers again (read 23:10 UTC 12 Oct 2026), but with an AI website builder for small
//   businesses, passkey sign-in, no Radix wallet or XRD pricing; /s/<slug> and /guide return its own
//   not-found page. The Radix builder the page describes is gone: status Dormant -> Closed, tense moved.
// - radix-kingdoms: KGLD re-read at epoch 348,963: 21,827,257.50, up 714,340.85 on 16 Sep, the first rise
//   the page records; the 20 latest KGLD transactions fall 10-12 Oct, mostly mints into kingdom components.
// - nfts-on-radix: links three orphaned ecosystem pages (bardix, parabox, soulstore) plus radix-kingdoms
//   from the Gaming use case and Advanced Features, the fix-forward orphan queue.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');

const MIOW_OLD_START = '<p><strong>The platform is offline.</strong>';
const MIOW_OLD_END = 'which is what the status field on this page records.</p>';
const MIOW_NEW = '<p><strong>The Radix builder has closed.</strong> From 4 September 2026 <code>miow.me</code> answered HTTP&nbsp;404 at every path with <code>x-vercel-error: DEPLOYMENT_NOT_FOUND</code>, the answer Vercel gives when no deployment is assigned to a domain, and it gave the same answer on 12 September, after Radix mainnet had resumed. Read again at 23:10 UTC on 12 October 2026, the domain answers again, with a different product. The <a href="https://miow.me" target="_blank" rel="noopener">home page</a> and its <a href="https://miow.me/llms.txt" target="_blank" rel="noopener">llms.txt</a> describe an AI website builder for small businesses with passkey sign-in, and neither mentions a Radix wallet or XRD pricing. The paths this page described, <code>/s/&lt;slug&gt;</code> and <code>/guide</code>, return that site&rsquo;s not-found page. The <a href="https://web.archive.org/web/20260610*/miow.me*" target="_blank" rel="noopener">Internet Archive</a> holds 35 captures of the Radix builder, all taken on 10 June 2026.</p>';

const KGLD_NEW = '<p>Read on 12 October 2026 at epoch 348,963, supply is <strong>21,827,257.50 KGLD</strong>, <strong>714,340.85 above</strong> the September reading: over those four weeks the game issued more gold than it burned, the first rise this page has recorded. It is still being played. The 20 most recent transactions touching KGLD fall between 10 and 12 October, and most of them mint between about 1,900 and 11,200 KGLD into kingdom components. The mint and burn rules are unchanged.</p>';

const EDITS = [
  {
    tagPath: 'ecosystem',
    slug: 'miow',
    change: 'minor',
    verified: true,
    sentinel: 'The Radix builder has closed.',
    status: '🔴 Closed',
    swaps: [
      ['<p><strong>Miow</strong> is a Web3 website builder', '<p><strong>Miow</strong> was a Web3 website builder'],
      ['Users connect their', 'Users connected their'],
      ['assemble pages from', 'assembled pages from'],
      ['and pay 100,000', 'and paid 100,000'],
      ['briefing states the price is', 'briefing stated the price was'],
      ['A published site is served from', 'A published site was served from'],
      ['the public sitemap lists every live site', 'the public sitemap listed every live site'],
      ['serves one such site', 'served one such site'],
      ['The same payment also releases', 'The same payment also released'],
      ['the deployment guide covers', 'the deployment guide covered'],
      ['which is the route', 'which was the route'],
      ['and the domain has served <code>DEPLOYMENT_NOT_FOUND</code> at every path since at least 4 September 2026.', 'and none of them has served the Radix builder since 4 September 2026; the domain now hosts an unrelated product.'],
    ],
    splice: [MIOW_OLD_START, MIOW_OLD_END, MIOW_NEW],
    message: 'miow.me answers again (read 23:10 UTC 12 Oct 2026) with a different product: an AI website builder for small businesses with passkey sign-in; home page and llms.txt mention no Radix wallet or XRD pricing, and /s/<slug> and /guide return its not-found page. The Radix builder is closed: status Dormant -> Closed, Status section rewritten, overview moved to past tense.',
  },
  {
    tagPath: 'ecosystem',
    slug: 'radix-kingdoms',
    change: 'minor',
    verified: true,
    sentinel: '21,827,257.50',
    swaps: [
      ['with a total supply of 21,112,916.65 as of 16 September 2026 (see below)', 'with a total supply of 21,827,257.50 as of 12 October 2026 (see below)'],
      ['On-Ledger Readings (August and September 2026)', 'On-Ledger Readings (August to October 2026)'],
      ['48 of them on 15 September. The authorities below are unchanged.</p>', '48 of them on 15 September. The authorities below are unchanged.</p> ' + KGLD_NEW],
    ],
    message: 'KGLD re-read at epoch 348,963 (12 Oct 2026): supply 21,827,257.50, up 714,340.85 on the 16 Sep reading, the first rise recorded; the 20 latest KGLD transactions fall 10-12 Oct, mostly mints into kingdom components. Authorities unchanged (mint badge immutable; burn by badge or the RadixKingdoms NF).',
  },
  {
    tagPath: 'contents/tech/core-protocols',
    slug: 'nfts-on-radix',
    change: 'patch',
    verified: false,
    sentinel: '/ecosystem/soulstore',
    swaps: [
      ['<li><p>Player identities and profiles as soulbound NFTs</p></li></ul>', '<li><p>Player identities and profiles as soulbound NFTs</p></li></ul><p>On Radix, <a href="/ecosystem/radix-kingdoms" rel="noopener">Radix Kingdoms</a> gives each player a key NFT that controls a kingdom component, <a href="/ecosystem/bardix" rel="noopener">Bardix</a> is a crafting game whose cocktails and ingredients are NFTs, and <a href="/ecosystem/parabox" rel="noopener">Parabox</a>, a metaverse project that disbanded, left its token on the ledger.</p>'],
      ['because items are native to the base layer.</p></li>', 'because items are native to the base layer.</p></li><li><p>An NFT can own other assets. <a href="/ecosystem/soulstore" rel="noopener">SoulStore</a> ties a store of tokens and NFTs to a single NFT: whoever holds the NFT controls the store, and the store moves with it on transfer.</p></li>'],
    ],
    message: 'Linked four Radix projects from the use cases: Radix Kingdoms, Bardix and Parabox under Gaming, SoulStore under Advanced NFT Features. Bardix, Parabox and SoulStore had no inbound links. wiki-sweep run 580.',
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
    if (e.status && !DRY) await client.query(
      `UPDATE pages SET metadata = jsonb_set(metadata, '{status}', to_jsonb($1::text)) WHERE id = $2`, [e.status, page.id]);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
