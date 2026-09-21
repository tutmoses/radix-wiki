import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Every page whose rendered <title> ran past the point a SERP shows it.
//
// The document title is `page.title + " | RADIX Wiki"`, so a title has about 47
// characters before Google truncates. Two families blow that budget on a prefix
// before the topic arrives: the ideas board spends 10-16 characters on a working
// group ("Governance WG · ") and the weeklies 22 on the series name. Both prefixes
// earn their space in the H1 and the listing card, where the reader is scanning a
// set - so the page keeps its own title everywhere, and `metadata.seoTitle` is the
// short form used for the tab and the SERP only. Social cards keep the full title.
//
// `guard` is a distinctive ASCII fragment of the stored title, matched before the
// write: a retitled page must fail here rather than quietly keep a stale short form.
// (Stored titles carry curly apostrophes and en dashes, so the guard avoids both.)

const DRY = process.argv.includes('--dry-run');
const SUFFIX = ' | RADIX Wiki';

const EDITS = [
  // ---- Ideas board: drop the working-group prefix, compress the rest ----
  ['ideas', 'dao-subsidy-admin-entity', 'subsidy-administration entity', 'Subsidy-administration entity & reporting'],
  ['ideas', 'dao-proposal-voting-framework', 'Proposal & Voting Framework', 'Proposal & Voting Framework (RFC to TC to RFP)'],
  ['ideas', 'dao-marketing-merch-revenue', 'merch revenue-gap', 'Marketing narrative & the merch revenue gap'],
  ['ideas', 'dao-coi-code-of-conduct', 'Conflict-of-Interest Policy', 'Conflict-of-Interest Policy & Code of Conduct'],
  ['ideas', 'dao-migrate-dev-docs-wiki', 'developer documentation to radix.wiki', 'Migrate Radix developer docs to radix.wiki'],
  ['ideas', 'dao-operating-budgets', 'operating budgets for core functions', 'Operating budgets for core DAO functions'],
  ['ideas', 'dao-treasury-multisig-signers', 'treasury multisig', 'Treasury multisig & Authorized Signers'],
  ['ideas', 'dao-xian-protocol-upgrade', 'protocol upgrade & Radix Engine', 'Fund & steward the Xi’an protocol upgrade'],
  ['ideas', 'dao-foundation-ip-asset-transfer', 'asset transfer from the Radix Foundation', 'IP & asset transfer from the Foundation'],
  ['ideas', 'dao-validator-subsidy-future', 'validator subsidy future', 'Validator subsidy future & pseudo-jailing'],
  ['ideas', 'dao-working-group-framework', 'Working Group Framework', 'Working Group Framework & WG Charters'],
  ['ideas', 'dao-governance-app-consultation-v2', 'governance app (Consultation v2)', 'On-chain governance app (Consultation v2)'],
  ['ideas', 'dao-market-making-listings', 'market-making & exchange-listing', 'Market-making & exchange-listing deals'],
  ['ideas', 'dao-legal-wrapper-representation', 'Legal Wrapper & Representation', 'Legal Wrapper & Representation document'],
  ['ideas', 'dao-protocol-dry-run-snap', 'Dry-Run Protocol Upgrade', 'Dry-Run Protocol Upgrade & MetaMask Snap'],
  ['ideas', 'dao-steward-radix-wallet', 'stewardship of the Radix Wallet', 'Stewardship of the Radix Wallet & core stack'],
  ['ideas', 'dao-incorporate-duna-llc', 'Marshall Islands DAO LLC', 'Incorporate the Marshall Islands DAO LLC'],

  // ---- Weeklies: keep the series name, compress the hook to its subject ----
  ['blog', 'week-in-review-2026-07-12', 'Closes On Its First Milestone', 'Radix Week in Review: hyperscale-rs Milestone 1'],
  ['blog', 'week-in-review-2026-07-26', 'Answers the Sharding Questions', 'Radix Week in Review: Hyperscale and Sharding'],
  ['blog', 'week-in-review-2026-08-02', 'Its Own Virtual Machine', 'Radix Week in Review: Hyperscale Gets a VM'],
  ['blog', 'week-in-review-2026-08-09', 'the New Engine Goes Public', 'Radix Week in Review: Milestone 1 Is Done'],
  ['blog', 'week-in-review-2026-08-16', 'Post-Quantum Signature', 'Radix Week in Review: A Post-Quantum Signature'],
  ['blog', 'week-in-review-2026-08-23', 'Its Contracts Stay Live', 'Radix Week in Review: CaviarNine Leaves'],
  ['blog', 'week-in-review-2026-08-30', 'Fifteen Months in Two Hours', 'Radix Week in Review: A Test Network Replay'],
  ['blog', 'week-in-review-2026-09-13', 'Exchanges Stay Shut', 'Radix Week in Review: Mainnet Restarts'],
  ['blog', 'week-in-review-2026-09-20', 'One Exchange Back', 'Radix Week in Review: The Incident Report'],
  ['blog', 'building-radixs-developer-pipeline-nine-events-and-counting', 'Nine Events and Counting', 'Developer Pipeline: Nine Events and Counting'],
];

const MESSAGE = 'Set metadata.seoTitle, the short form used for the document <title> and the search result. The page title is unchanged and still heads the article, the listing card and the social card; only the tab and the SERP take the shorter one. Every title here rendered past 70 characters once the " | RADIX Wiki" template was applied, spending its first 10-22 characters on a working-group or series prefix before reaching the topic.';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

let written = 0, skipped = 0;
try {
  for (const [tagPath, slug, guard, seoTitle] of EDITS) {
    if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
    if (!rows.length) throw new Error(`page not found: ${tagPath}/${slug}`);
    const page = rows[0];
    const metadata = page.metadata || {};

    if (!page.title.includes(guard)) throw new Error(`${slug}: guard "${guard}" not in stored title "${page.title}"`);
    if (seoTitle.length + SUFFIX.length > 60) throw new Error(`${slug}: short form is still ${seoTitle.length + SUFFIX.length} chars`);

    if (metadata.seoTitle === seoTitle) { skipped++; continue; }

    const next = { ...metadata, seoTitle };
    const [maj, min, pat] = String(page.version).split('.').map(Number);
    const version = `${maj}.${min}.${pat + 1}`;
    console.log(`  ${DRY ? '[dry] ' : ''}${String(page.title.length + SUFFIX.length).padStart(3)} -> ${String(seoTitle.length + SUFFIX.length).padStart(3)}  /${tagPath}/${slug}  v${page.version} -> v${version}`);
    console.log(`          "${seoTitle}${SUFFIX}"`);

    if (!DRY) {
      const now = new Date().toISOString();
      await client.query('BEGIN');
      await client.query('UPDATE pages SET metadata=$1, version=$2, updated_at=$3 WHERE id=$4',
        [JSON.stringify(next), version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         SELECT $1, id, content, $2, $3, $4, $5, $6, $7 FROM pages WHERE id = $8`,
        [cuid(), page.title, version, 'patch', AUTHOR_ID, MESSAGE, now, page.id]);
      await client.query('COMMIT');
    }
    written++;
  }
  console.log(`\n  ${DRY ? 'would write' : 'written'}: ${written}   already applied: ${skipped}`);
} finally {
  client.release();
  await pool.end();
}
