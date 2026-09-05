import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

// Run 371, step-1 signal. The council's formation step closed on 5 September:
// MIDAO service agreement signed, registration fee paid, filing from Monday 7 Sep.
// The page's own record stopped at the 29 August intention to submit "from Monday
// onwards" (31 August), which is now six days out of date.

const TAG_PATH = 'ecosystem';
const SLUG = 'radix-accountability-council';
const SENTINEL = 'signed-paid-and-filed-from-monday';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2 id="${SENTINEL}">5 September 2026: signed, paid, and filed from Monday</h2>
<p>Six days after the submission was due to <q>roll out from Monday onwards</q>, the council reported it done. At <strong>13:17:43&nbsp;UTC on 5 September 2026</strong> the RAC member Tadkis <a href="https://t.me/RadixAccountabilityCouncil/988" target="_blank" rel="noopener">posted to the council&rsquo;s channel</a> that <q>the agreement with MIDAO has been signed and the registration fee has been paid</q>, and that the formal registration process is scheduled to begin on <strong>Monday 7 September 2026</strong>. An hour and six minutes later projectShift <a href="https://t.me/radix_dlt/1002055" target="_blank" rel="noopener">relayed it to the main Radix group</a> as <q>Step one of the DAO is actually done now</q>.</p>
<p>That completes the sequence tranche two of the setup grant was released for: amend MIDAO&rsquo;s Service Agreement, sign it, pay, and file. The <strong>four to six weeks</strong> the council put on the Marshall Islands registry to grant and issue the Certificate of Formation runs from the filing rather than from the signature, so on the council&rsquo;s own figures the certificate falls between mid-October and mid-November 2026. Nothing in the announcement changes the entity, the registered agent, or the documents: the wrapper is still a non-profit DAO LLC with <a href="https://midao.org" target="_blank" rel="noopener">MIDAO Directory Services</a> of Majuro as registered agent, and the formation documents remain the drafts tracked at <a href="/ideas/dao-incorporate-duna-llc" rel="noopener">Incorporate the Marshall Islands DAO LLC</a>.</p>
<p>The step is also the only part of the transition that has moved since <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Radix mainnet halted</a> on 31 August. Ratification of the Governance Framework is Activation Condition 6 of the Operating Agreement and needs a vote a stopped ledger cannot hold, so the council removed the seven-day limit on the Discussion phase and left it open-ended; the <a href="/ideas/dao-elect-permanent-rac" rel="noopener">Permanent RAC election</a> sits behind that. Incorporation runs through a registry that does not depend on the network, which is why it is the leg still advancing.</p>`;

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
    console.log('  already applied - no write');
    process.exit(0);
  }

  // 1. infobox: the DAO Entity row still reads as a pending 31 August submission.
  const inner = blocks[0].blocks[0];
  const before = inner.text;
  inner.text = inner.text.replace(
    /submission from 31 Aug 2026/,
    'agreement signed and fee paid 5 Sep 2026, registry filing from 7 Sep 2026');
  if (inner.text === before) throw new Error('infobox DAO Entity row did not match');

  // 2. new dated section immediately before External Links.
  const at = blocks.findIndex((b) => (b.text || '').includes('<h2>External Links</h2>'));
  if (at < 0) throw new Error('External Links block not found');
  blocks.splice(at, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '2.7.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${page.content.length} -> ${blocks.length} blocks)`);
  console.log(`  infobox row now: ${inner.text.match(/<tr><td>DAO Entity<\/td><td>[^<]*/)[0]}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'MIDAO Service Agreement signed and registration fee paid; formal filing begins Monday 7 September 2026, six days after the 29 August plan to submit "from Monday onwards" (t.me/RadixAccountabilityCouncil/988, 13:17:43 UTC; relayed t.me/radix_dlt/1002055). Infobox DAO Entity row corrected off the pending 31 August submission.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
