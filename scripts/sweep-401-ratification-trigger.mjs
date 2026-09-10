// Run 401. Rotation: ideas. The ratification Discussion phase lost its closing date on
// 2 September with no condition named for getting it back. On 9 September the Transition
// RAC named one, in its Telegram channel, and nowhere else: a set date for mainnet
// liveness recovery closes Discussion and starts Temperature Check planning. The trigger
// is the scheduling of the restart, not the restart. Measured against the anchor topic
// (unedited since 2 September), the Official Venue (two notices since 29 August) and the
// ledger (still stopped), the condition exists only in a chat message.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ideas';
const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const RAC_1012 = 'https://t.me/RadixAccountabilityCouncil/1012';
const RAC_1017 = 'https://t.me/RadixAccountabilityCouncil/1017';
const ANCHOR = 'https://radixtalk.com/t/charter-policies-ratification-discussion/2330';

/* ---------- page A: the Proposal & Voting Framework card ---------- */

const SENTINEL_A = 'the-phase-has-a-condition';
const SECTION_A = `<h2 id="${SENTINEL_A}">The phase with no closing date now has a condition (10 September 2026)</h2>
<p>When the Transition RAC removed the seven-day limit on 2 September it gave a reason and no condition: the ledger was stopped, so the phase would run <q>for as long as its needed</q>. Eight days later the condition exists. At <strong>18:43&nbsp;UTC on 9 September 2026</strong>, under the heading LEGAL/DAO &amp; Governance, projectShift wrote in the council's own channel that ${A(RAC_1012, '<q>When we have a set date for mainnet’s liveness recovery, we’ll close down Discussion phase and plan TC, for the ratification process.</q>')}</p>
<p>The precision is the part that matters. The trigger is not the restart. It is the <strong>setting of a date</strong> for the restart, which can happen while the network is still stopped, so the Temperature Check on the twenty-one documents can be planned before a single round is committed. The two conditions the 2 September extension implied, a working network and a finished discussion, have been replaced by one condition that is neither.</p>
<h3 id="no-date-is-set-yet">No date is set yet</h3>
<p>Read at <strong>15:08&nbsp;UTC on 10 September 2026</strong>, ${A('https://mainnet.radixdlt.com/status/gateway-status', 'the Gateway status endpoint')} returns state version 557,840,622, epoch 339,896, round 102, which is <strong>233 hours and 49 minutes</strong> without a committed round, and <code>/state/validators/list</code> answers HTTP 500 counting the same gap at 841,756 seconds behind. Nine hours before that reading, at <strong>09:13:53&nbsp;UTC</strong>, the same author posted the council's other instruction: ${A(RAC_1017, '<q>Although final versions has been made available, pls do not update your nodes yet. Further instructions and support will be shared later today or tmrw latest.</q>')} A body that has not yet told operators to install the fix has not set a restart date, so the condition it named on 9 September has not been met.</p>
<h3 id="the-condition-is-not-in-the-record">The condition is not in the governance record</h3>
<p>It was announced in a chat channel, and twelve days into the phase it is in none of the three places the framework points a voter at.</p>
<ul>
<li>The ${A(ANCHOR, 'anchor topic')} the council designated for the Discussion phase carries its first post last edited at <strong>13:58&nbsp;UTC on 2 September</strong>. That post still reads that the phase stays open <q>regardless of the initially set period</q>, and it names no condition for closing it. The topic has had no post of any kind since ${A('https://radixtalk.com/t/2330/20', '10:03&nbsp;UTC on 7 September')}, three days before this reading.</li>
<li>${A('https://radixdao.org/notices.json', 'The Official Venue’s notices feed')}, read at 15:08&nbsp;UTC on 10 September, holds the same two items it has held since <strong>29 August</strong>: the Transition RAC certificate details and the decisions enabling the ratification process. Its ${A('https://radixdao.org/notices/type/process-notices/', 'Process notices')} category answers <q>No items of this type have been published yet.</q> The venue the framework designates for official acts has recorded neither the phase's opening, nor its extension, nor its closing condition.</li>
<li>${A('https://github.com/RadixDAO/governance-framework', 'The DAO’s own repository')} was last pushed at <strong>13:28&nbsp;UTC on 27 August</strong>, before the phase opened. The <a href="/ideas/dao-adopt-phase1-governance-docs" rel="noopener">amendments of 6 September</a> to eight of the ratifiable documents are still only in ${A('https://github.com/Shadaffy/radix-dao-governance', 'the personal repository')}, pushed 21:30:49&nbsp;UTC on 6 September and unchanged since. The text a Temperature Check would be called on is not the text the DAO's repository holds.</li>
</ul>
<p>What follows is a scheduling fact rather than a criticism of it. The Discussion phase can now end on a decision taken in a validator coordination channel, and a reader watching the forum, the venue or the repository for the signal will not see it there.</p>`;

