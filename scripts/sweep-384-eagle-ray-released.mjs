// Run 384 (ecosystem rotation; this edit is the signal-sweep lead, not the rotation).
// Scrypto pull request #2093 - which carries the Eagle Ray protocol update and the
// receiver check written during the 31 August halt - was merged into develop at
// 17:33:31 UTC on 7 September 2026, and Scrypto v1.4.0 (Eagle Ray) was tagged from the
// merge commit and published at 17:35:11 UTC. Every page on this wiki that mentions
// Eagle Ray still says the pull request is open, unreviewed and unmerged.
//
// Two pages, one fact:
//   contents/tech/releases/protocol-updates       - rewrite the Eagle Ray section
//   contents/history/hyperlane-asset-drain-2026   - add "Day eight, evening", correct
//                                                   the infobox and the standing
//                                                   present-tense claim in "What is
//                                                   unresolved"
//
// Sources read this run:
//   api.github.com/repos/radixdlt/radixdlt-scrypto/pulls/2093        merged_at 2026-09-07T17:33:31Z
//   api.github.com/repos/radixdlt/radixdlt-scrypto/releases/tags/v1.4.0  published 17:35:11Z, created 17:34:30Z
//   api.github.com/repos/radixdlt/radixdlt-scrypto/branches/develop  tip a62393f716 (merge of #2093)
//   api.github.com/repos/radixdlt/radixdlt-scrypto/pulls/2093/files  587 files, 538 under generated-examples/eagle-ray
//   api.github.com/repos/radixdlt/babylon-node/releases              newest still v1.3.0.5, 1 June 2026
//   mainnet.radixdlt.com/status/gateway-status                       state version 557,840,622 at 19:03 UTC 7 Sep
//   mainnet.radixdlt.com/state/validators/list                       HTTP 500, current_sync_delay_seconds 596,785
//   docs.radixdlt.com/docs/eagle-ray                                 HTTP 404

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');

const PROTOCOL_UPDATES_SECTION = `<h2>Eagle Ray (Released, September 2026)</h2>
<p><strong>Eagle Ray</strong> is the sixth name in the sequence, and the only one so far written while the network it targets was stopped. Its whole history runs from the halt of 31 August 2026 to the release of 7 September: <a href="https://github.com/radixdlt/radixdlt-scrypto/pull/2093" target="_blank" rel="noopener">pull request #2093</a>, &ldquo;0xOmarA/vault access&rdquo;, was opened against radixdlt-scrypto&rsquo;s <code>develop</code> branch on 2 September by <a href="https://github.com/0xOmarA" target="_blank" rel="noopener">0xOmarA</a>, sat unreviewed for five days, and was merged at <strong>17:33 UTC on 7 September 2026</strong>. <a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">Scrypto v1.4.0 (Eagle Ray)</a> was tagged from the merge commit and published ninety seconds later, the first Scrypto release since v1.3.1 in January 2026. Its release notes carry the repository&rsquo;s licence text and nothing else, and <a href="https://docs.radixdlt.com/docs/eagle-ray" target="_blank" rel="noopener">docs.radixdlt.com/docs/eagle-ray</a> still answers HTTP 404, so the code is the only published account of what the update does.</p>
<p>The update itself is small, and the diff is misleading about that. It touches 587 files and adds 58,244 lines, but 538 of those files are regenerated transaction-scenario receipts and manifests under <code>radix-transaction-scenarios/generated-examples/eagle-ray/</code> &ndash; the expected output of every existing scenario, re-recorded under the new protocol version. The engine change is <code>radix-engine/src/updates/eagle_ray.rs</code>, 80 lines, plus 43 in the system callback. Nine new cost files under <code>radix-engine-tests/assets/metering/eagle-ray/</code> re-measure the fee schedule for the same scenarios.</p>
<p><code>EagleRaySettings</code> carries one setting, a system-version update, and its single batch flashes a replacement <code>SystemBoot</code> substate onto the boot-loader partition of the transaction tracker, advancing the system logic from <code>SystemVersion::V4</code> to <code>V5</code> while carrying the previous parameters across. No blueprint is published and no ledger state is migrated. <code>ProtocolVersion::LATEST</code> becomes <code>EagleRay</code>, ahead of Dugong.</p>
<p>V5 enables exactly one behaviour, <code>should_check_method_receiver_access</code>. Before an invocation proceeds, the system asks whether the calling frame can actually see the node whose method it is about to call: a <code>Direct</code> method &ndash; the type used for recall and other direct vault access &ndash; requires direct visibility of the receiver, ordinary <code>Main</code> and module methods require ordinary visibility, and roots, functions and blueprint hooks are exempt. A call that fails is rejected with a new error, <code>SystemError::InvalidInvokeAccess</code>. What that replaces is legible in the test suite: <code>test_recall_on_internal_vault</code> previously expected the attempt to die deep in the kernel&rsquo;s frame construction, at <code>PassMessageError::DirectRefNotFound</code>, and now expects <code>InvalidInvokeAccess</code> instead. The same pull request narrows a Dugong behaviour that had been written as &ldquo;V4 and later&rdquo; to V4 alone, with the comment that <q>Dugong&rsquo;s V4-only behavior must not carry into later versions</q>.</p>
<p>A Scrypto release is not a protocol update reaching a network, and the second half has not happened. <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>, the implementation every validator runs, has released nothing since <code>v1.3.0.5</code> of 1 June 2026, so there is still no node version for an operator to install and signal readiness for, and no enactment epoch has been named. Mainnet remains at the ledger it stopped on: state version 557,840,622, epoch 339,896, read at 19:03 UTC on 7 September 2026.</p>`;

