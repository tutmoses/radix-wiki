// scripts/sweep-378-oter-mirror-tally.mjs
//
// The OTER page carried an 8 August design disclosure for a governance platform
// and, right underneath it, Daffy's objection that the settlement layer would put
// treasury outflows outside the DAO's signer structure. On 6 September 2026 the
// project published the answer: it cut the drop-in replacement on 28 August and
// now counts the official vote's ballots rather than holding its own. That is the
// disposition of the objection the Reception section leaves open, so it goes in
// after it.
//
// One claim in the post is verifiable on-ledger and was verified rather than
// attributed: the mainnet component the poller reads is a pinned read away, and
// /state/entity/details at state version 557,840,622 returns it as "Radix
// Consultation V2", blueprint Governance, described as the component that manages
// voting for Consultation V2. Everything else is the project's own account of a
// deployment nobody else can reach, and is written as such.
//
//   node scripts/sweep-378-oter-mirror-tally.mjs --dry-run
//   node scripts/sweep-378-oter-mirror-tally.mjs
//
// Idempotent: exits clean if the new section's sentinel is already present.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, assertLinkShapes } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'oter';
const VERSION = '2.4.0';
const SENTINEL = 'complement-not-substitute';
const DRY = process.argv.includes('--dry-run');

const POST = 'https://blog.oter.io/posts/complement-not-substitute';

const NEW_SECTION = `<h2 id="mirror-tally">Complement, not substitute</h2>
<p>OTER cut the replacement. On 28 August 2026 the project stopped building a drop-in alternative to the DAO's own voting app, and on 6 September it published <a href="${POST}" target="_blank" rel="noopener">the reasoning and a worked example</a>: <em>&ldquo;a vote that self-executes a payout is the thing the Treasury Signers design exists to prevent.&rdquo;</em> That is the disposition of the objection recorded above. Votes stay on the <a href="https://vote.radixdao.org" target="_blank" rel="noopener">Consultation App</a>, money still moves through the five <a href="/ideas/dao-governance-app-consultation-v2" rel="noopener">Treasury Signers</a> under caps and a compliance window, and the project states plainly that no OTER vote moves Radix DAO money or stands in for a Radix DAO decision.</p>
<p>What is left is a <strong>mirror tally</strong>: OTER's own count of an official vote's ballots, read from the governance component and its on-ledger voter lists through the public <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway</a>, published as a hash-pinned document. It counts twice. The first leg reproduces the app's own stated weight rule &ndash; the one <a href="/ideas/dao-proposal-voting-framework" rel="noopener">adopted by consultation in February 2026</a>: XRD held directly, validator stake units and LSULP at the XRD behind them, and a static allowlist of 68 liquidity positions on <a href="/ecosystem/ociswap" rel="noopener">Ociswap</a>, <a href="/ecosystem/caviarnine" rel="noopener">CaviarNine</a> and <a href="/ecosystem/defiplaza" rel="noopener">DefiPlaza</a>, of which only the XRD side counts &ndash; from a copy of the list identified by a version and a hash of its bytes. The second applies the same four weight families under an on-ledger register that moves by a Binding XRD vote rather than an operator edit. The project reports both sets identical today, entry for entry, so on mainnet the two legs reach the same number and the second adds no weight to anyone; agreement on the first leg is the point, since reproducing the official number is what shows OTER read the same ballots.</p>
<p>The mainnet poller's target is the one part of this a reader can check without the project's cooperation, and it checks out. The component the post names, <code>component_rdx1czn9hrgd30x742k6jw2e6psj9jlkqvu2cj4hcry60p7f38hxd3k3xt</code>, returns from a <a href="/contents/tech/core-protocols/radix-gateway-api#pinned-reads" rel="noopener">pinned Gateway read</a> at state version 557,840,622 as <strong>Radix Consultation V2</strong>, a component of the <code>Governance</code> blueprint whose own on-ledger description reads &ldquo;Component that manages voting for Consultation V2&rdquo;. OTER says it read ten vote entries there on 28 August 2026 &ndash; seven Temperature Checks and three Governance Proposals.</p>
<p>The worked example is not one of them. <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> has carried no Radix DAO vote since its 29 August 2026 reset and mainnet has been <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted since 31 August</a>, so the three ballots the post counts end to end come from a test vote OTER created on its own private Stokenet deployment. Both rules there return 13,728.99 Against and 9,286.73 For &ndash; 23,015.72 in total, every source differing by zero, rejected at 40.3% against a 50% bar &ndash; in a document naming the state versions it weighed balances at and read ballots at, and hashing to <code>a84efb5c&hellip;</code>. The <a href="https://github.com/OTER-Labs/radix-tally-verify" target="_blank" rel="noopener">independent verifier</a>, pushed the same day, re-reads the ballots and checks both legs against that hash.</p>
<p>Bonding a tally stays optional and is off by default for Temperature Checks; a bonded one carries a floor of 10 units of its bond asset and a challenge window that can be lengthened but never shortened, and a governance request buys itself a window at least as long as the framework's 48-hour pre-execution hold. The post is unusually direct about the limit of that: a bond bounds the cost of lying, not the value of the question, and <em>&ldquo;a question worth more to an attacker than the total honest stake that turns out to defend it is outside what this mechanism protects&rdquo;</em> &ndash; bond sizing can be revisited, the boundary cannot. The same machinery is offered to any project rather than only to the DAO: a space picks its weight rule once and immutably &ndash; XRD, its own fungible, or a membership NFT for an electorate with no token &ndash; and each winner of a settled election claims a soulbound seat NFT that expires with the term and can be recalled by the same electorate.</p>`;

