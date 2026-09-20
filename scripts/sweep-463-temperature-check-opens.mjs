/**
 * sweep 463 - ideas rotation. The ratification vote's Temperature Check opened.
 *
 * The Transition RAC posted to t.me/RadixAccountabilityCouncil/1047 at 14:30 UTC
 * on 20 September 2026 that the Discussion phase closed on Friday and the
 * Temperature Check has launched, at vote.radixdao.org/tc/0. Measured rather
 * than taken from the announcement, on mainnet and in the repository:
 *
 *   Governance component component_rdx1cp90ys553uwxuckev249x5wezucqru0u4qr7qdxdc9tlpmnh93242k
 *   temperature_check_count 1; entry 0 of its temperature_checks store is
 *   "RadixDAO: Constitutional ratification of the Governance Framework".
 *   snapshot = start = 1789905040 = 11:50:40 UTC 20 Sep 2026
 *   deadline =         1790337040 = 11:50:40 UTC 25 Sep 2026   (5 days)
 *   parameter_set dao-constitutional v1: TC 5 days / quorum 405,249,777 / 0.5
 *                                        proposal 7 days / 1,350,832,592 / 0.66
 *   vote_count 43, revote_count 3; the votes store holds 43 records from 40
 *   accounts, 3 superseded, leaving 39 For and 1 Against at epoch 342,598
 *   (20:41 UTC). A record carries the direction and not the weight, so the
 *   tally against the quorum is computed off the snapshot, not read.
 *
 *   The proposal body stored on the ledger is 8,835 bytes and is byte-identical
 *   to pending/GP-PRE-1-Framework-Ratification.md at commit 470a047 (10:47 UTC
 *   the same morning), which added the "where to find the ratified documents"
 *   section an hour before the check opened.
 *
 *   All 21 signed PDFs in pending/signed/ downloaded and hashed on 20 Sep: every
 *   SHA-256 matches its manifest row, the Charter at 33a668f6...426cd0. This is
 *   the first half of the verification GP-PRE-1 asks for, and the page recorded
 *   on 2 September that nobody had done it.
 *
 *   Ten commits 18-20 Sep, the first since 27 August. Three ratified documents
 *   changed in substance (charter, compliance-operations-policy,
 *   dispute-resolution-and-arbitration-policy), each keeping v1.0.0 and moving
 *   its date; 12 were re-signed with new manifest hashes on 19 Sep (dfe938c).
 *   The parameters registry raised the short Temperature Check floor from 1 day
 *   to 2 (9b490d1), because the same floor governs an election tie runoff.
 *
 * That last finding is why this is not only a new section. The page carries the
 * Charter verbatim and said the text was v1.0.0 of 27 August. Decoded out of the
 * stored <pre> block and diffed against pending/constitutional/charter.md at
 * HEAD, the two differ on exactly five lines: the date line, Charter 12.2's
 * consent class and its Transition-Period gloss, the Charter 13 inline heading,
 * and Charter 14's forwarding duty. All five are corrected here, so the page
 * quotes what is being voted on rather than what was signed in August.
 *
 * Second edit, closing the backlog item opened by run 451: the same RAC post
 * says the council has finished its MIDAO onboarding work and the submission to
 * the Marshall Islands is now MIDAO's to make. The DUNA card expected that on
 * Monday 21 September.
 *
 * Idempotent: skipped if the Temperature Check section is already present.
 */
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');

const SENTINEL = 'the-temperature-check-opens';

