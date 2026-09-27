/**
 * sweep 494 - GenkiPool's governance front end, on /ecosystem/genkipool.
 *
 * Run 493 banked a Telegram post (t.me/radix_dlt/1005180, 19:42 UTC 26 Sep)
 * announcing radix-community.genkipool.com/en/governance. The backlog item said
 * its author called the code open source; that reply (1005179) is Timan's, about
 * radixdlt.com. GenkiPool's own source is public anyway: github.com/genkipool/
 * Radix_Community, AGPL-3.0, last pushed 02:05 UTC 27 Sep.
 *
 * Read at 03:0x UTC 27 September 2026:
 * - /en/governance: 13 votes, 2 open (DAO proposal 0 = GP-PRE-1, Consultation
 *   TC #7), 1,099 votes cast.
 * - features/governance/config/systems.ts: two systems, Radix DAO
 *   (component_rdx1cp90ys..., collector vote.radixdao.org) and Radix
 *   Consultation (component_rdx1czn9hr..., collector api-consultation.
 *   mountain-top.live).
 * - features/governance/lib/voteManifest.ts: one vote_on_proposal /
 *   vote_on_temperature_check call per account plus a deposit_batch on each, so
 *   the wallet asks every account to sign. Multi-account option announced by
 *   the GENKI operator at 23:23 UTC 26 Sep (t.me/radix_dlt/1005185).
 * - features/governance/lib/votingMethods.ts: 23 weighting rules in four
 *   families (wealth 7, address 4, seniority 5, hybrid 7), shown on a
 *   "Comparison" tab.
 *
 * Idempotent: skipped if the sentinel is already stored.
 */
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'genkipool';
const VERSION = '1.4.0';
const SENTINEL = 'genkipool.com/en/governance';

const SITE = 'https://radix-community.genkipool.com/en/governance';
const REPO = 'https://github.com/genkipool/Radix_Community';
const SRC = `${REPO}/blob/main/features/governance`;
const DAO_COMPONENT =
  'https://dashboard.radixdlt.com/component/component_rdx1cp90ys553uwxuckev249x5wezucqru0u4qr7qdxdc9tlpmnh93242k';
const TC_COMPONENT =
  'https://dashboard.radixdlt.com/component/component_rdx1czn9hrgd30x742k6jw2e6psj9jlkqvu2cj4hcry60p7f38hxd3k3xt';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;

const SECTION = `<h2>Governance front end</h2>
<p>Since 26 September 2026 the portal has carried a ${ext(SITE, 'governance section')} that lists and casts votes for the two governance systems running on Radix mainnet, <a href="https://t.me/radix_dlt/1005180" target="_blank" rel="noopener">announced</a> by its operator in the Radix DLT Telegram. One is the Radix DAO's ${ext(DAO_COMPONENT, 'governance component')}, whose official front end is ${ext('https://vote.radixdao.org', 'vote.radixdao.org')}; the other is Radix Consultation's ${ext(TC_COMPONENT, 'component')}, whose front end is ${ext('https://consultation.mountain-top.live', 'consultation.mountain-top.live')}. The site reads each component's temperature checks and proposals from its ledger state, so a new vote appears without a code change, and takes the weighted tallies from each system's own vote collector (${ext(`${SRC}/config/systems.ts`, 'systems.ts')}). Read on 27 September, it listed 13 votes, 2 of them open: the ballot to ratify the ${int('/ideas/radix-network-dao-charter', 'Radix DAO Charter')} and its governance framework, and the Consultation's temperature check on how to allocate the USDC left behind by the ${int('/contents/history/hyperlane-asset-drain-2026', 'Hyperlane asset drain')}.</p>
<p>Votes are signed in the Radix Wallet, and one transaction can cast the same vote from several accounts, an option the operator <a href="https://t.me/radix_dlt/1005185" target="_blank" rel="noopener">added</a> the same evening. The ${int('/developers/transactions/01-manifest-language', 'transaction manifest')} the site builds calls the component's vote method once per selected account and then calls <code>deposit_batch</code> on each of those accounts. The second call is what makes the wallet ask every account to sign: the component checks each account's owner rule, and the wallet signs only for accounts whose owner-protected methods the manifest calls (${ext(`${SRC}/lib/voteManifest.ts`, 'voteManifest.ts')}).</p>
<p>Each vote also has a Comparison tab that recounts the same ballots under other rules. Radix governance counts each XRD of voting power as one vote; the tab keeps every voter's choice and balance and changes only how much the vote weighs. It applies 23 rules in four groups: by holdings (capped, square root, logarithmic, tiered), by address (one vote per account, with minimum-balance and anti-sybil variants), by account age, and hybrids such as a double majority of XRD and headcount. For each rule it shows the result and how concentrated the voting power is (${ext(`${SRC}/lib/votingMethods.ts`, 'votingMethods.ts')}). How the Radix DAO itself decides is set out on ${int('/contents/tech/core-concepts/radix-governance', 'Radix Governance')}.</p>
<p>The whole portal, governance section included, is public on GitHub as ${ext(REPO, 'genkipool/Radix_Community')}, licensed AGPL-3.0.</p>`;

const INFOBOX_FROM = '<td>Validator + Community Platform + SDK</td>';
const INFOBOX_TO = '<td>Validator + Community Platform + Governance front end + SDK</td>';
const LINK_ANCHOR = '<li><a href="https://github.com/genkipool/radixdlt-rust-sdk" target="_blank" rel="noopener">radixdlt-rust-sdk – GitHub</a></li>';
const LINK_NEW = `<li>${ext(REPO, 'Radix_Community (portal source) – GitHub')}</li>\n${LINK_ANCHOR}`;

const MESSAGE =
  'New section, Governance front end: radix-community.genkipool.com/en/governance (announced t.me/radix_dlt/1005180, 26 Sep 2026) ' +
  'lists and casts votes for the Radix DAO and Radix Consultation components; read 27 Sep, 13 votes, 2 open. Multi-account voting ' +
  'in one transaction (t.me/radix_dlt/1005185) explained from voteManifest.ts; the Comparison tab recounts ballots under 23 weighting ' +
  'rules (votingMethods.ts). Portal source linked: github.com/genkipool/Radix_Community, AGPL-3.0. Infobox Type row updated. wiki-sweep run 494.';

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) {
    console.log('  already applied - no write');
    return;
  }
  const blocks = JSON.parse(JSON.stringify(page.content));

  const info = blocks[0]?.blocks?.[0];
  if (!info?.text?.includes(INFOBOX_FROM)) throw new Error('infobox Type row not found');
  info.text = info.text.replace(INFOBOX_FROM, INFOBOX_TO);

  const linksIdx = blocks.findIndex((b) => b.text?.startsWith('<h2>External Links</h2>'));
  if (linksIdx < 0) throw new Error('External Links block not found');
  const links = blocks[linksIdx];
  if (!links.text.includes(LINK_ANCHOR)) throw new Error('rust-sdk link anchor not found');
  links.text = links.text.replace(LINK_ANCHOR, LINK_NEW);

  blocks.splice(linksIdx, 0, { id: uid(), type: 'content', text: SECTION });
  assertLinkShapes(blocks, page.title);

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (${blocks.length} blocks)`);
  if (DRY) return;
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
    [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now]);
  await client.query('COMMIT');
});
