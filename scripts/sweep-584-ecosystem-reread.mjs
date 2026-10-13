// Sweep 584 (ecosystem): re-read the three stalest pages against their live sources
// (Maya, Clarity, Mox Studio), rewrite their em dashes, and give two orphaned DAO
// platforms an inbound link from CrumbsUp.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const SENTINEL = '13 October 2026';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const MAYA_REREAD = `<p>Re-read at 15:07 UTC on ${SENTINEL} (mainnet epoch 349,155, MAYAChain node ${ext('https://mayanode.mayachain.info/mayachain/version', 'v1.134.0')}), nothing has moved. The ${ext('https://mayanode.mayachain.info/mayachain/inbound_addresses', 'inbound addresses')} still list the same seven chains, the ${ext('https://mayanode.mayachain.info/mayachain/mimir', 'Mimir parameters')} still carry RAGNAROK-XRD-XRD at 1 with all three halt flags at 0, the ${ext('https://dashboard.radixdlt.com/account/account_rdx16ypcqr4eytpx0ly5tgxsgc8xj475y3ncsvpgtel5xguq28jcvam6xp', 'inbound vault account')} is still empty, and the ${ext('https://dashboard.radixdlt.com/component/component_rdx1cp7hrk7k0pjavnpt5h6dsel096kzlj96r8ukw2ywqgdc5tlvpvn0as', 'router')} still holds 791,820.9 XRD and 2.5 xUSDC. Neither has taken part in a transaction since 30 April 2026.</p>`;

const CLARITY_REREAD = `<p>Re-read on ${SENTINEL}, nothing has changed: ${ext('https://www.clarity.community/', 'clarity.community')} carries the same Cardano title and no mention of Radix, and ${ext('https://www.clarity.vote/radix', 'www.clarity.vote/radix')} returns the same 404 as an invented control path.</p>`;

const MOX_REREAD = `<p>Re-read on ${SENTINEL}, all three signals stand. The certificate that expired on 7 June 2026 has not been renewed, both store listings still return 404, and the ${ext('https://dashboard.radixdlt.com/resource/resource_rdx1thmjcqjnlfm56v7k5g2szfrc44jn22x8tjh7xyczjpswmsnasjl5l9', 'MOX supply')} still reads 84,000,000. The token still trades, thinly: ${ext('https://ociswap.com/resource_rdx1thmjcqjnlfm56v7k5g2szfrc44jn22x8tjh7xyczjpswmsnasjl5l9', 'Ociswap')} recorded 727,554 MOX of volume in the seven days to ${SENTINEL}.</p>`;

const CRUMBSUP_SEE_ALSO = `<h2>See also</h2><ul><li><a href="/ecosystem/clarity-protocol" rel="noopener">Clarity Protocol</a> – a no-code DAO platform that launched on Radix in October 2023 and now serves Cardano only</li><li><a href="/ecosystem/muan-protocol" rel="noopener">Muan Protocol</a> – an on-chain DAO governance framework on Radix, its mainnet interface paused pending V2</li></ul>`;