const TC_SECTION =
  '<h2 id="the-temperature-check-opens">The Temperature Check opens (20 September 2026)</h2>' +
  '<p>The vote exists. A Temperature Check on <a href="https://github.com/RadixDAO/governance-framework/blob/main/pending/GP-PRE-1-Framework-Ratification.md" target="_blank" rel="noopener">GP-PRE-1</a> was created at <strong>11:50:40 UTC on 20 September 2026</strong> in the Consultation V3 governance component on mainnet, <code>component_rdx1cp90ys…93242k</code>, whose <code>temperature_check_count</code> now reads 1. The Transition RAC <a href="https://t.me/RadixAccountabilityCouncil/1047" target="_blank" rel="noopener">told its channel at 14:30 UTC</a>, two hours and forty minutes later, that the Discussion phase closed on Friday and the check is open, and gave the ballot as <a href="https://vote.radixdao.org/tc/0" target="_blank" rel="noopener">vote.radixdao.org/tc/0</a>. It runs five days and closes at 11:50:40 UTC on 25 September. Voting power is taken from a snapshot at the moment it opened, so a holding acquired after that does not vote.</p>' +
  '<p>The component stores the thresholds rather than a pointer to them, under the identifier <code>dao-constitutional</code> at version 1: the Temperature Check runs five days, needs 405,249,777 XRD of voting power for quorum and 50% approval; the full proposal behind it runs seven days, needs 1,350,832,592 and 66%. The second figure is the 10% quorum GP-PRE-1 states, which makes the Temperature Check quorum 3% of the same base. A Temperature Check decides whether the proposal goes to that ballot, so nothing is ratified when it closes.</p>' +
  '<p>The proposal text held on the ledger is 8,835 bytes and matches <code>pending/GP-PRE-1-Framework-Ratification.md</code> in the <a href="https://github.com/RadixDAO/governance-framework" target="_blank" rel="noopener">governance repository</a> byte for byte, at commit <code>470a047</code>, made at 10:47 UTC the same morning to add a section naming where the ratified documents are published. What is on the ballot is the repository&rsquo;s current text.</p>' +
  '<h3 id="the-hash-column-checks-out">The hash column checks out</h3>' +
  '<p>GP-PRE-1 asks the community to verify twenty-one document hashes, and <a href="#what-three-days-of-discussion-produced">this page recorded on 2 September</a> that none of that work was visible in the discussion thread. It has been done here. Each of the twenty-one signed PDFs in <a href="https://github.com/RadixDAO/governance-framework/tree/main/pending/signed" target="_blank" rel="noopener"><code>pending/signed/</code></a> was downloaded on 20 September 2026 and hashed, and every SHA-256 matches the manifest row that names it, the Charter at <code>33a668f6…426cd0</code>. The proposal makes the hash of the signed PDF the definitive identifier of a ratified version, so a match means the manifest and the repository agree on what is being ratified. The other half of the check, reading each signed PDF against its markdown source, is not done here.</p>' +
  '<h3 id="what-the-discussion-changed">What the discussion changed</h3>' +
  '<p>The council says the framework took last-minute contributions and adjustments before the phase closed, and the repository records them: ten commits between 18 and 20 September, the first since 27 August. Three of the twenty-one ratified documents changed in substance. <strong>Charter &sect;12.2</strong> gave the power to adopt an emergency amendment to the unanimous written consent of all Delegates, a class that excluded a seated RAC member holding no Delegated Function and handed an elected Delegate holding no RAC seat a veto over amending the Charter; it now reads all seated RAC members, and Charter &sect;14 and Compliance Operations &sect;5 are conformed to name both. The <strong>Dispute Resolution &amp; Arbitration Policy</strong> listed grounds on which a treasury signer may refuse to sign that are not among the five in Treasury Signers Rules &sect;9, so a signer refusing on this policy&rsquo;s wording could have been recorded as in breach of that one; the list is gone and Treasury Signers Rules &sect;9 is named as the only authority. The same policy routed an allegation against a RAC member to a working group that is not constituted at launch, and now sends it straight to Level 4.</p>' +
  '<p>The <a href="/ideas/dao-parameters-registry" rel="noopener">DAO Parameters Registry</a> moved a number rather than a rule: the floor on a short Temperature Check goes from one day to two, because the same floor governs an election tie runoff, which opens after a vote closes, takes no new nominations and so carries no advance notice at all. Each of the three amended documents keeps version 1.0.0 and moves its last-updated date, and twelve of the twenty-one were re-signed with new manifest hashes on 19 September. The verbatim Charter below is the amended text.</p>' +
  '<p>Read at epoch 342,598, 20:41 UTC on the day it opened, the check holds 43 vote records from 40 accounts, three of them replaced by a later vote from the same account, leaving <strong>39 for and 1 against</strong>. A record carries the direction an account voted and not what its vote weighs, so the tally against the quorum is computed from the snapshot off the ledger rather than read from the component. The Official Venue has recorded none of this: read at 20:25 UTC, <a href="https://radixdao.org/notices.json" target="_blank" rel="noopener">its notices feed</a> holds the same two items it has held since 29 August, and the repository&rsquo;s root <code>constitutional/</code>, <code>governance/</code>, <code>legal/</code>, <code>parameters/</code> and <code>signed/</code> folders each still hold nothing but a <code>.gitkeep</code>, which is where a YES vote would move the documents.</p>';

