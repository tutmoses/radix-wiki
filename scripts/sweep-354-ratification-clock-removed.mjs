import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ideas';
const SLUG = 'radix-network-dao-charter';
const SENTINEL = 'the-clock-is-removed';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2 id="${SENTINEL}">The clock is removed (2 September 2026)</h2>
<p>The Discussion phase opened with a deadline and, three days in, no longer has one. At <strong>13:49&nbsp;UTC on 2 September 2026</strong> the Transition RAC published <a href="https://t.me/RadixAccountabilityCouncil/958" target="_blank" rel="noopener">a status update</a>, signed as the earlier ones were by projectShift, saying that with <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">the network halted</a> there are no technical conditions to proceed to a Temperature Check or beyond, and that it had therefore decided to keep the Discussion phase open for as long as it is needed, <q>regardless of the initially set 7 days</q>. The seven-day window announced on 30 August would have closed on 6 September 2026. It has no closing date now.</p>
<p>The council put the same decision where it had asked readers to look. The anchor topic <a href="https://radixtalk.com/t/charter-policies-ratification-discussion/2330" target="_blank" rel="noopener">Charter &amp; Policies Ratification Discussion</a> carries the change in its own first post, which now reads that the phase stays open <q>regardless of the initially set period</q>. So the forum and the Telegram channel agree, and the RAC's argument for the extension is that scrutiny of the framework is the one useful thing left available while the ledger is stopped.</p>
<p>The DAO's own record still does not say it. Read at <strong>15:08&nbsp;UTC on 2 September</strong>, <a href="https://radixdao.org/notices.json" target="_blank" rel="noopener">the Official Venue's notices feed</a> holds the same two items it has held since 29 August, the certificate details and the minute of the 25 August meeting, and its <a href="https://radixdao.org/notices/type/process-notices/" target="_blank" rel="noopener">Process notices</a> category is still empty. Four days after <a href="#the-discussion-phase-30-august-2026">the phase opened</a> the venue the framework designates for official acts has recorded neither its opening nor its extension. That is the same gap this page recorded on 30 August, now larger.</p>
<h3 id="what-three-days-of-discussion-produced">What the first three days of discussion produced</h3>
<p>The extension is worth measuring against the participation it extends. Read at 15:10&nbsp;UTC on 2 September, three days after it opened, the anchor topic holds <strong>13 posts from four accounts</strong> and has been viewed 151 times. Eight of the thirteen were written by projectShift, the Transition RAC member who opened it: the council that authored the twenty-one documents has written more of the thread scrutinising them than everyone else combined. The other three participants are Magal36, with three posts, one of which withdraws its own point as out of scope, and skywave and dazligth with one each.</p>
<p>The substance of what was raised is narrow. Magal36 asked on 30 August for direct links to the signed PDFs and a way to verify a signature, and was told to use the repository rather than a list of individual links; skywave asked on 31 August how many people sit on the pre-DAO RAC, and was told five, of whom three are named on the ratification posts. The first submission that engages the text at length arrived on 2 September at 12:47&nbsp;UTC, from dazligth, and the RAC's reply an hour later says it will take time to address. <a href="https://github.com/RadixDAO/governance-framework/blob/main/pending/GP-PRE-1-Framework-Ratification.md" target="_blank" rel="noopener">GP-PRE-1</a> asks the community to verify twenty-one document hashes, compare each signed PDF against its markdown source, and challenge the sequencing. Three days in, none of that work is visible in the thread.</p>`;

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
  const flat = (b) => b.text || (b.blocks || []).map((x) => x.text || '').join('');
  if (blocks.some((b) => flat(b).includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  // 1. infobox vote-status row
  const ib = blocks.find((b) => b.type === 'infobox');
  if (!ib) throw new Error('no infobox block');
  const inner = ib.blocks[0];
  const before = inner.text;
  inner.text = inner.text.replace(
    /<td>Discussion phase open[^<]*<\/td>/,
    '<td>Discussion phase open since 30 Aug 2026, no closing date; ballot not yet opened</td>');
  if (inner.text === before) throw new Error('infobox vote-status row did not match');

  // 2. new dated section, after the narrative block that ends the 30 August account
  const anchor = blocks.findIndex((b) => (b.text || '').includes('the-discussion-phase-30-august-2026'));
  if (anchor < 0) throw new Error('narrative anchor not found');
  blocks.splice(anchor + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '2.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  infobox row: ${/no closing date/.test(inner.text) ? 'updated' : 'FAILED'}`);
  console.log(`  section inserted at block ${anchor + 1} of ${blocks.length}`);
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
       'The Discussion phase no longer closes on 6 September: the Transition RAC removed the seven-day limit at 13:49 UTC on 2 September (t.me/RadixAccountabilityCouncil/958, and the RadixTalk anchor topic), because the halted network cannot hold a vote. Infobox vote status corrected, and the first three days of the thread measured: 13 posts from four accounts, eight of them the RAC member who opened it.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
