// sweep 450 - ecosystem rotation, the verification-age head after run 447.
//
// radstakes: the fee increase the page recorded as pending has landed. Read from the Gateway at
//   epoch 341,763 (23:05 UTC, 17 September 2026): effective_fee_factor 0.25, while the stored
//   validator_fee_factor still reads 0.15 and the elapsed request is still recorded against it.
//   Stake 99,768,918.19 -> 93,213,191.72 XRD since 10 August, rank 14 of 188 -> 17 of 186;
//   208,355 proposals made against 2 missed over the 8,134 epochs between the two readings. The
//   register-wide census the page took on 10 August (63 elapsed requests, one pending, Radstakes)
//   now reads 62 elapsed and five pending, with Radstakes in the first group. radstakes.com still
//   answers HTTP 404 with the Wix placeholder; content.radstakes.com, the host the validator's
//   on-ledger icon_url names, still serves the logo. Em dashes converted.
// doubt-it: doubtit.digital has been rebuilt as a marketing site for the digital game and no
//   longer mentions Radix, $DOUBT or Quack Space in any rendered copy - the connection survives
//   only in the description, Open Graph and Twitter Card tags. Its footer now carries
//   "(C) 2025 Rook and Board Games, LLC", so the attribution this page recorded as absent from the
//   public branding is present; corrected. The page loads widget.js from Radix Rolodex and renders
//   a <radix-rolodex stable-id="launch-feature"> element. doubtitgame.com no longer completes a
//   TLS handshake at all and answers 409 over plain HTTP. $DOUBT market re-read on Ociswap.
// radix-rolodex: the public deck store re-counted at 17 September - 32 cards, 15 decks, five
//   creator wallets, eight tokens, all 32 linking to Ociswap, newest card and deck both
//   14 February 2026. Identical to the 13 August reading, so dormant holds. Records the second
//   embed route (the <radix-rolodex> custom element from widget.js) and its live host. Drops the
//   duplicated, unsourced second "Rads and Decks" section, which described a Rad as a card about
//   "a single project, token, or community" against the measured finding that every card is built
//   around a token.
//
//   node scripts/sweep-450-ecosystem-vandyill-radstakes.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'ecosystem';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;
const GATEWAY = ext('https://docs.radixdlt.com/docs/network-gateway', 'Radix Gateway');
const EMDASH = String.fromCharCode(0x2014);
const NBSP = String.fromCharCode(0xa0);

const RADSTAKES_NEW = `<h3>The increase landed, and the stored field did not move (17 September 2026)</h3>`
  + `<p>Read from the ${GATEWAY} at <strong>epoch 341,763</strong> (23:05&nbsp;UTC, 17 September 2026), the request has taken effect: the validator's <code>effective_fee_factor</code> is <strong>0.25</strong>, a month after epoch&nbsp;335294 passed. Its stored <code>validator_fee_factor</code> still reads <code>0.15</code>, and the fee-change request is still recorded against it unchanged. That pairing is the settled end state rather than a fault - an elapsed request is what the validator charges, and the stored factor is only overwritten when the owner signs another <code>update_fee</code>. A reader taking the stored field for the fee would be a month out of date and ten points low.</p>`
  + `<p>The register has moved with it. Where this validator was, on 10 August, the only pending request on the whole list against 63 elapsed ones, the same read now finds <strong>62 validators charging a fee that differs from their stored factor</strong> and <strong>five whose request has not yet taken effect</strong>. Radstakes has crossed from the second group into the first.</p>`
  + `<p>Stake has fallen with the fee. The validator holds <strong>93,213,191.72&nbsp;XRD</strong>, 6,555,726&nbsp;XRD (6.6%) less than on 10 August, and ranks <strong>17th of the 186 registered validators</strong> rather than 14th of 188 - a change of rank owed as much to the two validators that have left the register as to the stake that has left this one. Over the 8,134 epochs between the two readings it proposed <strong>208,355 times against 2 misses</strong>, so the node itself has run essentially without fault throughout.</p>`
  + `<p>The web presence has not come back. <code>radstakes.com</code> still answers HTTP&nbsp;404 with the same Wix placeholder. The one part of it still serving is <code>content.radstakes.com</code>, the asset host the validator's on-ledger <code>icon_url</code> names, which returns the Radstakes logo normally - so the icon the dashboard draws beside this node is served from a domain whose site is gone.</p>`;