const CHARTER_EDITS = [
  [
    'version 1.0.0</strong>, last updated 27 August 2026, taken from',
    'version 1.0.0</strong>, last updated 19 September 2026, taken from',
  ],
  [
    '<tr><td><strong>Version</strong></td><td>1.0.0, last updated 27 August 2026</td></tr>',
    '<tr><td><strong>Version</strong></td><td>1.0.0, last updated 19 September 2026</td></tr>',
  ],
  [
    '<tr><td><strong>Vote status</strong></td><td>Discussion phase opened 30 Aug 2026 and closes at 23:59 UTC on 18 Sep 2026, set by the Transition RAC on 17 Sep; the Temperature Check follows, date not announced</td></tr>',
    '<tr><td><strong>Vote status</strong></td><td>Temperature Check open 11:50 UTC 20 Sep 2026 to 11:50 UTC 25 Sep 2026 at <a href="https://vote.radixdao.org/tc/0" target="_blank" rel="noopener">tc/0</a>: five days, 50% approval on a 405,249,777 XRD quorum. The full ballot follows it</td></tr>',
  ],
  // The four lines of verbatim Charter text amended in the ratification window,
  // 18-19 September 2026. Source: pending/constitutional/charter.md at HEAD.
  [
    '*Version v1.0.0 \u2014 Last updated 2026-08-27*',
    '*Version v1.0.0 \u2014 Last updated 2026-09-19*',
  ],
  [
    '**unanimous written consent of all Delegates**',
    '**unanimous written consent of all seated RAC members**',
  ],
  [
    'During the Transition Period, when the Delegated Functions are held by the Transition RAC (Delegate Mandate §6; **Operating Agreement Article VI**), "unanimous written consent of all Delegates" means the unanimous written consent of all seated Transition RAC members, and the ratification requirement is satisfied by a recognised advisory outcome meeting the standard recognition thresholds (**DAO Parameters §3A.3**).',
    'During the Transition Period, "all seated RAC members" means all seated Transition RAC members (**Operating Agreement Article VI**), and the ratification requirement is satisfied by a recognised advisory outcome meeting the standard recognition thresholds (**DAO Parameters §3A.3**).',
  ],
  [
    '**The policy library forms part of this Charter.**',
    '**Scope of "Charter" in the Operating Agreement.**',
  ],
  [
    '**forwarded to the Delegates and disclosed to the community**',
    '**forwarded to the Delegates and RAC members and disclosed to the community**',
  ],
];

const DUNA_EDITS = [
  [
    'and on 7 September 2026, the day the filing was to begin, the council said the submission to the registry had still to be made.',
    'and on 20 September 2026 the council said its own work is finished and the submission to the registry is now MIDAO&rsquo;s to make.',
  ],
  [
    'have not started.</p><h2>Deliverables</h2>',
    'have not started.</p>' +
      '<h3 id="20-september-the-councils-part-is-done">20 September 2026: the council&rsquo;s part is done</h3>' +
      '<p>The council finished a day early. Its <a href="https://t.me/RadixAccountabilityCouncil/1047" target="_blank" rel="noopener">update of 20 September</a>, posted at 14:30 UTC, opens its legal section with <q>We have completed all our tasks and requirements</q> and says the remaining work belongs to <a href="https://midao.org" target="_blank" rel="noopener">MIDAO</a>, which takes the DAO through to incorporation. The council declines to put a countdown on it, on the ground that the timing is the Marshall Islands government&rsquo;s rather than MIDAO&rsquo;s.</p>' +
      '<p>That ends the three weeks of the council&rsquo;s own administrative steps, which began when the agreement was signed and the fee paid on 5 September and were still unfinished on 7 September, the day the filing was to start. It does not start the registry clock: the submission has not been reported as made, so the four to six weeks the council put on the Marshall Islands to grant and issue the Certificate of Formation still have not begun. Ratification runs alongside this and reached its <a href="/ideas/radix-network-dao-charter#the-temperature-check-opens" rel="noopener">Temperature Check</a> on the same day.</p>' +
      '<h2>Deliverables</h2>',
  ],
];

const replaceOnce = (haystack, needle, replacement, where) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`${where}: string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`${where}: string is not unique: ${JSON.stringify(needle.slice(0, 70))}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

const applyEdits = (blocks, edits, where) => {
  for (const [from, to] of edits) {
    const target =
      blocks.find((b) => (b.text || '').includes(from)) ||
      blocks.flatMap((b) => b.blocks || []).find((b) => (b.text || '').includes(from));
    if (!target) throw new Error(`${where}: no block holds ${JSON.stringify(from.slice(0, 60))}`);
    target.text = replaceOnce(target.text, from, to, where);
  }
};