const DRAIN_SECTION = `<h2 id="day-eight-evening-the-fix-merges">Day eight, evening: the fix merges, and Scrypto releases it ninety seconds later</h2>
<p>Read at <strong>19:03 UTC on 7 September 2026</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a> returns the same ledger for a thirty-seventh consecutive reading: state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179 UTC. That is <strong>one hundred and sixty-five hours and forty-four minutes</strong> without a committed round. <code>/state/validators/list</code> answers HTTP 500 and counts the gap itself, <q>it is currently 6 days, 21 hours, 46 minutes, 25 seconds behind</q>, with <code>current_sync_delay_seconds</code> 596,785 against a <code>max_allowed_sync_delay_seconds</code> of 720.</p>
<p>The ledger is the only thing here that did not move. <a href="https://github.com/radixdlt/radixdlt-scrypto/pull/2093" target="_blank" rel="noopener">Pull request #2093</a>, which carries <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a> and the receiver check <a href="#day-five-the-fix-is-on-github" rel="noopener">day five</a> read line by line, took its first push since 2 September at <strong>16:50 UTC</strong>: a seventh commit, <code>fba18466</code>, titled <q>Fix scrypto-coverage ci</q>. Forty-three minutes later, at <strong>17:33:31 UTC</strong>, it was merged. <code>develop</code>, the branch that had stood at commit <code>858c70f1</code> of 27 March 2026 through every reading this page has taken, now ends at the merge commit <code>a62393f7</code>.</p>
<p>At <strong>17:34:30 UTC</strong> a tag was cut from that commit and at <strong>17:35:11 UTC</strong> <a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">Scrypto v1.4.0 (Eagle Ray)</a> was published by <a href="https://github.com/0xOmarA" target="_blank" rel="noopener">0xOmarA</a>, the first Scrypto release since v1.3.1 in January 2026. Its release notes are the repository&rsquo;s licence text and nothing else: no description of the flaw, the fix or the update. <a href="https://docs.radixdlt.com/docs/eagle-ray" target="_blank" rel="noopener">The documentation page for Eagle Ray</a> still answers HTTP 404. The code is the announcement.</p>
<p>What the merge contains is smaller than its size suggests. It touches 587 files and adds 58,244 lines, and 538 of those files are regenerated transaction-scenario receipts and manifests under <code>generated-examples/eagle-ray/</code>: the expected output of every existing scenario, re-recorded under the new protocol version, which is what a system-version change forces. The engine change is <code>radix-engine/src/updates/eagle_ray.rs</code> at 80 lines, plus 43 in the system callback that runs the check.</p>
<p>Two of the <a href="#shape-of-the-fix" rel="noopener">four steps the council named</a> are now done and the remaining two are the ones that need other people. There is still no node release: <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>, the implementation every validator actually runs, has released nothing since <code>v1.3.0.5</code> of 1 June 2026, and a protocol update reaches mainnet only when validator operators install a node version containing it and signal they are ready. Until that version exists there is nothing for them to install. <a href="https://t.me/RadixAnnouncements/2778" target="_blank" rel="noopener">The Radix Foundation&rsquo;s announcement channel</a> has published nothing since 2 September; the merge is on GitHub, where anyone who thinks to look can read it.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const targets = [
  {
    tagPath: 'contents/tech/releases',
    slug: 'protocol-updates',
    version: '1.3.0',
    changeType: 'minor',
    sentinel: 'Eagle Ray (Released, September 2026)',
    message:
      'Eagle Ray released. Scrypto pull request #2093 was merged into develop at 17:33 UTC on 7 September 2026 and Scrypto v1.4.0 (Eagle Ray) was tagged from the merge commit and published at 17:35 UTC. The section said the pull request was open, unreviewed and unmerged. Rewritten with the merge, the release, the diff composition (538 of 587 files are regenerated scenario fixtures), and the half that has not happened: no babylon-node release since v1.3.0.5 of 1 June 2026, so no readiness signalling and no enactment epoch. Sources: GitHub pulls/2093, releases/tags/v1.4.0, branches/develop, babylon-node/releases; docs.radixdlt.com/docs/eagle-ray still 404.',
    mutate(blocks) {
      const i = blocks.findIndex((b) => (b.text || '').includes('Eagle Ray (Proposed, September 2026)'));
      if (i < 0) throw new Error('Eagle Ray section not found on protocol-updates');
      blocks[i] = { ...blocks[i], text: PROTOCOL_UPDATES_SECTION };
      return `rewrote block ${i} (Eagle Ray section)`;
    },
  },
  {
    tagPath: 'contents/history',
    slug: 'hyperlane-asset-drain-2026',
    version: '2.17.0',
    changeType: 'minor',
    sentinel: 'day-eight-evening-the-fix-merges',
    message:
      'Day eight, evening: the fix merges and Scrypto releases it. Pull request #2093, open and unreviewed through every prior reading on this page, took a seventh commit at 16:50 UTC on 7 September and was merged at 17:33:31; Scrypto v1.4.0 (Eagle Ray) was tagged from the merge commit and published at 17:35:11 with licence text for release notes. develop now ends at a62393f7 rather than 858c70f1 of 27 March 2026. Gateway re-read at 19:03 UTC, thirty-seventh identical reading, 165h44m without a round. Infobox network-status row re-stamped and a Fix row added; the present-tense claim in "What is unresolved" that the pull request remains unmerged corrected. babylon-node still has no release after v1.3.0.5 of 1 June 2026.',
    mutate(blocks) {
      const notes = [];

      // 1. New day-eight-evening section, after the day-eight block.
      const dayEight = blocks.findIndex((b) => (b.text || '').includes('day-eight-the-restart-gets-a-forecast'));
      if (dayEight < 0) throw new Error('day eight section not found');
      blocks.splice(dayEight + 1, 0, { id: uid(), type: 'content', text: DRAIN_SECTION });
      notes.push(`inserted new section at ${dayEight + 1}`);

      // 2. Infobox: re-stamp the network-status row and add a Fix row after it.
      const box = blocks[0];
      if (box.type !== 'infobox') throw new Error('block 0 is not the infobox');
      const inner = box.blocks[0];
      const oldStatus =
        'Still halted when re-read at 15:05:16 UTC, 7 September, one hundred and sixty-one hours and forty-six minutes after the last round';
      const newStatus =
        'Still halted when re-read at 19:03 UTC, 7 September, one hundred and sixty-five hours and forty-four minutes after the last round';
      if (!inner.text.includes(oldStatus)) throw new Error('infobox network-status row not matched');
      let boxText = inner.text.replace(oldStatus, newStatus);
      const fixRow =
        '<tr><td><strong>Fix</strong></td><td>The <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a> protocol update, merged into radixdlt-scrypto at 17:33 UTC on 7 September and released as <a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">Scrypto v1.4.0</a>. No node release carries it yet</td></tr>';
      const anchor = '<tr><td><strong>Ledger record</strong></td>';
      if (!boxText.includes(anchor)) throw new Error('infobox ledger-record row not matched');
      boxText = boxText.replace(anchor, fixRow + anchor);
      box.blocks[0] = { ...inner, text: boxText };
      notes.push('infobox: status re-stamped, Fix row added');

      // 3. "What is unresolved" still claims the pull request is unmerged.
      const ui = blocks.findIndex((b) => (b.text || '').includes('and it remains open, unreviewed and unmerged.'));
      if (ui < 0) throw new Error('unresolved present-tense claim not matched');
      blocks[ui] = {
        ...blocks[ui],
        text: blocks[ui].text.replace(
          'and it remains open, unreviewed and unmerged.',
          'and it was merged on 7 September and released the same evening as Scrypto v1.4.0.',
        ),
      };
      notes.push(`corrected block ${ui} (What is unresolved)`);

      return notes.join('; ');
    },
  },
];

try {
  // The find-strings above must not have been silently rewritten with U+00A0.
  for (const s of [PROTOCOL_UPDATES_SECTION, DRAIN_SECTION]) {
    if (/[\u00A0\u2014]/.test(s)) throw new Error('new prose contains U+00A0 or an em dash');
  }

  for (const t of targets) {
    if (isLockedPage(t.tagPath, t.slug)) throw new Error(`${t.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [t.tagPath, t.slug],
    );
    if (!rows.length) throw new Error(`${t.tagPath}/${t.slug} not found`);
    const page = rows[0];

    if (JSON.stringify(page.content).includes(t.sentinel)) {
      console.log(`  ${t.slug}: already applied - no write`);
      continue;
    }

    const blocks = JSON.parse(JSON.stringify(page.content));
    const note = t.mutate(blocks);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${t.version}  (${note})`);

    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query(
        'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
        [json, t.version, now, page.id],
      );
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, t.version, t.changeType, AUTHOR_ID, t.message, now],
      );
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
