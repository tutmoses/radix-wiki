/**
 * Sweep 335 (ideas rotation) — the ratification process opened.
 *
 * On 30 August 2026 at 17:30 UTC the Transition RAC announced that the
 * Ratification of the Governance Framework had started, with a seven-day
 * Discussion phase anchored at a new RadixTalk topic. The charter card was
 * written on 29 August and says "no date has been set for the vote itself".
 * That sentence is still true — the *vote* has not been called — but the phase
 * that precedes it has, and the card does not record it.
 *
 * Sources read for this edit:
 *   https://t.me/RadixAccountabilityCouncil/922        (announcement, 17:30:50Z)
 *   https://radixtalk.com/t/charter-policies-ratification-discussion/2330
 *   https://radixdao.org/notices.json                  (venue record, 2 items)
 *   https://api.github.com/repos/RadixDAO/governance-framework/commits
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ideas';
const SLUG = 'radix-network-dao-charter';
const SENTINEL = 'id="the-discussion-phase-30-august-2026"';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2 id="the-discussion-phase-30-august-2026">The Discussion phase opens (30 August 2026)</h2>
<p>The day after the framework was signed and staged, the process to adopt it started. The Transition RAC <a href="https://t.me/RadixAccountabilityCouncil/922" target="_blank" rel="noopener">announced at 17:30&nbsp;UTC on 30 August 2026</a> that ratification of the Governance Framework is under way and that <strong>the Discussion phase runs for seven days</strong> from that moment. It is anchored at a single RadixTalk topic, <a href="https://radixtalk.com/t/charter-policies-ratification-discussion/2330" target="_blank" rel="noopener">Charter &amp; Policies Ratification Discussion</a>, opened twenty minutes earlier at 17:10&nbsp;UTC and signed by the three named Transition RAC members, Tadkis, Mr. Peanutbutter and projectShift. The RAC asks that everything a reader thinks needs changing be raised <em>in that thread</em> — linking out is fine, but the objection has to be made where the record of the discussion is kept.</p>
<p>The vote itself has still not opened, and this is the distinction the card carried from 29 August: discussion is the first phase of the ratification process, not the ballot. What runs for seven days is scrutiny of the twenty-one documents; the binding <a href="https://github.com/RadixDAO/governance-framework/blob/main/pending/GP-PRE-1-Framework-Ratification.md" target="_blank" rel="noopener">GP-PRE-1</a> vote follows it, on the community's own <a href="https://vote.radixdao.org/" target="_blank" rel="noopener">Consultation V3</a> system, at thresholds unchanged from the ballot text — 66% YES of decisive votes, a 10% quorum, and a 3.5% affirmative floor.</p>
<h3 id="what-the-discussion-is-asked-to-check">What the discussion is asked to check</h3>
<p>The RAC's explanatory post is unusually specific about the work it wants done, and about its own standing: the post "is explanatory and has no legal force", and "where this post and the ballot text differ, the ballot text governs". Within that, it asks for four things — verify the SHA-256 of each signed PDF against the manifest and flag any mismatch, compare the <code>.md</code> sources in the repository against the signed PDFs, challenge the sequencing if ratifying before formation is the wrong call, and point at anything reading as authority the RAC should not have.</p>
<p>One consequence of that framing is easy to miss and changes what a reader should cite. <strong>What is ratified is the signed PDF, and only the PDF is hashed in the manifest.</strong> The markdown in the repository is the working source the PDF was rendered from: it stays editable after the vote, nothing in the manifest pins it, and where the two differ the signed PDF governs. Every citation on this board that points at a <code>.md</code> file — including the Charter source in this page's own infobox — points at the convenient copy rather than the operative one.</p>
<p>The post also states the founding conflict plainly rather than leaving it to be found: the Transition RAC authored the framework it is asking the community to ratify. What it offers as mitigation is this discussion period, the community's ability to reject the proposal, and the fact that GP-PRE-1 confers no new authority on the RAC — the establishment mandate is pre-existing and unchanged by the vote.</p>
<h3 id="the-venue-record-lags-the-announcement">The venue record lags the announcement</h3>
<p>The framework's own rule is that a ratified document is published to the <a href="https://radixdao.org/" target="_blank" rel="noopener">Official Venue</a>, and the venue keeps a machine-readable record of what has officially happened. Read at 19:10&nbsp;UTC on 30 August 2026 — an hour and forty minutes after the announcement — <a href="https://radixdao.org/notices.json" target="_blank" rel="noopener">its JSON feed</a> carries exactly two items, both dated 29 August: the certificate details and the minute of the 25 August meeting. The venue's <a href="https://radixdao.org/notices/type/process-notices/" target="_blank" rel="noopener">Process notices</a> category exists and holds nothing, and the site banner still reads <em>Ratification vote pending. Community decisions are advisory until activation</em>, with the body text beneath it saying the first vote "has not been called".</p>
<p>None of that is wrong: the vote has not been called, and the RAC has not claimed the Discussion phase is a notice. It does mean the opening of the process is recorded on Telegram and on a forum, and not yet in the record the framework designates for it. The <a href="https://github.com/RadixDAO/governance-framework" target="_blank" rel="noopener">governance repository</a> reads the same way — its last commit is 27 August, the manifest-hash commit, and every document named in the manifest is still under <code>pending/</code>.</p>`;

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

  // 1. Append the new dated section to the prose block (index 0).
  const prose = blocks[0];
  if (prose?.type !== 'content') throw new Error('block 0 is not the prose block');
  prose.text = prose.text.trimEnd() + '\n' + SECTION;

  // 2. Retire the infobox's "no date set" vote-status row and point Discussion at the topic.
  const ib = blocks.find((b) => b.type === 'infobox');
  const cell = ib?.blocks?.[0];
  if (!cell) throw new Error('infobox cell not found');
  const before = cell.text;
  cell.text = cell.text
    .replace(/<tr><td><strong>Vote status<\/strong><\/td><td>[\s\S]*?<\/td><\/tr>/,
      '<tr><td><strong>Vote status</strong></td><td>Discussion phase open 30 Aug – 6 Sep 2026; ballot not yet opened</td></tr>')
    .replace(/<tr><td><strong>Discussion<\/strong><\/td><td>[\s\S]*?<\/td><\/tr>/,
      '<tr><td><strong>Discussion</strong></td><td><a href="https://radixtalk.com/t/charter-policies-ratification-discussion/2330" target="_blank" rel="noopener">Charter &amp; Policies Ratification Discussion</a> (RadixTalk)</td></tr>');
  if (cell.text === before) throw new Error('infobox rows did not match — aborting');
  if (cell.text.includes('no date set')) throw new Error('vote-status row not replaced');

  const version = '2.2.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  prose ${page.content[0].text.length} -> ${prose.text.length} B`);
  console.log(`  infobox ${before.length} -> ${cell.text.length} B`);

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
       'Record the opening of the Ratification Discussion phase: the Transition RAC announced at 17:30 UTC on 30 Aug 2026 that ratification is under way with a 7-day discussion anchored at RadixTalk topic 2330. Adds what the discussion is asked to check (hash verification against the signed PDFs, which are the ratified artifact rather than the .md sources), the stated founding conflict of interest, and the fact that the Official Venue record and the governance repository both still read pre-announcement. Infobox vote status and discussion link updated. Sources: t.me/RadixAccountabilityCouncil/922, radixtalk.com/t/.../2330, radixdao.org/notices.json, GitHub commits API.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
