/**
 * sweep 372 (ecosystem rotation) – remove an unsourced allegation from two live
 * pages and put a dated, reproducible reading in its place.
 *
 * Both /ecosystem/delay and /contents/history/radix-ecosystem-funding carried
 * the same sentence, written once in July 2026 and copied across: "in April
 * 2026 the project's social channels were deleted and its founder became
 * inactive – developments that community members characterised as a rug pull."
 * No source is cited on either page, none is recorded in either page's
 * revision history, and the DELAY page's initial revision message says only
 * that the "abandonment framing mirrors the fund page". The verifiability
 * policy does not allow it, and the neutral-point-of-view policy is stricter
 * still about an unattributed allegation of fraud against the person who ran a
 * project. Per /policy/editorial-notices, the fix goes in with the correction
 * and the account of it goes in the revision message.
 *
 * What replaces it is what can be read today. The Ociswap public API answers
 * for this resource while the Radix Gateway does not, so the market state is
 * checkable: read 2026-09-05 at 19:13 UTC, the DELAY pool holds 281,840,197
 * DELAY against 344,029 XRD, about $226 in all, on seven-day volume of $2.90
 * and a price of $0.00000044, ranked 66th on that venue. The same record dates
 * the token's Ociswap listing to 17 December 2024, the month the Ecosystem
 * Asset Fund started buying it. That is a market nobody is trading, stated
 * without alleging why.
 *
 * The one project link the token carries on-ledger is its Ociswap info_url,
 * rly.fun, which answered HTTP 200 on the same read. It is the launchpad the
 * token was minted through rather than a site the project controls, so it
 * settles nothing either way, and saying so is more use to a reader than the
 * sentence it replaces.
 *
 * Supply is deliberately untouched: the infobox figure was read at the Gateway
 * on 18 July 2026 and cannot be re-read while mainnet is halted.
 *
 *   node scripts/sweep-372-delay-unsourced-rugpull.mjs --dry-run
 */
import { config } from 'dotenv';
import { withClient, isLockedPage, cuid, AUTHOR_ID } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'ociswap.com/delay';

const OLD_DELAY_SECTION =
  '<h2>Abandonment</h2><p>DELAY’s market ranking subsequently fell, and in <strong>April 2026</strong> the project’s social channels were deleted and its founder became inactive – developments that community members characterised as a <em>rug pull</em>. The token continues to exist on-ledger and is community-owned, but the project behind it is defunct. The episode is frequently cited as an illustration of the abandonment risk in allocating public money to high-volatility meme coins by market capitalisation alone (see the <a href="/contents/history/radix-ecosystem-funding" rel="noopener">Ecosystem Asset Fund</a> page for the fuller account).</p>';

const NEW_DELAY_SECTION =
  '<h2>Abandonment</h2>' +
  '<p>DELAY’s market ranking fell away after the fund stopped buying, and the token now trades at close to nothing. Read at the <a href="https://ociswap.com/delay" target="_blank" rel="noopener">Ociswap</a> API on 5 September 2026, its pool held 281,840,197 DELAY against 344,029 <a href="/contents/tech/core-protocols/xrd-token" rel="noopener">XRD</a>, about $226 in all, on seven-day volume of $2.90 and a price of $0.00000044. It ranked 66th by market capitalisation on that venue. The same record dates the token’s listing there to 17 December 2024, the month the <a href="/contents/history/radix-ecosystem-funding" rel="noopener">Ecosystem Asset Fund</a> began buying it.</p>' +
  '<p>The only project link the token carries on-ledger is <a href="https://rly.fun" target="_blank" rel="noopener">rly.fun</a>, the meme coin launchpad it was minted through, which answered on the same read. A launchpad is not a site the project controls, so it settles nothing about who is still behind DELAY, and this page records no channel of DELAY’s own. The supply figure above was read at the Radix Gateway on 18 July 2026 and cannot be re-read while <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">mainnet is halted</a>.</p>' +
  '<p>The token continues to exist on-ledger and is community-owned. The episode is cited as an illustration of the abandonment risk in allocating public money to high-volatility meme coins by market capitalisation alone; see the <a href="/contents/history/radix-ecosystem-funding" rel="noopener">Ecosystem Asset Fund</a> page for the fuller account.</p>';

