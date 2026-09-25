// sweep 487: the Radix DAO Charter card – GP-PRE-1 moved from Temperature Check to Governance
// Proposal on 25 September 2026. The Transition RAC recorded tc/0 as passed at 15:18:26 UTC and
// opened proposal 0 at 15:18:51 UTC (seven days, closes 15:18:51 UTC on 2 October). Adds a dated
// section after "The Temperature Check closes" and rewrites the infobox Vote status row.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ideas';
const SLUG = 'radix-network-dao-charter';
const SENTINEL = 'id="the-governance-proposal-opens"';

const TX_OUTCOME = 'txid_rdx1e555wz0m9tvhg4lw8jucjeq75nz3cmha9l3890z82vujm8gqlgsq4vfv85';
const TX_PROPOSAL = 'txid_rdx1g58gggr0ut592n6y6n4w5xptpj72wl9jvdd0y7xa7m36lkl44e4srxjem9';
const tx = (id, label) => `<a href="https://dashboard.radixdlt.com/transaction/${id}" target="_blank" rel="noopener">${label}</a>`;

const SECTION = `<h2 ${SENTINEL}>The Governance Proposal opens (25 September 2026)</h2><p>The Transition RAC recorded the Temperature Check as passed at 15:18 UTC on 25 September and opened the Governance Proposal 25 seconds later, in two transactions from the same account on the Consultation V3 component (${tx(TX_OUTCOME, 'outcome')}, ${tx(TX_PROPOSAL, 'proposal')}). The council <a href="https://t.me/RadixAccountabilityCouncil/1084" target="_blank" rel="noopener">announced the ballot</a> at 15:24 UTC as <a href="https://vote.radixdao.org/proposal/0" target="_blank" rel="noopener">vote.radixdao.org/proposal/0</a>. It runs seven days and closes at 15:18 UTC on 2 October 2026.</p><p>This is the vote that ratifies the framework. It needs 1,351m XRD of voting power for quorum and 66% of decisive votes in favour; an abstention counts towards quorum and nothing else. The Temperature Check drew 875m, so reaching quorum takes about 476m more voting power than turned out for the check. The proposal text stored on the ledger is 8,896 bytes and byte-identical to <a href="https://github.com/RadixDAO/governance-framework/blob/main/pending/GP-PRE-1-Framework-Ratification.md" target="_blank" rel="noopener"><code>pending/GP-PRE-1-Framework-Ratification.md</code></a> as it stands after the repository's last change to it on 20 September. By 23:05 UTC on 25 September, 77 accounts had voted. The component stores each ballot but not its weight, so the running tally of voting power is on the ballot page.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }

  const infobox = blocks.find((b) => b.type === 'infobox').blocks[0];
  const from = '. The Governance Proposal had not opened by 15:05 UTC</td>';
  if (!infobox.text.includes(from)) throw new Error('infobox anchor not found');
  infobox.text = infobox.text.replace(from,
    '. Governance Proposal open at <a href="https://vote.radixdao.org/proposal/0" target="_blank" rel="noopener">proposal/0</a> until 15:18 UTC 2 Oct 2026</td>');

  const i = blocks.findIndex((b) => b.text?.includes('id="the-temperature-check-closes"'));
  if (i < 0) throw new Error('closes section not found');
  blocks.splice(i + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '2.8.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'GP-PRE-1 promoted: Temperature Check recorded as passed and Governance Proposal 0 opened on the Consultation V3 component at 15:18 UTC 25 Sep (both transactions linked), closing 15:18 UTC 2 Oct; RAC announcement t.me/RadixAccountabilityCouncil/1084. On-ledger proposal text checked byte-identical to the repository file. Infobox Vote status updated.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
