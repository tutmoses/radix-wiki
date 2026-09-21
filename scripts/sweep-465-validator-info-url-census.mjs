/**
 * sweep 465 - every registered validator's published website, probed once.
 *
 * Backlog items from runs 458 and 459 asked the same question twice and
 * narrowed it to something one pass can finish: how many validators publish an
 * on-ledger `info_url` that no longer reaches them? Apollo Pool (run 458) and
 * Cobra Stakes (run 455) were each found one at a time; the register carries
 * the field for most of its entries and scripts/check-links.mjs never reads
 * page metadata, let alone ledger metadata, so the set had never been probed.
 *
 * Method. /state/validators/list at epoch 342,675 (03:07:58 UTC, 21 September
 * 2026) returns 288 validator components, 185 of them registered, holding
 * 4,518,815,466 XRD between them. 155 of the 185 carry an `info_url` in their
 * on-ledger metadata and 30 carry none. Each of the 155 was fetched once with
 * a desktop Chrome user agent, following redirects, 25-second budget. Every
 * name that failed to resolve was then re-resolved serially against 1.1.1.1
 * and 8.8.8.8, and every TLS failure inspected with openssl s_client, so no
 * count here rests on the bulk pass alone.
 *
 * Result. 76 links return a page and 79 do not: 50 do not resolve, 12 fail
 * TLS, 6 answer 404, 6 answer a server error, 5 never answer. The 79 belong to
 * validators holding 959,831,411 XRD, 21.2% of the stake in the register. In
 * the top 100 by stake - the active set, max_validators in the genesis
 * configuration - 34 links fail and a further 9 validators publish none.
 *
 * The 50 non-resolving entries are 48 distinct names (www.radixnft.art is
 * named by three validators) and one that is not a domain at all, coming.soon.
 * The 12 TLS failures: 3 self-signed certificates, 2 expired, 1 issued for a
 * different name, 6 servers that abandon the connection at or just after the
 * handshake. The single 403 is CloudFront's, and its body says it cannot reach
 * the origin, so it is counted with the server errors rather than as a bot
 * wall.
 *
 * Two of the 76 working links reach a site the operator does not run:
 * apollopool.io, re-registered 23 August 2026 (RDAP, Identity Digital) and now
 * 301ing to tuantsuki.com, and xidar.io, re-registered 4 August 2026 and now
 * 301ing through chineseacupuncture.in to hospitalbiz.in. Both are on
 * Cloudflare nameservers.
 *
 * One page, three edits:
 *   1. infobox register row, 188 of 287 at epoch 332767 -> 185 of 288 at 342675
 *   2. the same reading in the "Registration and the active set" section
 *   3. a new section, "The website a validator publishes", before External Links
 *
 * The fee-divergence section keeps its epoch 332,767 and 338,190 readings: both
 * are dated in the prose and remain true of those epochs.
 *
 * Run once. Idempotent: the new section's sentinel is checked before any write.
 */
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');

const TAG = 'contents/tech/core-concepts';
const SLUG = 'validator-nodes';
const SENTINEL = 'The website a validator publishes';

const GATEWAY_DOCS = 'https://docs.radixdlt.com/docs/network-gateway';
const WALLET_META = 'https://docs.radixdlt.com/docs/metadata-for-wallet-display';

// ---- 1. the infobox register row -------------------------------------------
const IB_OLD = '<td>188 of 287 (mainnet, epoch 332767)</td>';
const IB_NEW = '<td>185 of 288 (mainnet, epoch 342675)</td>';

// ---- 2. the reading in "Registration and the active set" --------------------
const B2_OLD =
  'at epoch&nbsp;332767 on 7 August 2026, mainnet carries <strong>287 validator components, ' +
  'of which 188 are registered</strong>.';
const B2_NEW =
  'at epoch&nbsp;342675 on 21 September 2026, mainnet carries <strong>288 validator components, ' +
  'of which 185 are registered</strong>.';

