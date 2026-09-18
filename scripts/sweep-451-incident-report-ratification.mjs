// sweep 451 - ideas rotation, plus the one new primary source the signal sweep found.
//
// hyperlane-asset-drain-2026: the Radix Foundation published its incident report on
//   17 September 2026 (radixdlt.com/blog/public-incident-report-vault-authorisation-vulnerability-2026,
//   RDX-INC-2026-0831, v1.4), and the page still said no account of the flaw had been published.
//   New section before "What is unresolved": origin (June 2023 RDX Works tidy-up, Hacken before,
//   Zellic August 2024 missed it), the AI-tooling assessment as the Foundation's assessment, the
//   response timeline between 17:37 and 23:30 UTC, the police reports, the fix's review, and what
//   the report leaves out. Its liveness window (20:30-23:30) contains the ledger's last committed
//   round at 21:19:48, so the two agree. Its status line still reads "restoration in progress".
// radix-network-dao-charter: the Transition RAC set the close of the ratification Discussion
//   phase on 17 September (t.me/RadixAccountabilityCouncil/1037): 23:59 UTC Friday 18 September,
//   per the RadixTalk anchor post edited 15:58 UTC 17 September; the Temperature Check follows.
// dao-elect-permanent-rac: Latest row re-read. Shadaffy/radix-dao-governance unchanged since
//   6 September and none of the rules the card quotes moved in the 25 Aug - 6 Sep commits;
//   GP-ELECT-1 still a draft scaffold (last commit 5 August); governance component counters all
//   still 0 at epoch 341,811.
//
//   node scripts/sweep-451-incident-report-ratification.mjs --dry-run

