/**
 * sweep 465 - three ecosystem pages, each given the source it was missing, and
 * the validator half of the XIDAR domain story.
 *
 * Run 464's unsourced queue found three ecosystem articles carrying no external
 * link anywhere in their blocks. One of the three, /ecosystem/xrd-domains, is
 * LOCKED and stays a human flag. The other two are here, plus /ecosystem/xidar,
 * which the run-465 validator census turned up a new fact about.
 *
 * 1. /ecosystem/etherealdao. Its Status section, written on 16 September, is
 *    correct and cites nothing. The registry record is the source for all of
 *    it: ethereal.systems was registered 4 April 2023, expires 4 April 2027,
 *    last changed 11 August 2026, registrar GoDaddy, nameservers ns33 and
 *    ns34.domaincontrol.com. So the original registrant still holds the name
 *    and has pointed it at the registrar\'s parking service - unlike
 *    apollopool.io and xidar.io, which someone else bought. Re-read 21
 *    September 2026: RDAP unchanged, and https://ethereal.systems/ still
 *    returns the 114-byte redirect to /lander, which serves GoDaddy\'s parking
 *    lander (window._trfd ap:"parking", img1.wsimg.com/parking-lander).
 *
 * 2. /ecosystem/arcane-labyrinth. No Status section at all. The game\'s own
 *    Telegram group, t.me/arcanexrd, still gives arcanelabyrinth.com in its
 *    description; read 21 September 2026 that name returns NXDOMAIN from both
 *    1.1.1.1 and 8.8.8.8, and rdap.verisign.com/com/v1/domain/arcanelabyrinth
 *    .com answers 404, which for the .com registry means no registration at
 *    all: the domain lapsed and is free to register. The group is still open,
 *    577 members, 3 online. The 404 is not linked, because a citation that
 *    404s is what the link checker exists to remove.
 *
 * 3. /ecosystem/xidar. The page already sets out the re-registration of
 *    xidar.io on 4 August 2026 and the token metadata that still points at it.
 *    The census adds the validator side: at epoch 342,675 the registered
 *    validator "XIDAR - DGC" publishes https://xidar.io as its on-ledger
 *    info_url over 61,327,775 XRD, and "Investment DAO" publishes
 *    https://app.xidar.io/DAO, which has no DNS record. The redirect chain has
 *    also moved since the 13 September reading: it now stops at a second Indian
 *    business domain rather than reaching the affiliate page. As with the rest
 *    of the page, no redirect target is named or linked.
 *
 * Run once. Idempotent: each page has its own sentinel and is skipped if
 * present, so a second run writes nothing.
 */
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');

const RDAP_ETHEREAL = 'https://rdap.identitydigital.services/rdap/domain/ethereal.systems';
const TG_ARCANE = 'https://t.me/arcanexrd';

// ---- 1. /ecosystem/etherealdao ---------------------------------------------
const ETH_SENTINEL = 'registry record';
const ETH_OLD =
  'The domain is registered until April 2027, and its registration record was last changed on 11 August 2026.';
const ETH_NEW =
  `The <a href="${RDAP_ETHEREAL}" target="_blank" rel="noopener">registry record</a> gives the ` +
  'name a first registration of 4 April 2023, an expiry of 4 April 2027 and a last change of ' +
  '11 August 2026, with GoDaddy as registrar and <code>ns33.domaincontrol.com</code> and ' +
  '<code>ns34.domaincontrol.com</code> as nameservers. The original registrant still holds it and ' +
  'has pointed it at the registrar\'s parking service, so unlike a lapsed name it has not ' +
  'changed hands. Re-read on 21 September 2026, all of that is unchanged.';

// ---- 2. /ecosystem/arcane-labyrinth -----------------------------------------
const ARC_SENTINEL = '<h2>Status</h2>';
const ARC_SECTION =
  '<h2>Status</h2>' +
  '<p>The game directed players to <code>arcanelabyrinth.com</code>, the address its Telegram ' +
  `group <a href="${TG_ARCANE}" target="_blank" rel="noopener">still gives in its own ` +
  'description</a>. Read on 21 September 2026, that name returns no DNS record from either ' +
  '<code>1.1.1.1</code> or <code>8.8.8.8</code>, and the .com registry reports no registration ' +
  'for it, so the domain has lapsed and anyone can register it. The group is still open, with ' +
  '577 members. The description above comes from the project\'s own material, and no live ' +
  'source remains for it.</p>';

// ---- 3. /ecosystem/xidar ----------------------------------------------------
const XID_SENTINEL = 'XIDAR - DGC';
const XID_AFTER =
  'whoever holds the role that sets the token\'s metadata could still change them.</p>';