const OLD_STATUS_ROW = '<td>🔴 Abandoned (April 2026)</td>';
const NEW_STATUS_ROW = '<td>🔴 Abandoned – market effectively dead (read 5 September 2026)</td>';

const OLD_FUND_SENTENCE =
  ' DELAY’s market ranking subsequently fell, and in April 2026 the project’s social channels were deleted and its founder became inactive – developments that community members characterised as a rug pull.';
const NEW_FUND_SENTENCE =
  ' DELAY’s market ranking subsequently fell, and the token now trades at close to nothing: read at the <a href="https://ociswap.com/delay" target="_blank" rel="noopener">Ociswap</a> API on 5 September 2026 its pool held about $226 of liquidity on seven-day volume of $2.90.';

const DELAY_MESSAGE =
  'Abandonment: remove an unsourced allegation and replace it with a dated market reading. The section asserted that in April 2026 the social channels were deleted and the founder became inactive, "characterised as a rug pull" by unnamed community members. No source was cited here or on the Ecosystem Asset Fund page it was copied from, and none is recorded in either revision history, so the claim fails verifiability and, being an unattributed allegation against whoever ran the project, neutral point of view. In its place: the Ociswap API read on 5 September 2026 at 19:13 UTC - 281,840,197 DELAY against 344,029 XRD in the pool, about $226, seven-day volume $2.90, price $0.00000044, rank 66, listed there 17 December 2024 - plus the token’s on-ledger info_url rly.fun, which answered on the same read and is the launchpad rather than a project site. The infobox status loses the unsourced April 2026 date. Supply is untouched; it was read at the Gateway on 18 July 2026 and mainnet is halted.';

const FUND_MESSAGE =
  'Reception and Risks: remove the same unsourced April 2026 rug-pull sentence corrected on /ecosystem/delay this run, and put the dated Ociswap reading in its place. The claim was written here first and copied to the project page; neither carried a source. Nothing else in the section changes - the holdings, the 143,000 XRD figure and the portfolio record are all still read from the fund wallet on-chain.';

const replaceOnce = (haystack, needle, replacement, where) => {
  const n = haystack.split(needle).length - 1;
  if (n !== 1) throw new Error(`${where}: expected exactly 1 match, found ${n}`);
  return haystack.replace(needle, replacement);
};

const bump = (v, kind) => {
  const p = String(v).split('.').map(Number);
  if (kind === 'minor') { p[1] = (p[1] || 0) + 1; p[2] = 0; } else { p[2] = (p[2] || 0) + 1; }
  return p.join('.');
};

async function edit(client, { tag, slug, kind, message, mutate }) {
  if (isLockedPage(tag, slug)) throw new Error(`${tag}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tag, slug]);
  if (!rows.length) throw new Error(`page not found: ${tag}/${slug}`);
  const page = rows[0];

  if (JSON.stringify(page.content).includes(SENTINEL)) {
    console.log(`  skip  ${tag}/${slug} – already applied`);
    return false;
  }

  const blocks = JSON.parse(JSON.stringify(page.content));
  mutate(blocks);

  const version = bump(page.version, kind);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, kind, AUTHOR_ID, message, now]);
    await client.query('COMMIT');
  }
  return true;
}

await withClient(async (client) => {
  await edit(client, {
    tag: 'ecosystem', slug: 'delay', kind: 'minor', message: DELAY_MESSAGE,
    mutate: (blocks) => {
      const box = blocks.find(b => b.type === 'infobox');
      if (!box?.blocks?.length) throw new Error('delay: infobox not found');
      box.blocks[0].text = replaceOnce(box.blocks[0].text, OLD_STATUS_ROW, NEW_STATUS_ROW, 'delay infobox status');
      const i = blocks.findIndex(b => b.text === OLD_DELAY_SECTION);
      if (i < 0) throw new Error('delay: Abandonment block did not match byte for byte');
      blocks[i].text = NEW_DELAY_SECTION;
    },
  });

  await edit(client, {
    tag: 'contents/history', slug: 'radix-ecosystem-funding', kind: 'patch', message: FUND_MESSAGE,
    mutate: (blocks) => {
      const i = blocks.findIndex(b => (b.text || '').includes('characterised as a rug pull'));
      if (i < 0) throw new Error('funding: rug-pull sentence not found');
      blocks[i].text = replaceOnce(blocks[i].text, OLD_FUND_SENTENCE, NEW_FUND_SENTENCE, 'funding sentence');
    },
  });
});