// ---- 3. the new section ----------------------------------------------------
const SECTION =
  `<h2>${SENTINEL}</h2>` +
  '<p>A validator carries metadata on the ledger beside its stake, and one of those keys is ' +
  `<code>info_url</code>. The metadata standard defines it as a <a href="${WALLET_META}" ` +
  'target="_blank" rel="noopener">direct link to an informational webpage</a>, and the Radix ' +
  'Wallet presents it to anyone looking at the validator. Only the account holding the ' +
  '<a href="/contents/tech/core-concepts/badges" rel="noopener">owner badge</a> can set it, so the ' +
  'field is as current as its operator keeps it, and nothing on the ledger checks that it still ' +
  'goes anywhere.</p>' +
  `<p>Read from the <a href="${GATEWAY_DOCS}" target="_blank" rel="noopener">Gateway</a> at ` +
  'epoch&nbsp;342,675 on 21 September 2026, <strong>155 of the 185 registered validators publish ' +
  'an <code>info_url</code></strong> and 30 publish none. Fetching each of the 155 once, following ' +
  'redirects, <strong>79 do not reach a working page</strong>. That is 51% of the published links, ' +
  'and the validators behind them hold <strong>959,831,411 of the 4,518,815,466 XRD</strong> ' +
  'staked to registered validators, 21%. Within the top 100 by stake, the active set that proposes ' +
  'and validates rounds, 34 of the links fail and a further nine validators publish none.</p>' +
  '<table>' +
  '<tr><th>What the link does</th><th>Links</th></tr>' +
  '<tr><td>The name does not resolve</td><td>50</td></tr>' +
  '<tr><td>TLS fails, so a browser refuses the page</td><td>12</td></tr>' +
  '<tr><td>The server answers 404</td><td>6</td></tr>' +
  '<tr><td>The server answers an error, or a CDN reports it cannot reach the origin</td><td>6</td></tr>' +
  '<tr><td>The host resolves and never answers</td><td>5</td></tr>' +
  '<tr><td>The link returns a page</td><td>76</td></tr>' +
  '</table>' +
  '<p>The 50 names that do not resolve are 48 distinct domains, three validators naming ' +
  '<code>www.radixnft.art</code> between them, and one entry that was never a domain at all, ' +
  '<code>coming.soon</code>. Each returned NXDOMAIN from both <code>1.1.1.1</code> and ' +
  '<code>8.8.8.8</code> on a second, serial pass. Among them is ' +
  '<a href="/ecosystem/cobra-stakes" rel="noopener">Cobra Stakes</a>, rank 21 with 84,579,935 XRD ' +
  'delegated, whose <code>cobrastakes.com</code> entered the .com redemption period on 18 ' +
  'September. The 12 TLS failures are three self-signed certificates, two expired ones, one ' +
  'certificate issued for a different name, and six servers that abandon the connection at or just ' +
  'after the handshake; each was inspected with <code>openssl s_client</code> rather than taken ' +
  'from the fetch.</p>' +
  '<p>Two of the 76 links that do return a page return a site the operator does not run. ' +
  '<a href="/ecosystem/apollo-pool" rel="noopener">Apollo Pool</a> publishes ' +
  '<code>apollopool.io</code>, which a new owner ' +
  '<a href="https://rdap.identitydigital.services/rdap/domain/apollopool.io" target="_blank" ' +
  'rel="noopener">registered on 23 August 2026</a>; ' +
  '<a href="/ecosystem/xidar" rel="noopener">XIDAR</a> publishes <code>xidar.io</code>, ' +
  '<a href="https://rdap.identitydigital.services/rdap/domain/xidar.io" target="_blank" ' +
  'rel="noopener">registered again on 4 August 2026</a>, and its validator holds 61,327,775 XRD. ' +
  'Both names now sit on Cloudflare nameservers and redirect to businesses with no connection to ' +
  'Radix. Those two links answer HTTP 200; the other 77 failures do not load at all.</p>' +
  '<p>Correcting one of these is the operator’s to do, because only the owner badge can write ' +
  'the field. Nothing else can: a wallet showing a validator’s website has no way to tell that ' +
  'the name behind it changed hands.</p>';

const replaceOnce = (haystack, needle, replacement, where) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`${where}: string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`${where}: string is not unique`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

await withClient(async (client) => {
  if (isLockedPage(TAG, SLUG)) throw new Error(`${TAG}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG, SLUG],
  );
  if (!rows.length) throw new Error(`${TAG}/${SLUG} not found`);
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  validator-nodes: census already applied - no write');
    return;
  }

  // 1. infobox
  const ib = blocks.find((b) => b.type === 'infobox');
  if (!ib) throw new Error('infobox block not found');
  const ibLeaf = (ib.blocks || []).find((n) => (n.text || '').includes('Registered validators'));
  if (!ibLeaf) throw new Error('infobox "Registered validators" row not found');
  ibLeaf.text = replaceOnce(ibLeaf.text, IB_OLD, IB_NEW, 'infobox register row');

  // 2. the same reading in prose
  const b2 = blocks.find((b) => (b.text || '').includes('Read live from the'));
  if (!b2) throw new Error('"Read live from the Gateway" sentence not found');
  b2.text = replaceOnce(b2.text, B2_OLD, B2_NEW, 'register reading');

  // 3. the new section, immediately before External Links
  const extIdx = blocks.findIndex((b) => (b.text || '').includes('<h2>External Links</h2>'));
  if (extIdx < 0) throw new Error('External Links block not found');
  blocks.splice(extIdx, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '2.2.0';
  console.log(
    `  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}` +
      `\n        infobox: ${IB_OLD.slice(4, -10)} -> ${IB_NEW.slice(4, -10)}` +
      '\n        register reading: epoch 332767 (7 Aug) -> epoch 342675 (21 Sep)' +
      `\n        + section "${SENTINEL}" at block [${extIdx}] (${SECTION.length} chars)`,
  );

  if (!DRY) {
    assertLinkShapes(blocks, page.title);
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
      [json, version, now, page.id],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(),
        page.id,
        json,
        page.title,
        version,
        'minor',
        AUTHOR_ID,
        'Every registered validator’s published info_url, probed once. Read from ' +
          '/state/validators/list at epoch 342,675 (03:07 UTC, 21 September 2026): 288 components, ' +
          '185 registered, 4,518,815,466 XRD staked. 155 publish an info_url and 30 publish none; ' +
          'fetched once each with redirects, 79 of the 155 do not reach a working page (50 do not ' +
          'resolve, 12 fail TLS, 6 answer 404, 6 answer a server error, 5 never answer). Those 79 ' +
          'validators hold 959,831,411 XRD, 21.2% of the register; in the top 100 by stake, 34 ' +
          'links fail and 9 more publish none. Non-resolving names re-checked serially against ' +
          '1.1.1.1 and 8.8.8.8; TLS failures inspected with openssl s_client. Two working links ' +
          'reach a stranger: apollopool.io (re-registered 23 August 2026) and xidar.io ' +
          '(4 August 2026), both now on Cloudflare and redirecting off Radix. Register row and ' +
          'the section reading re-stated at the new epoch; the fee-divergence section keeps its ' +
          'own dated readings.',
        now,
      ],
    );
    await client.query('COMMIT');
  }
});
