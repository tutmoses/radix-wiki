// Run 376 — the ideas rotation. The DUNA formation card is the board's card for the
// MIDAO filing and was still carrying the 13 August state, "no date is fixed", six days
// after the council fixed one. Records RAC 988 (Tadkis, 5 Sep 2026 13:17:43 UTC) and
// closes the deliverables it settles.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ideas';
const SLUG = 'dao-incorporate-duna-llc';
const SENTINEL = 'signed-paid-filed-from-monday';

const NEW_SECTION = `<h3 id="${SENTINEL}">5 September 2026: signed, paid, and filed from Monday</h3>
<p>The date the August update declined to give now exists. At <strong>13:17:43&nbsp;UTC on 5 September 2026</strong> the RAC member Tadkis <a href="https://t.me/RadixAccountabilityCouncil/988" target="_blank" rel="noopener">told the council&rsquo;s channel</a> that <q>the agreement with MIDAO has been signed and the registration fee has been paid</q>, and that the formal registration process is scheduled to begin on <strong>Monday 7 September 2026</strong>. That completes the sequence tranche two of the setup grant was released for &ndash; amend the Service Agreement, sign, pay, file &ndash; and it starts the registry clock. The four to six weeks <a href="/ecosystem/radix-accountability-council" rel="noopener">the council</a> put on the Marshall Islands registry to grant and issue the Certificate of Formation runs from the filing rather than the signature, which places the certificate between mid-October and mid-November 2026 on the council&rsquo;s own figures.</p>
<p>Filing is not adoption, and the distinction matters more than usual this month. The Operating Agreement above still carries its pre-adoption header and still needs the Governance Process proposal at &ge;60% approval and &ge;7% quorum &ndash; a vote that requires a ledger, and <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Radix mainnet has committed no round since 31 August</a>. Incorporation is the one leg of the transition that runs through a registry in Majuro rather than through the network, which is why it is the leg still moving.</p>`;

const DELIVERABLES = `<h2>Deliverables</h2><ul><li><strong>Drafted, not adopted</strong> &ndash; Articles of Organization and Operating Agreement bound to the Charter; bringing the OA into force needs the &ge;60%/&ge;7% Governance Process vote.</li><li><strong>Done</strong> &ndash; formation provider and registered agent selected: <a href="https://midao.org" target="_blank" rel="noopener">MIDAO Directory Services, Inc.</a> of Majuro, agreement signed and registration fee paid 5 September 2026.</li><li><strong>Done</strong> &ndash; membership defined in the Operating Agreement &sect;4.1: open to any holder of governance tokens, beginning on acquisition, governance rights only.</li><li><strong>From 7 September 2026</strong> &ndash; file incorporation, record the entity in the framework <code>Legal/</code> folder, and lodge the package, component, owner-badge and multisig addresses with the registered agent (&sect;1.4).</li></ul>`;

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
    console.log('  already applied — no write');
    process.exit(0);
  }

  const body = blocks.find((b) => (b.text || '').includes('<h2>Deliverables</h2>'));
  if (!body) throw new Error('body block not found');

  const edits = [
    ['Formation documents are being drafted.',
     'The formation documents are drafted, the agreement with the registered agent is signed and paid, and the registry filing begins on 7 September 2026.'],
    ['<h2>Deliverables</h2><ul><li>Finalize Articles of Organization + Operating Agreement bound to the ratified Charter.</li><li>Select a formation provider / registered agent in the Marshall Islands.</li><li>Confirm membership definition (validator-staked LSU / owner-stake LSU holders, minus community-excluded members).</li><li>File incorporation and record the entity in the framework Legal/ folder.</li></ul>',
     NEW_SECTION + DELIVERABLES],
  ];
  for (const [from, to] of edits) {
    if (!body.text.includes(from)) throw new Error(`find-string missed: ${from.slice(0, 70)}`);
    body.text = body.text.replace(from, to);
  }

  const version = '1.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${edits.length} replacements)`);
  if (DRY) process.exit(0);

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
     "Record the MIDAO filing date the card was still declining to give. RAC 988 (Tadkis, 5 Sep 2026 13:17:43 UTC): the agreement is signed, the registration fee paid, and formal registration begins Monday 7 September 2026 — which starts the council's four-to-six-week registry clock and places the Certificate of Formation between mid-October and mid-November. Deliverables re-stated with their real status, and the distinction between filing and adoption made explicit: the Operating Agreement still needs the 60%/7% vote that the halted ledger cannot hold.",
     now]);
  await client.query('COMMIT');
  console.log('  written');
} finally {
  client.release();
  await pool.end();
}
