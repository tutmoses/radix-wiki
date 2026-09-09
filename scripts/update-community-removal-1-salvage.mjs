// Folds the facts that only existed on a Community profile onto the topic pages
// that deferred to them, so removing the section loses no sourced material.
//
//   radix-governance  <- the quorum recomputation ("set out on Daffy's page")
//   stokenet          <- who pays for the network, and who can move its protocol
//
// Run with --dry-run first.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

/** Read → guard → mutate → transact, once per page. */
async function edit({ tagPath, slug, version, changeType, message, sentinel, apply }) {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
  if (!rows.length) throw new Error(`page not found: ${tagPath}/${slug}`);
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(sentinel)) {
    console.log(`  ${tagPath}/${slug}: already applied — no write`);
    return;
  }
  apply(blocks);
  if (!JSON.stringify(blocks).includes(sentinel)) throw new Error(`${tagPath}/${slug}: edit did not take`);

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (DRY) return;
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, changeType, AUTHOR_ID, message, now]);
  await client.query('COMMIT');
}

/** Replace exactly one occurrence, and fail loudly when the find-string has drifted. */
function replaceOnce(block, find, repl) {
  const n = block.text.split(find).length - 1;
  if (n !== 1) throw new Error(`expected 1 match, found ${n}: ${find.slice(0, 90)}…`);
  block.text = block.text.replace(find, repl);
}

const at = (blocks, id) => {
  const b = blocks.find((x) => x.id.startsWith(id));
  if (!b) throw new Error(`block ${id} not found`);
  return b;
};