const OLD_STATUS_TAIL =
  'On 8 August 2026 the project announced <a href="https://blog.oter.io/posts/xrd-governance-design-disclosure" target="_blank" rel="noopener">OTER XRD Governance</a>, a Radix DAO voting platform built on the oracle, with the platform, its independent verifier and a full technical disclosure said to be releasing within the week.';
const NEW_STATUS_TAIL =
  'On 8 August 2026 the project announced <a href="https://blog.oter.io/posts/xrd-governance-design-disclosure" target="_blank" rel="noopener">OTER XRD Governance</a>, a Radix DAO voting platform built on the oracle, with the platform, its independent verifier and a full technical disclosure said to be releasing within the week. '
  + `That platform was <a href="${POST}" target="_blank" rel="noopener">recast on 28 August 2026</a> as a second count of the official DAO vote rather than a replacement for it. `
  + 'As of 6 September 2026 the whole of it runs on one private Stokenet deployment and none of it is on mainnet; the project states that a public Stokenet deployment follows the '
  + '<a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halt</a> fix, and a mainnet deploy after that.';

const OLD_INFOBOX_ROW =
  '<tr><th>Governance platform</th><td><a href="https://blog.oter.io/posts/xrd-governance-design-disclosure" target="_blank" rel="noopener">OTER XRD Governance</a> &ndash; announced 8 Aug 2026, unreleased</td></tr>';
const NEW_INFOBOX_ROW =
  '<tr><th>Governance platform</th><td><a href="https://blog.oter.io/posts/xrd-governance-design-disclosure" target="_blank" rel="noopener">OTER XRD Governance</a> &ndash; announced 8 Aug 2026, recast 28 Aug as a mirror tally, unreleased</td></tr>'
  + `\n<tr><th>Radix DAO posture</th><td>Second, independent count of the <a href="https://vote.radixdao.org" target="_blank" rel="noopener">official vote</a> &ndash; no OTER vote moves DAO money</td></tr>`;

const OLD_LINK_ITEM =
  '<li><a href="https://blog.oter.io/posts/xrd-governance-design-disclosure" target="_blank" rel="noopener">OTER XRD Governance &ndash; design disclosure (8 Aug 2026)</a></li>';
const NEW_LINK_ITEM = OLD_LINK_ITEM
  + `\n<li><a href="${POST}" target="_blank" rel="noopener">Complement, not substitute &ndash; the mirror tally and one vote counted end to end (6 Sep 2026)</a></li>`
  + '\n<li><a href="https://vote.radixdao.org" target="_blank" rel="noopener">vote.radixdao.org &ndash; the Radix DAO Consultation App the tally mirrors</a></li>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  const hasSentinel = (bs) => bs.some((b) => (b.text || '').includes(SENTINEL)
    || (b.blocks || []).some((n) => (n.text || '').includes(SENTINEL)));
  if (hasSentinel(blocks)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  // 1. infobox row
  const box = blocks.find((b) => b.type === 'infobox');
  const boxLeaf = box?.blocks?.find((n) => (n.text || '').includes(OLD_INFOBOX_ROW));
  if (!boxLeaf) throw new Error('infobox governance-platform row not found');
  boxLeaf.text = boxLeaf.text.replace(OLD_INFOBOX_ROW, NEW_INFOBOX_ROW);

  // 2. new section, immediately after Reception
  const receptionIdx = blocks.findIndex((b) => (b.text || '').includes('<h2 id="reception">'));
  if (receptionIdx < 0) throw new Error('reception block not found');
  blocks.splice(receptionIdx + 1, 0, { id: uid(), type: 'content', text: NEW_SECTION });

  // 3. status tail
  const status = blocks.find((b) => (b.text || '').includes(OLD_STATUS_TAIL));
  if (!status) throw new Error('status tail not found');
  status.text = status.text.replace(OLD_STATUS_TAIL, NEW_STATUS_TAIL);

  // 4. external links
  const links = blocks.find((b) => (b.text || '').includes(OLD_LINK_ITEM));
  if (!links) throw new Error('external-links item not found');
  links.text = links.text.replace(OLD_LINK_ITEM, NEW_LINK_ITEM);

  assertLinkShapes(blocks);

  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (+1 section, infobox +1 row, status, +2 links)`);
  if (DRY) {
    console.log(NEW_SECTION.slice(0, 400) + '\n  ...');
    process.exit(0);
  }

  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
      'Record the 28 August repositioning, disclosed 6 September: OTER cut the drop-in replacement for the '
      + 'Radix DAO Consultation App and now publishes a second, independent count of the official vote instead. '
      + 'This is the disposition of the objection the Reception section left open, so it follows it. The mainnet '
      + 'component the poller reads was verified by a pinned Gateway read at state version 557,840,622 rather '
      + 'than taken on the post’s word; the worked example is flagged as a test vote on a private Stokenet '
      + 'deployment, not a Radix DAO vote. Source: ' + POST, now]);
  await client.query('COMMIT');
  console.log('  written');
} catch (e) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('  FAILED:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