/* ---------- page B: the Charter hub ---------- */

const SENTINEL_B = 'what-closes-the-phase';
const SECTION_B = `<h2 id="${SENTINEL_B}">What closes the phase (9 September 2026)</h2>
<p>The clock removed on 2 September was replaced on 9 September by a condition. At <strong>18:43&nbsp;UTC</strong>, projectShift posted for the Transition RAC that ${A(RAC_1012, '<q>When we have a set date for mainnet’s liveness recovery, we’ll close down Discussion phase and plan TC, for the ratification process.</q>')} The trigger is the setting of a restart date rather than the restart itself, so the Temperature Check on this Charter and the twenty documents ratified with it can be planned while the ledger is still stopped.</p>
<p>No date is set. At <strong>09:13:53&nbsp;UTC on 10 September</strong> the council ${A(RAC_1017, 'told node operators not to update yet')}, with further instructions promised <q>later today or tmrw latest</q>, and at 15:08&nbsp;UTC the ledger had stood for 233 hours and 49 minutes. The condition also appears nowhere the framework sends a voter to look: the anchor topic's first post is unedited since 2 September, the ${A('https://radixdao.org/notices.json', 'Official Venue')} holds the same two notices it has held since 29 August, and its Process notices category is still empty. <a href="/ideas/dao-proposal-voting-framework" rel="noopener">The Proposal &amp; Voting Framework card</a> carries the measurement.</p>`;

const IB_OLD = '<td>Discussion phase open since 30 Aug 2026, no closing date; ballot not yet opened</td>';
const IB_NEW = '<td>Discussion phase open since 30 Aug 2026, no closing date. The Transition RAC said on 9 Sep 2026 that it closes when a mainnet restart date is set; no date set, ballot not yet opened</td>';

/* ---------- apply ---------- */

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const load = async (slug) => {
  if (isLockedPage(TAG_PATH, slug)) throw new Error(`${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, slug]);
  if (!rows.length) throw new Error(`${slug}: page not found`);
  return rows[0];
};

const write = async (page, blocks, version, message) => {
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID, message, now]);
  await client.query('COMMIT');
};

try {
  // A
  const a = await load('dao-proposal-voting-framework');
  const ab = JSON.parse(JSON.stringify(a.content));
  if (ab.some((b) => b.text?.includes(SENTINEL_A))) {
    console.log('  A already applied - no write');
  } else {
    ab.push({ id: uid(), type: 'content', text: SECTION_A });
    console.log(`  ${DRY ? '[dry] ' : ''}${a.title}  v${a.version} -> v2.2.0  (+1 block, ${SECTION_A.length} chars)`);
    if (!DRY) await write(a, ab, '2.2.0',
      'The Discussion phase now has a closing condition: the Transition RAC said on 9 September that a set date for mainnet liveness recovery closes Discussion and starts Temperature Check planning. Measured against the anchor topic (first post unedited since 2 September, no post since 7 September), the Official Venue (two notices since 29 August, Process notices empty) and the ledger (233h49m stopped at 15:08 UTC on 10 September).');
  }

  // B
  const b = await load('radix-network-dao-charter');
  const bb = JSON.parse(JSON.stringify(b.content));
  if (bb.some((x) => x.text?.includes(SENTINEL_B) || x.blocks?.some((n) => n.text?.includes(IB_NEW)))) {
    console.log('  B already applied - no write');
  } else {
    const ib = bb.find((x) => x.type === 'infobox');
    if (!ib?.blocks?.[0]?.text.includes(IB_OLD)) throw new Error('B: infobox Vote status row not matched');
    ib.blocks[0].text = ib.blocks[0].text.replace(IB_OLD, IB_NEW);
    const at = bb.findIndex((x) => x.text?.includes('id="the-clock-is-removed"'));
    if (at < 0) throw new Error('B: anchor block "the-clock-is-removed" not found');
    bb.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION_B });
    console.log(`  ${DRY ? '[dry] ' : ''}${b.title}  v${b.version} -> v2.4.0  (+1 block at ${at + 1}, infobox Vote status rewritten)`);
    if (!DRY) await write(b, bb, '2.4.0',
      'Vote status and a dated section: the Transition RAC named the condition that closes the ratification Discussion phase on 9 September 2026, a set date for mainnet liveness recovery, and no date is set.');
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