const XID_NEW =
  '<p>Two validators publish the same address. Read from the ' +
  '<a href="https://docs.radixdlt.com/docs/network-gateway" target="_blank" rel="noopener">Radix ' +
  'Gateway</a> at epoch 342,675 on 21 September 2026, the registered validator named ' +
  '<strong>XIDAR - DGC</strong> gives <code>https://xidar.io</code> as its on-ledger ' +
  '<code>info_url</code> over 61,327,775 XRD of delegated stake, and a second, ' +
  '<strong>Investment DAO</strong>, gives <code>https://app.xidar.io/DAO</code>, which has no DNS ' +
  'record. The <a href="https://docs.radixdlt.com/docs/metadata-for-wallet-display" ' +
  'target="_blank" rel="noopener">wallet presents a validator\'s <code>info_url</code></a> the ' +
  'same way it presents a token\'s, so the first of those two puts the re-registered domain in ' +
  'front of anyone looking at the validator. Where it leads keeps moving: on 21 September it ' +
  'redirects through one Indian business domain to another, both behind Cloudflare, rather than ' +
  'to the affiliate page read on 13 September. How much of the register does this is counted on ' +
  '<a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">Validator Nodes</a>.</p>';

const replaceOnce = (haystack, needle, replacement, where) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`${where}: string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`${where}: string is not unique`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

const readPage = async (client, tagPath, slug) => {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [tagPath, slug],
  );
  if (!rows.length) throw new Error(`${tagPath}/${slug} not found`);
  return rows[0];
};

const writePage = async (client, page, blocks, version, changeType, message) => {
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
    [cuid(), page.id, json, page.title, version, changeType, AUTHOR_ID, message, now],
  );
  await client.query('COMMIT');
};

await withClient(async (client) => {
  // ---- 1. etherealdao -------------------------------------------------------
  {
    const page = await readPage(client, 'ecosystem', 'etherealdao');
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(ETH_SENTINEL)) {
      console.log('  etherealdao: registry citation already present - no write');
    } else {
      const block = blocks.find((b) => (b.text || '').includes(ETH_OLD));
      if (!block) throw new Error('etherealdao: Status registration sentence not found');
      block.text = replaceOnce(block.text, ETH_OLD, ETH_NEW, 'etherealdao registration');

      const version = '2.3.1';
      console.log(
        `  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}` +
          '\n        Status: registration sentence now cites the registry record (first external link on the page)',
      );
      if (!DRY)
        await writePage(
          client,
          page,
          blocks,
          version,
          'patch',
          'Source the Status section. The page carried no external link of any kind, which the ' +
            'verifiability standard reads as citing nothing. The registry record for ' +
            'ethereal.systems, re-read 21 September 2026, gives first registration 4 April 2023, ' +
            'expiry 4 April 2027, last change 11 August 2026, registrar GoDaddy, nameservers ' +
            'ns33/ns34.domaincontrol.com: the original registrant still holds the name and has ' +
            'parked it, so it has not changed hands the way apollopool.io and xidar.io did.',
        );
    }
  }

  // ---- 2. arcane-labyrinth --------------------------------------------------
  {
    const page = await readPage(client, 'ecosystem', 'arcane-labyrinth');
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(ARC_SENTINEL)) {
      console.log('  arcane-labyrinth: Status section already present - no write');
    } else {
      blocks.push({ id: uid(), type: 'content', text: ARC_SECTION });

      const version = '2.3.0';
      console.log(
        `  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}` +
          `\n        + "Status" block [${blocks.length - 1}] (${ARC_SECTION.length} chars, first external link on the page)`,
      );
      if (!DRY)
        await writePage(
          client,
          page,
          blocks,
          version,
          'minor',
          'Add a sourced Status section. The page carried no external link of any kind and no ' +
            'statement of what became of the game. Its Telegram group, t.me/arcanexrd, still gives ' +
            'arcanelabyrinth.com in its description and is still open with 577 members; read ' +
            '21 September 2026 that name returns NXDOMAIN from both 1.1.1.1 and 8.8.8.8 and the ' +
            '.com registry reports no registration for it, so the domain has lapsed rather than ' +
            'been re-registered by anyone else.',
        );
    }
  }

  // ---- 3. xidar -------------------------------------------------------------
  {
    const page = await readPage(client, 'ecosystem', 'xidar');
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(XID_SENTINEL)) {
      console.log('  xidar: validator paragraph already present - no write');
    } else {
      const block = blocks.find((b) => (b.text || '').includes(XID_AFTER));
      if (!block) throw new Error('xidar: token-metadata paragraph not found');
      block.text = replaceOnce(block.text, XID_AFTER, XID_AFTER + XID_NEW, 'xidar validator para');

      const version = '2.4.0';
      console.log(
        `  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}` +
          '\n        + the two validators publishing xidar.io, and the 21 September redirect chain',
      );
      if (!DRY)
        await writePage(
          client,
          page,
          blocks,
          version,
          'minor',
          'The validator side of the re-registered domain, from the run-465 info_url census. At ' +
            'epoch 342,675 on 21 September 2026 the registered validator "XIDAR - DGC" publishes ' +
            'https://xidar.io as its on-ledger info_url over 61,327,775 XRD of delegated stake, ' +
            'and "Investment DAO" publishes https://app.xidar.io/DAO, which has no DNS record. ' +
            'The wallet presents a validator info_url as it presents a token one, so the working ' +
            'link reaches the same re-registered domain. The chain has moved since 13 September: ' +
            'it now stops at a second Indian business domain instead of reaching the affiliate ' +
            'page. No redirect target is named or linked, as elsewhere on this page.',
        );
    }
  }
});