const EDITS = [
  {
    slug: 'maya-protocol', verified: true,
    replace: [
      ['through 2025 — 4,765 in May, 996 in November — to 509', 'through 2025 (4,765 in May, 996 in November) to 509'],
      ['from 18 to 16 — roughly 96%', 'from 18 to 16, roughly 96%'],
      ['against Radix — under Maya', 'against Radix: under Maya'],
      ['seven chains — ADA, ARB, BTC, DASH, ETH, THOR and ZEC — and no XRD entry', 'seven chains (ADA, ARB, BTC, DASH, ETH, THOR and ZEC) and no XRD entry'],
    ],
    append: { after: 'this zero is the ledger.</p>', html: MAYA_REREAD },
    message: 'Ecosystem sweep 584: re-read on 13 Oct 2026 (epoch 349,155, node v1.134.0). Radix still retired from MAYAChain: inbound addresses list seven chains without XRD, RAGNAROK-XRD-XRD 1, halt flags 0; inbound vault empty, router 791,820.9 XRD + 2.5 xUSDC, no transaction on either since 30 Apr 2026. Five em dashes rewritten.',
  },
  {
    slug: 'clarity-protocol', verified: true,
    replace: [
      [' — but as of 15 August 2026', ', but as of 15 August 2026'],
      ['on that basis — dormant on Radix', 'on that basis: dormant on Radix'],
      ['Clarity — official site', 'Clarity: official site'],
      ['Functionality" — Clarity on YouTube', 'Functionality", Clarity on YouTube'],
    ],
    append: { after: 'rather than closed as a business.</p>', html: CLARITY_REREAD },
    message: 'Ecosystem sweep 584: Status on Radix re-read on 13 Oct 2026. clarity.community still titled for Cardano with no Radix mention; www.clarity.vote/radix still returns the control 404. Four em dashes rewritten.',
  },
  {
    slug: 'mox-studio', verified: true,
    replace: [
      ['reads as offline — which is why', 'reads as offline, which is why'],
      ['since been withdrawn — see “Status (August 2026)” below.', 'since been withdrawn; see “Status (August 2026)” below.'],
      ['WordPress homepage — title “Home - MOX STUDIO”, locale <code>tr_TR</code> — still describing', 'WordPress homepage (title “Home - MOX STUDIO”, locale <code>tr_TR</code>) still describing'],
      ['return HTTP 404 — <code>id6498866858</code> at Apple and <code>com.moxstd.strangers</code> at Google — so the claim', 'return HTTP 404 (<code>id6498866858</code> at Apple and <code>com.moxstd.strangers</code> at Google), so the claim'],
      ['recorded as dormant — its published distribution', 'recorded as dormant: its published distribution'],
      ['for a certificate to lapse — while the token', 'for a certificate to lapse, while the token'],
    ],
    append: { after: 'continues to trade independently of it.</p>', html: MOX_REREAD },
    message: 'Ecosystem sweep 584: status re-read on 13 Oct 2026. Sectigo certificate still expired (7 Jun 2026), both store listings still 404, MOX supply 84,000,000, 727,554 MOX traded on Ociswap in 7 days. Seven em dashes rewritten.',
  },
  {
    slug: 'crumbsup', verified: false,
    replace: [],
    append: { after: 'CrumbsUp introduction (YouTube)</a></li></ul>', html: CRUMBSUP_SEE_ALSO, sentinel: '/ecosystem/clarity-protocol' },
    message: 'Ecosystem sweep 584: See also links the two other DAO platforms built for Radix, Clarity Protocol and Muan Protocol (both previously had no inbound link).',
  },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage('ecosystem', e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ecosystem', e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    const sentinel = e.append.sentinel ?? SENTINEL;
    if (JSON.stringify(blocks).includes(sentinel.replace(/\//g, '\\/')) || JSON.stringify(blocks).includes(sentinel)) {
      console.log(`  ${e.slug}: already applied — no write`);
      continue;
    }
    for (const [from, to] of e.replace) {
      const hits = blocks.filter((b) => b.text?.includes(from));
      if (hits.length !== 1 || hits[0].text.split(from).length !== 2) throw new Error(`${e.slug}: "${from}" matched ${hits.length} blocks`);
      hits[0].text = hits[0].text.replace(from, to);
    }
    const target = blocks.filter((b) => b.text?.includes(e.append.after));
    if (target.length !== 1) throw new Error(`${e.slug}: append anchor matched ${target.length} blocks`);
    target[0].text = target[0].text.replace(e.append.after, e.append.after + e.append.html);
    const dashes = blocks.reduce((n, b) => n + (b.text?.split('—').length - 1 || 0), 0);
    const version = await writeRevision(client, page, blocks, { change: 'patch', message: e.message, verified: e.verified, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (em dashes left: ${dashes})`);
  }
});