const DOUBT_NEW = `<h2>The site as rebuilt (September 2026)</h2>`
  + `<p>Read on <strong>17 September 2026</strong>, ${ext('https://doubtit.digital', 'doubtit.digital')} is a full marketing site for the digital game: a four-step "How to Play", a feature list claiming <strong>500+ questions</strong>, <strong>2 to 8 players</strong>, real-time sync and no app install, three player testimonials, and two calls to action, "Play Now" and "Buy Board Game".</p>`
  + `<p>What no rendered copy on it mentions is Radix, $DOUBT or ${int('/ecosystem/quackspace', 'Quack Space')}. The Radix connection survives only in the document head, where the <code>description</code>, Open Graph and Twitter Card tags all read "earn $DOUBT tokens on the Radix blockchain" - copy that search engines and link previews show and that a visitor never sees. Whether the token integration described below is still being built or has been quietly set aside is not something the site answers; what can be stated is that it is no longer part of how the game presents itself.</p>`
  + `<p>The page does carry one live Radix component. It loads <code>widget.js</code> as an ES module from ${int('/ecosystem/radix-rolodex', 'Radix Rolodex')}, VandyILL's own token-card widget, and renders a <code>&lt;radix-rolodex stable-id="launch-feature"&gt;</code> element above the footer, so the deck rotating there is the Rolodex launch deck.</p>`;

const ROLODEX_NEW = `</p><p>There is a second route, which this page did not previously record. A site can load <code>widget.js</code> from the same host as an ES module and place a <code>&lt;radix-rolodex&gt;</code> custom element, which takes the same <code>stable-id</code> attribute and renders in the host page rather than inside an iframe. ${int('/ecosystem/doubt-it', 'Doubt/it! Digital')} embeds it that way, with <code>stable-id="launch-feature"</code>, which makes doubtit.digital a live host of a deck outside this wiki.`;

const EDITS = [
  {
    slug: 'radstakes',
    version: '3.3.0',
    sentinel: 'The increase landed, and the stored field did not move',
    dashes: true,
    swaps: [
      ['<td>🟢 Active (validator registered; website offline)</td>',
       '<td>🟢 Active (validator registered, charging a 25% fee; website offline)</td>'],
      ['<td>99,768,918.19 XRD (rank 14 of 188 registered, 10 Aug 2026)</td>',
       '<td>93,213,191.72 XRD (rank 17 of 186 registered, 17 Sep 2026)</td>'],
      [`<td>15%, rising to 25% at epoch 335294 ${EMDASH} about 16 August 2026</td>`,
       '<td>25% charged since epoch 335294 (16 August 2026); the stored field still reads 15%</td>'],
      ['<td>100% (trailing month)</td>',
       '<td>99.999% (208,355 proposals made, 2 missed since 10 August 2026)</td>'],
      ['<td>radstakes.com (offline)</td>',
       '<td>radstakes.com (offline, HTTP 404; the content.radstakes.com asset host still answers)</td>'],
      ['The two weeks are the window delegators are given to leave, and roughly six days of it remain.</p>',
       `The two weeks are the window delegators are given to leave, and roughly six days of it remain.</p>${RADSTAKES_NEW}`],
    ],
    message: 'Re-read at epoch 341,763 (17 September 2026): the 25% fee the page recorded as pending has been in force for a month, while the stored validator_fee_factor still reads 0.15 and the elapsed request is still on the record. Stake 99.77m -> 93.21m XRD since 10 August, rank 14 of 188 -> 17 of 186, 208,355 proposals made against 2 missed. The register-wide fee census re-taken: 62 elapsed requests and five pending, against 63 and one on 10 August. radstakes.com still 404; content.radstakes.com, the icon_url host, still serves. Infobox updated, new dated section, em dashes converted.',
  },
  {
    slug: 'doubt-it',
    version: '2.5.0',
    sentinel: 'The site as rebuilt (September 2026)',
    swaps: [
      ['a Shopify storefront whose TLS certificate expired on 15 November 2025 and which now answers Shopify\'s \"domain not connected\" response &ndash; the domain is registered until November 2026, but the store no longer loads in any browser (checked 12 August 2026).',
       'a Shopify storefront whose TLS certificate expired on 15 November 2025. Re-checked on 17 September 2026, it no longer completes a TLS handshake at all, and plain HTTP answers <code>409</code>, the status Shopify returns for a domain that is not connected to a store; the domain is registered until November 2026, but the store loads in no browser.'],
      ['still carries a \"buy the original boardgame\" link to it. The digital game and the token are unaffected.',
       'still links to it twice, from its "Buy Board Game" button and from its footer. The digital game and the token are unaffected.'],
      ['<h2>The $DOUBT token on-ledger</h2>', `${DOUBT_NEW}<h2>The $DOUBT token on-ledger</h2>`],
      ['<p>The resource metadata also carries an attribution the game\'s public branding does not: the description reads <em>\"A game by Rook &amp; Board Games LLC. (C) 2024\"</em>, placing a registered company behind the VandyILL name.</p>',
       '<p>The resource metadata carries the attribution <em>\"A game by Rook &amp; Board Games LLC. (C) 2024\"</em>, naming a registered company behind the VandyILL brand. This page previously recorded that attribution as one the public branding did not carry; on the site as rebuilt it does, the footer of doubtit.digital reading "(C) 2025 Rook and Board Games, LLC".</p>'],
      ['As of 5 August 2026 the token traded at about US$0.000042, against a pool of roughly <strong>US$981</strong>; cumulative volume since listing was near US$23,900, of which about US$1.92 fell in the preceding seven days.',
       'As of 17 September 2026 the token traded at about US$0.000030, against a pool of roughly <strong>US$645</strong>; cumulative volume since listing was near US$23,976, of which about US$21 fell in the preceding seven days.'],
    ],
    message: 'Re-read 17 September 2026. doubtit.digital has been rebuilt as a marketing site for the digital game whose rendered copy never mentions Radix, $DOUBT or Quack Space; the connection survives only in the description, Open Graph and Twitter Card tags. Its footer now carries the Rook and Board Games attribution this page recorded as absent from the public branding - corrected. The site embeds the Radix Rolodex widget as a custom element. doubtitgame.com no longer completes a TLS handshake and answers 409 over plain HTTP. $DOUBT re-read on Ociswap: about US$0.000030, a US$645 pool, US$23,976 cumulative volume.',
  },
  {
    slug: 'radix-rolodex',
    version: '2.1.0',
    sentinel: 'A re-count on <strong>17 September 2026</strong>',
    dropBlockIds: ['65b097fd-a085-447b-b3f8-324435d8ba0f'],
    swaps: [
      ['so nearly every embed in circulation is pinned to a specific document.</p>',
       `so nearly every embed in circulation is pinned to a specific document.${ROLODEX_NEW}</p>`],
      ['The most recent card or deck of any kind dates from <strong>14 February 2026</strong>, and the deployed application bundle was last built on 10 February 2026. The service is up and every published embed still renders, but nothing has been added to it in six months, so this page records the project as dormant rather than active.',
       'The most recent card or deck of any kind dates from <strong>14 February 2026</strong>, and the deployed application bundle was last built on 10 February 2026. A re-count on <strong>17 September 2026</strong> returned exactly the same catalogue - 32 cards, 15 decks, five creator wallets, eight tokens, and all 32 cards still linking to Ociswap - so nothing has been added in the seven months since. The service is up and every published embed still renders; this page records the project as dormant rather than active.'],
    ],
    message: 'Public deck store re-counted on 17 September 2026 and identical to the 13 August reading: 32 cards across 15 decks, five creator wallets, eight tokens, all 32 linking to Ociswap, newest card and deck both 14 February 2026. Dormant holds. Records the second embed route - the <radix-rolodex> custom element loaded from widget.js, in live use on doubtit.digital with stable-id="launch-feature". Removed a duplicated, unsourced second "Rads and Decks" section that described a Rad as a card about a project, token or community, against the measured finding that every published card is built around a token.',
  },
];