const write = async (client, page, blocks, version, changeType, message) => {
  assertLinkShapes(blocks, page.title);
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
    [json, version, now, page.id],
  );
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, changeType, AUTHOR_ID, message, now],
  );
  await client.query('COMMIT');
};

const load = async (client, tagPath, slug) => {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [tagPath, slug],
  );
  if (!rows.length) throw new Error(`${tagPath}/${slug} not found`);
  return rows[0];
};

await withClient(async (client) => {
  // 1. The Charter card: the new section, and the verbatim text it quotes.
  const charter = await load(client, 'ideas', 'radix-network-dao-charter');
  if (JSON.stringify(charter.content).includes(SENTINEL)) {
    console.log('  radix-network-dao-charter: Temperature Check section already present - no write');
  } else {
    const blocks = JSON.parse(JSON.stringify(charter.content));
    applyEdits(blocks, CHARTER_EDITS, 'radix-network-dao-charter');
    const verbatimAt = blocks.findIndex((b) => (b.text || '').startsWith('<pre language="markdown">'));
    if (verbatimAt < 1) throw new Error('radix-network-dao-charter: verbatim block not found');
    blocks.splice(verbatimAt, 0, { id: uid(), type: 'content', text: TC_SECTION });

    const version = '2.6.0';
    console.log(
      `  ${DRY ? '[dry] ' : ''}${charter.title}  v${charter.version} -> v${version}` +
        `\n        + section at block ${verbatimAt}: the Temperature Check, the hash check, what discussion changed` +
        '\n        verbatim Charter corrected on 4 lines (12.2 x2, 13 heading, 14) + date line' +
        '\n        infobox: Version 27 Aug -> 19 Sep; Vote status -> TC open to 25 Sep',
    );
    if (!DRY) {
      await write(
        client,
        charter,
        blocks,
        version,
        'minor',
        'The Temperature Check on GP-PRE-1 opened at 11:50:40 UTC on 20 September 2026 and closes at 11:50:40 UTC ' +
          'on 25 September: five days, 50% approval on a 405,249,777 XRD quorum, read from the Consultation V3 ' +
          'governance component rather than from the announcement, with 39 for and 1 against from 40 accounts at ' +
          'epoch 342,598. The proposal text on the ledger is byte-identical to the repository at commit 470a047. ' +
          'All 21 signed PDFs were hashed and every SHA-256 matches its manifest row, which is the first half of ' +
          'the verification GP-PRE-1 asks for and which this page recorded nobody had done. Ten commits between 18 ' +
          'and 20 September amended three ratified documents in substance (Charter 12.2, 13 and 14; Dispute ' +
          'Resolution 7 and 9; Compliance Operations 5) and raised the short Temperature Check floor to two days. ' +
          'The verbatim Charter this page carries was the 27 August text and is corrected to the 19 September one ' +
          'on the four lines that changed.',
      );
    }
  }

  // 2. The DUNA card: the council's own onboarding work is finished.
  const duna = await load(client, 'ideas', 'dao-incorporate-duna-llc');
  if (JSON.stringify(duna.content).includes('20-september-the-councils-part-is-done')) {
    console.log('  dao-incorporate-duna-llc: 20 September section already present - no write');
  } else {
    const blocks = JSON.parse(JSON.stringify(duna.content));
    applyEdits(blocks, DUNA_EDITS, 'dao-incorporate-duna-llc');
    const version = '1.6.0';
    console.log(
      `  ${DRY ? '[dry] ' : ''}${duna.title}  v${duna.version} -> v${version}` +
        '\n        + section: the council has completed its MIDAO onboarding work; lede re-pointed',
    );
    if (!DRY) {
      await write(
        client,
        duna,
        blocks,
        version,
        'minor',
        'The Transition RAC said at 14:30 UTC on 20 September 2026 that it has completed all its tasks and ' +
          'requirements and that the remaining work to incorporation is MIDAO\'s, a day before the 21 September the ' +
          'card recorded it expected to finish. It gives no countdown, on the ground that the timing belongs to the ' +
          'Marshall Islands government. The submission to the registry has not been reported as made, so the four ' +
          'to six weeks on the Certificate of Formation still have not started. Lede updated from the 7 September ' +
          'reading.',
      );
    }
  }
});