try {
  // ── 1. Radix Governance: inline the recomputation the page pointed off-site for.
  await edit({
    tagPath: 'contents/tech/core-concepts',
    slug: 'radix-governance',
    version: '1.10.0',
    changeType: 'minor',
    message: 'Inline the quorum recomputation this section deferred to a contributor profile for, so the arithmetic and the liquid-only error live with the votes they describe.',
    sentinel: '785,092,070 is held as stake units',
    apply: (blocks) => {
      replaceOnce(at(blocks, '8a985abf'),
        `The weight behind the voting accounts clears the 671,470,000 XRD quorum written into each by roughly 40%; the arithmetic, and the reason a liquid-only count gets it wrong, is set out on <a href="/community/daffy" rel="noopener">Daffy's page</a>.</p>`,
        `The weight behind the voting accounts clears the 671,470,000 XRD quorum written into each by roughly 40%: 910,989,217 XRD stands behind the Stokenet proposal and 910,406,795 XRD behind the website proposal, about 136% of the figure written into each.</p>\n` +
        `<p>Almost none of that weight is liquid, and a tally that misses this misses the result. Only 125,897,148 XRD of the Stokenet total sits in an account as XRD. The other 785,092,070 is held as stake units, and has to be converted back at each validator&rsquo;s current exchange rate before it counts as voting power. Reading liquid balances alone understates these accounts more than sevenfold &ndash; enough to turn a vote that cleared its quorum into one that appears to have missed it by a wide margin. This wiki published that error and corrected it; the case is kept as a worked example under <a href="/policy/no-original-research" rel="noopener">No original research</a>. The May 2026 <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi&rsquo;an</a> kickoff vote clears its own bar the same way: 1,186,155,329 XRD against a 940,046,370 quorum, from 254 accounts casting 256 votes, 255 approve to one reject. These are balances read on 9 August 2026 rather than the snapshot the dApp weighted at voting time, so the figures are indicative; the margins are wide enough that the direction is not in doubt. Clearing a quorum does not by itself release money &ndash; the Xi&rsquo;an milestone was paid by the Foundation directly, on the strength of clear community consensus rather than on the tally.</p>`);
    },
  });

  // ── 2. Stokenet: what the network costs, and who can move its protocol version.
  await edit({
    tagPath: 'contents/tech/releases',
    slug: 'stokenet',
    version: '1.11.0',
    changeType: 'minor',
    message: 'Record the funding proposal that pays for community-run Stokenet and the validator-badge concentration that lets one operator enact a protocol update on it. Both were held on a contributor profile that deferred them here.',
    sentinel: 'holds 100% of the Stokenet validator badges',
    apply: (blocks) => {
      // Who pays: the proposal sits before the reset it made possible.
      replaceOnce(at(blocks, '75a8a169'),
        `<h2>Full reset &ndash; 29 August 2026</h2>`,
        `<h2>Who runs it, and who pays</h2>\n` +
        `<p>Stokenet has been community-run since the <a href="/ecosystem/radix-foundation" rel="noopener">Radix Foundation</a> handed the validators, the stake and the Gateway over during 2026. For several months afterwards it ran on one operator&rsquo;s own account, uncompensated, while the entity meant to contract for it was still being formed &ndash; which is why the arrangement was put to a vote rather than left as a favour.</p>\n` +
        `<p>The proposal that went on-ledger in July 2026 asks the Foundation for a fixed <strong>$4,000 in XRD</strong> covering May to December 2026: one Gateway, two supporting full nodes, three validators, redundant ledger and database backups and a monitoring node, all hosted in the EU/EEA, run on a best-effort basis at a stated 98&ndash;99.5% uptime with monthly reporting. The XRD would be staked rather than sold, the operator wrote, since selling was never the point &ndash; &ldquo;had my intention been to sell, I would have requested stablecoins&rdquo;. It is a revision of a 28 March 2026 proposal, repriced downward after two months of actually operating the network removed the unknowns. Without it, the proposal said, the Stokenet Gateway would be decommissioned in mid-August to limit further losses, leaving developers to stand up their own at an estimated $350&ndash;400 per month each.</p>\n` +
        `<p>That deadline passed with the Gateway still answering, and it is still answering now. The vote closed on 4 August 2026 with 55 ballots and not one against, clearing its quorum comfortably; no funding decision has appeared in the <a href="/ecosystem/radix-accountability-council" rel="noopener">Radix Accountability Council</a>&rsquo;s public updates since. The tally and the arithmetic behind it are on <a href="/contents/tech/core-concepts/radix-governance" rel="noopener">Radix Governance</a>. A test network paid for this way is a test network that stops when one person stops, which is the standing condition the sections below are written under.</p>\n` +
        `<h2>Full reset &ndash; 29 August 2026</h2>`);

      // Who can move it: the badge concentration behind the same evening's re-enactments.
      replaceOnce(at(blocks, '75a8a169'),
        `So the reset network is now at the same protocol version as <a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">mainnet</a>, reached in one evening from Babylon genesis rather than over the two and a half years mainnet took.</p>`,
        `So the reset network is now at the same protocol version as <a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">mainnet</a>, reached in one evening from Babylon genesis rather than over the two and a half years mainnet took.</p>\n` +
        `<h4>Why one evening was enough</h4>\n` +
        `<p>Mainnet takes years over a protocol update because enactment requires validators holding <strong>80% of stake</strong> to signal readiness, and that threshold has to be assembled from independent operators. On the reset network it does not have to be assembled at all. Asked in the developer channel on 29 August whether his own validators had to vote for the new versions, the operator answered that <a href="https://t.me/RadixDevelopers/66105" target="_blank" rel="noopener">the last badge was never sent</a>: he holds 100% of the Stokenet validator badges against an 80% requirement, and was &ldquo;pushing it through, with or without your approval&rdquo;. Three readiness transactions in an evening is what a unanimous validator set looks like.</p>\n` +
        `<p>The one line he did not cross he drew himself. He stopped at Cuttlefish part&nbsp;1 on the ground that part&nbsp;2 needs more information and &ldquo;is not really me to decide&rdquo; &ndash; a limit of judgement rather than of authority, which is the distinction worth recording. The same concentration that makes the test network quick to upgrade makes it a network whose protocol version one person sets. On <a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">mainnet</a> the same signalling mechanism answers to a stake distribution no single operator holds.</p>`);
    },
  });
  console.log(DRY ? '\ndry run complete — nothing written' : '\nsalvage applied');
} finally {
  client.release();
  await pool.end();
}