function swapOnce(blocks, [from, to]) {
  let hits = 0;
  const visit = (list) => list.map((b) => {
    let next = b;
    if (typeof b.text === 'string' && b.text.includes(from)) { hits++; next = { ...b, text: b.text.replace(from, to) }; }
    if (Array.isArray(b.blocks)) next = { ...next, blocks: visit(b.blocks) };
    return next;
  });
  const out = visit(blocks);
  if (hits !== 1) throw new Error(`expected 1 match, got ${hits}: ${from.slice(0, 70)}`);
  return out;
}

const undash = (list) => list.map((b) => ({
  ...b,
  ...(typeof b.text === 'string' ? { text: b.text.replaceAll(` ${EMDASH} `, ' - ').replaceAll(EMDASH, ' - ') } : {}),
  ...(Array.isArray(b.blocks) ? { blocks: undash(b.blocks) } : {}),
}));

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(TAG, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied - no write`);
      continue;
    }
    let blocks = JSON.parse(JSON.stringify(page.content));
    for (const s of e.swaps) blocks = swapOnce(blocks, s);
    if (e.dropBlockIds) {
      for (const id of e.dropBlockIds) {
        const before = blocks.length;
        blocks = blocks.filter((b) => b.id !== id);
        if (blocks.length !== before - 1) throw new Error(`${e.slug}: block ${id} not found`);
      }
    }
    if (e.dashes) blocks = undash(blocks);
    const json = JSON.stringify(blocks);
    if (json.includes(NBSP) || json.includes(EMDASH)) throw new Error(`${e.slug}: U+00A0 or an em dash in output`);
    if (!json.includes(e.sentinel)) throw new Error(`${e.slug}: sentinel missing after edits`);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (${json.length - JSON.stringify(page.content).length} chars)`);
    if (DRY) continue;

    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.change ?? 'minor', AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
    console.log('    written and stamped');
  }
});