import { config } from 'dotenv';
import { cuid, uid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const EMDASH = String.fromCharCode(0x2014);
const NBSP = String.fromCharCode(0xa0);
const REPORT_URL = 'https://www.radixdlt.com/blog/public-incident-report-vault-authorisation-vulnerability-2026';

const REPORT_SECTION = `<h2 id="the-foundations-report">The Foundation's report (17 September 2026)</h2>`
  + `<p>The Radix Foundation published its account of the incident on 17 September as a ${ext(REPORT_URL, 'public incident report')} on the Radix blog, reference RDX-INC-2026-0831. On the mechanism it agrees with <a href="#the-cause">the reading above</a>: a vault address named in a transaction manifest is classed as a direct-access reference, meant for operations such as recall, and the Engine let the attacker's own package call the vault's ordinary <code>take</code> method through it. The report states that the Hyperlane package played no part in the exploit and served only as the way out, and that no private key, admin badge or recall badge was used.</p>`
  + `<p>What the report adds is where the flaw came from. By the Foundation's account it entered the code in June 2023, in a tidy-up of the Radix Engine by RDX Works, the company then contracted to develop the protocol. Hacken had audited the Engine before that change. Zellic audited the protocol in August 2024, including the part of the Engine that held the defect, and did not find it. The Foundation and the forensic team it worked with believe the attacker found the flaw in the public source code with AI-assisted analysis tools; the report gives this as their assessment rather than as evidence. It records that RDX Works was told the root cause and has not responded.</p>`
  + `<p>Its timeline covers the response between the last exploit transaction and the halt: validators and Radix team members escalated to Foundation leadership at 17:37 UTC; Hyperlane took its Radix validator, relayer and scraper operations offline between 17:53 and 18:09; the security response group SEAL 911, Zellic and Hacken were engaged between 18:09 and 18:52; at 18:46 the Foundation stopped its market making on centralised exchanges and asked exchanges to pause $XRD deposits, withdrawals and trading; and between 19:10 and 19:45 the Foundation signed a multi-signature transaction pausing the Ethereum route at the bridge contract, a second barrier that did not depend on the operators staying offline. At 20:30 a call between the Foundation, board members and key validators decided to stop the network, because the flaw exposed every vault on Radix and not only the bridged ones. The report places the loss of liveness between 20:30 and 23:30, and the ledger's last committed round, at 21:19:48 UTC, falls inside that window. On 2 September the Foundation reported the theft to the States of Jersey Police and to UK police through Action Fraud.</p>`
  + `<p>On the repair, the report says a third-party developer started work at 21:11 on 31 August and presented a candidate fix at 11:00 the next day. Audit firms and other security parties reviewed the fix and the node software, some on test networks of their own running the patched code, and found no critical issue.</p>`
  + `<p>The report publishes no dollar figure for the loss, no per-asset amounts and no attacker addresses; the amounts on this page are read from the ledger. Its status line, "Network restoration in progress", and its statement that no transaction has been committed since liveness was lost both describe the network before 11 September, although the report is dated 17 September as version 1.4.</p>`;

const PHASE_SECTION = `<h2 id="the-phase-closes">The phase closes (17 September 2026)</h2>`
  + `<p>The Transition RAC set the date on 17 September, six days after the network restarted. Its ${ext('https://t.me/RadixAccountabilityCouncil/1037', 'status update')} that afternoon said the Discussion phase ends at the end of Friday 18 September and the ratification moves to its next phase, the Temperature Check, the preliminary vote that decides whether a proposal goes to a full ballot. The council edited the first post of the ${ext('https://radixtalk.com/t/charter-policies-ratification-discussion/2330', 'RadixTalk anchor topic')} at 15:58 UTC the same day to carry the date, which it gives there as 23:59 UTC, and the reason: the incident is resolved and the network is fully available again. Comments that should change the framework have to be posted in that topic before the cut-off. No date has been announced for the Temperature Check.</p>`;

const EDITS = [
  {
    tag: 'contents/history',
    slug: 'hyperlane-asset-drain-2026',
    version: '3.3.0',
    sentinel: "The Foundation's report (17 September 2026)",
    insertBefore: { id: '5ad88571-3bbc-4bd0-89b6-1824aa6cf9cb', text: REPORT_SECTION },
    swaps: [
      ['What has not been published is any account of the flaw. Announcing the restart, the council asked for a few days to prepare one.',
       'The account of the flaw the council promised at the restart arrived on 17 September as <a href="#the-foundations-report">the Foundation\'s incident report</a>.'],
      ['<td>A Radix Engine flaw in how vault references are granted – stated by the Foundation and the Radix Accountability Council on 31 August, read at the source below</td>',
       '<td>A Radix Engine flaw in how vault references are granted – stated by the Foundation and the Radix Accountability Council on 31 August, read at the source below, and traced by the Foundation\'s incident report of 17 September to a June 2023 code change</td>'],
      ['&ndash; every reading this page summarises, in the order it was taken</li></ul>',
       `&ndash; every reading this page summarises, in the order it was taken</li><li>${ext(REPORT_URL, 'Radix Foundation incident report RDX-INC-2026-0831')} – origin of the flaw, response timeline and fix, 17 September 2026</li></ul>`],
    ],
    message: 'The Radix Foundation published its incident report on 17 September 2026 (RDX-INC-2026-0831, radixdlt.com blog), and this page still said no account of the flaw had been published. New section: the flaw entered the Engine in a June 2023 tidy-up by RDX Works, Zellic\'s August 2024 audit missed it, the Foundation assesses the attacker used AI-assisted analysis, the response timeline from 17:37 to the loss of liveness (whose 20:30-23:30 window contains the ledger\'s last round at 21:19:48), the police reports of 2 September, the fix\'s independent review, and what the report omits. Infobox root-cause row and external links updated.',
  },
  {
    tag: 'ideas',
    slug: 'radix-network-dao-charter',
    version: '2.5.0',
    sentinel: 'The phase closes (17 September 2026)',
    insertBefore: { id: 'eb023c60-a569-44be-884a-97b7435d00b0', text: PHASE_SECTION },
    swaps: [
      ['<td>Discussion phase open since 30 Aug 2026, no closing date. The Transition RAC said on 9 Sep 2026 that it closes when a mainnet restart date is set; no date set, ballot not yet opened</td>',
       '<td>Discussion phase opened 30 Aug 2026 and closes at 23:59 UTC on 18 Sep 2026, set by the Transition RAC on 17 Sep; the Temperature Check follows, date not announced</td>'],
    ],
    message: 'The Transition RAC set the close of the ratification Discussion phase on 17 September 2026 (t.me/RadixAccountabilityCouncil/1037): 23:59 UTC on Friday 18 September, per the RadixTalk anchor post it edited at 15:58 UTC that day, with the Temperature Check next and no date for it yet. New dated section and vote-status row.',
  },
  {
    tag: 'ideas',
    slug: 'dao-elect-permanent-rac',
    version: '1.4.2',
    change: 'patch',
    sentinel: 'Counters still 0 at epoch 341,811',
    swaps: [
      ['<td>26 Aug 2026 &ndash; the election has a proposal, GP-ELECT-1, still a draft scaffold. Five seated members is the activation floor, KYC before seating is mandatory, the ballot must open within 90 days of ratification, and the term is six months. Counters still 0 at epoch 338,336</td>',
       '<td>18 Sep 2026 &ndash; the Charter ratification\'s Discussion phase closes at 23:59 UTC today and a Temperature Check follows; ratification starts the 90-day clock for this ballot. GP-ELECT-1 is still a draft scaffold, unchanged since 5 Aug. Counters still 0 at epoch 341,811</td>'],
    ],
    message: 'Latest row re-read 18 September 2026: the Charter ratification Discussion phase closes at 23:59 UTC today (Transition RAC, 17 September), which puts the ratification that starts this election\'s 90-day clock one step nearer. GP-ELECT-1 unchanged since 5 August; the registry, voting-framework and elections-policy sections this card quotes were diffed against every commit since 26 August and none of them moved; governance component counters still 0 at epoch 341,811.',
  },
];

function swapOnce(blocks, [from, to]) {
  let hits = 0;
  const visit = (list) => list.map((b) => {
    let next = b;
    if (typeof b.text === 'string' && b.text.includes(from)) { hits++; next = { ...b, text: b.text.replace(from, to) }; }
    if (Array.isArray(b.blocks)) next = { ...next, blocks: visit(b.blocks) };
    return next;
  });
  const out = visit(blocks);
  if (hits !== 1) throw new Error(`expected 1 match, got ${hits}: ${from.slice(0, 70)}`);
  return out;
}

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(e.tag, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tag, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied - no write`);
      continue;
    }
    let blocks = JSON.parse(JSON.stringify(page.content));
    for (const s of e.swaps) blocks = swapOnce(blocks, s);
    if (e.insertBefore) {
      const at = blocks.findIndex((b) => b.id === e.insertBefore.id);
      if (at < 0) throw new Error(`${e.slug}: anchor block ${e.insertBefore.id} not found`);
      blocks.splice(at, 0, { id: uid(), type: 'content', text: e.insertBefore.text });
    }
    const json = JSON.stringify(blocks);
    if ([...e.swaps.map((s) => s[1]), e.insertBefore?.text ?? ''].some((t) => t.includes(NBSP) || t.includes(EMDASH)))
      throw new Error(`${e.slug}: U+00A0 or an em dash in new text`);
    if (!json.includes(e.sentinel)) throw new Error(`${e.slug}: sentinel missing after edits`);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (+${json.length - JSON.stringify(page.content).length} chars)`);
    if (DRY) continue;

    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.change ?? 'minor', AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
    console.log('    written and stamped');
  }
});
