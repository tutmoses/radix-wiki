// Run 385 (blog rotation; the first two edits are the signal-sweep lead, the third is the rotation).
//
// Three hours after Scrypto v1.4.0 (Eagle Ray) was published, the Radix Accountability
// Council answered it in its own channel: the devs have spotted that the Eagle has
// landed, "but don't go jumping into conclusions yet, that's not enough". The wiki had
// spent the evening recording the release. This run records the council's reading of it,
// which is the first statement from any body about how far the fix actually is from a
// deployable build.
//
// Three pages:
//   contents/history/hyperlane-asset-drain-2026  - "Day eight, night" section + infobox re-stamp
//   contents/tech/releases/protocol-updates      - the council's reading, appended to Eagle Ray
//   blog/week-in-review                          - the rotation edit: three of the six open
//                                                  predictions moved tonight and are re-read
//
// Sources read this run:
//   mainnet.radixdlt.com/status/gateway-status        23:06:43 UTC, state version 557,840,622, epoch 339,896
//   mainnet.radixdlt.com/state/validators/list        HTTP 500, current_sync_delay_seconds 611,257
//   stokenet.radixdlt.com/status/gateway-status       live, epoch 3,015 at 23:03:41 UTC
//   t.me/RadixAccountabilityCouncil/1000              20:45:41 UTC 7 Sep, channel post, not a forward
//   t.me/radix_dlt/1002371                            20:46:31 UTC, carried into the main group
//   radixtalk.com/t/2330.json                         Daffy 6 Sep 21:19 UTC, 7 of 13 points incorporated
//   api.github.com/repos/radixdlt/babylon-node/releases  newest still v1.3.0.5, 1 June 2026

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');

const DRAIN_SECTION = `<h2 id="day-eight-night-not-enough">Day eight, night: the council reads the release and says it is not enough</h2>
<p>Read at <strong>23:06:43 UTC on 7 September 2026</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a> returns the same ledger for a thirty-eighth consecutive reading: state version 557,840,622, epoch 339,896, round 102. That is <strong>one hundred and sixty-nine hours and forty-seven minutes</strong> without a committed round. <code>/state/validators/list</code> still answers HTTP 500, now with <code>current_sync_delay_seconds</code> 611,257.</p>
<p>Three hours and ten minutes after Scrypto v1.4.0 was published, the <a href="/contents/tech/core-concepts/radix-governance" rel="noopener">Radix Accountability Council</a> posted a status update to <a href="https://t.me/RadixAccountabilityCouncil/1000" target="_blank" rel="noopener">its own channel</a> at <strong>20:45:41 UTC</strong>, and it is the first statement from any body about how far the released code is from something a validator can run. The council writes that its developers have spotted that the Eagle has landed, meaning Eagle Ray, <q>but don&rsquo;t go jumping into conclusions yet, that&rsquo;s not enough</q>. It gives three reasons and no date: <q>there are a lot of moving parts before we have a build completely ready for general deployment, and not all of them are ready at this point</q>; the testing <q>is still ongoing and has advanced significantly</q> but is not finished; and the reviews under way have not all been completed. Asked for a date, the council says it has none it can commit to, and that <q>hasting it is the poorest of choices</q>.</p>
<p>That is the same gap this page read from the repositories at 19:03, stated by the people doing the work rather than inferred from what has not been published. The <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a> release list is unchanged at <code>v1.3.0.5</code> of 1 June 2026.</p>
<p>The update also moves the two tracks that are not the fix. On the legal one, the sign-up for MIDAO&rsquo;s service is concluded and the transition council is working through the administrative steps that end with MIDAO submitting the formation request to the Marshall Islands registry, which is the filing the council said on 5 September would begin on Monday 7 September. On governance, the amendments raised in the <a href="https://radixtalk.com/t/2330" target="_blank" rel="noopener">Charter and Policies ratification discussion</a> on RadixTalk have been incorporated where possible: <a href="https://radixtalk.com/t/2330/19" target="_blank" rel="noopener">Daffy reported at 21:19 UTC on 6 September</a> that seven of thirteen points raised against the framework were in. The discussion stays open until the council has a firm date for restarting the ratification process, which it does not have while the network is down.</p>
<p><a href="https://t.me/RadixAnnouncements/2778" target="_blank" rel="noopener">The Radix Foundation&rsquo;s announcement channel</a> has published nothing since 2 September.</p>`;

const PROTOCOL_PARA = `<p>The council that has been running the response read the release the same evening and told the network not to read a restart into it. In a status update posted at <strong>20:45:41 UTC on 7 September</strong>, the <a href="https://t.me/RadixAccountabilityCouncil/1000" target="_blank" rel="noopener">Radix Accountability Council</a> confirmed its developers had seen Eagle Ray land and said <q>that&rsquo;s not enough</q>: a build ready for general deployment has moving parts that are not ready, the testing has advanced but is not finished, and the reviews under way are incomplete. It named no date.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const RE_READ_RESTART = ` Re-read at <strong>23:06:43 UTC on 7 September 2026</strong>: HTTP 500 with <code>current_sync_delay_seconds</code> 611,257, the network 7 days 1 hour 47 minutes behind, so the miss condition still holds and no round has been committed in the twenty-nine days this claim has to run.`;

const RE_READ_NODE = ` Re-read 7 September 2026 at 23:06 UTC, and the baseline&rsquo;s account of where the fix sits no longer holds: pull request #2093 was merged into <code>develop</code> at 17:33:31 UTC that evening and <a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">Scrypto v1.4.0 (Eagle Ray)</a> was published at 17:35:11. The claim is untouched by it, because it asks for the node half: babylon-node&rsquo;s newest release is still v1.3.0.5 of 1 June 2026. The Radix Accountability Council said at 20:45:41 UTC the same evening that the landing of Eagle Ray is <q>not enough</q>, that a build ready for general deployment has moving parts that are not ready, and that testing and reviews are incomplete, which is the first estimate of this claim&rsquo;s distance from anyone doing the work.`;

const RE_READ_MIDAO = ` Re-read 7 September 2026 at 23:06 UTC, and the Monday the window is measured from has now been reported on. In its status update at 20:45:41 UTC, <a href="https://t.me/RadixAccountabilityCouncil/1000" target="_blank" rel="noopener">t.me/RadixAccountabilityCouncil/1000</a>, the council says the sign-up for MIDAO&rsquo;s service is concluded and that the transition council is working through the remaining administrative steps, up to the point where it is for MIDAO to submit the request to the Marshall Islands. So the engagement is complete and the filing with the registry has not been made, which leaves the four-to-six week grant window not yet started. Six weeks from 7 September closes on 19 October, six days inside this claim&rsquo;s due date.`;

const targets = [
  {
    tagPath: 'contents/history',
    slug: 'hyperlane-asset-drain-2026',
    version: '2.18.0',
    changeType: 'minor',
    sentinel: 'day-eight-night-not-enough',
    message:
      'Day eight, night: the Radix Accountability Council answers the release. Three hours and ten minutes after Scrypto v1.4.0 (Eagle Ray) was published, the council posted a status update at 20:45:41 UTC (t.me/RadixAccountabilityCouncil/1000, a channel post rather than a forward) saying its developers had seen Eagle Ray land "but don\'t go jumping into conclusions yet, that\'s not enough": a build ready for general deployment has moving parts that are not ready, testing has advanced but is unfinished, reviews are incomplete, and there is no date it can commit to. The same update reports the MIDAO sign-up concluded with the Marshall Islands filing not yet submitted, and seven of thirteen amendments incorporated into the ratification set (radixtalk.com/t/2330, Daffy 6 September 21:19 UTC). Gateway re-read at 23:06:43 UTC, thirty-eighth identical reading, 169h47m without a round, current_sync_delay_seconds 611,257. Infobox network-status row re-stamped.',
    mutate(blocks) {
      const notes = [];
      const prev = blocks.findIndex((b) => (b.text || '').includes('day-eight-evening-the-fix-merges'));
      if (prev < 0) throw new Error('day eight evening section not found');
      blocks.splice(prev + 1, 0, { id: uid(), type: 'content', text: DRAIN_SECTION });
      notes.push(`inserted new section at ${prev + 1}`);

      const box = blocks[0];
      if (box.type !== 'infobox') throw new Error('block 0 is not the infobox');
      const inner = box.blocks[0];
      const oldStatus =
        'Still halted when re-read at 19:03 UTC, 7 September, one hundred and sixty-five hours and forty-four minutes after the last round';
      const newStatus =
        'Still halted when re-read at 23:06 UTC, 7 September, one hundred and sixty-nine hours and forty-seven minutes after the last round';
      if (!inner.text.includes(oldStatus)) throw new Error('infobox network-status row not matched');
      box.blocks[0] = { ...inner, text: inner.text.replace(oldStatus, newStatus) };
      notes.push('infobox: status re-stamped');
      return notes.join('; ');
    },
  },
  {
    tagPath: 'contents/tech/releases',
    slug: 'protocol-updates',
    version: '1.4.0',
    changeType: 'minor',
    sentinel: 'told the network not to read a restart into it',
    message:
      'Eagle Ray: the council\'s reading of the release. The section recorded the release and the missing node half; it did not record that the Radix Accountability Council answered the release the same evening (20:45:41 UTC, t.me/RadixAccountabilityCouncil/1000) to say a build ready for general deployment has moving parts that are not ready, that testing is unfinished and reviews incomplete, and that it has no date. Appended as the closing paragraph of the Eagle Ray section.',
    mutate(blocks) {
      const i = blocks.findIndex((b) => (b.text || '').includes('Eagle Ray (Released, September 2026)'));
      if (i < 0) throw new Error('Eagle Ray section not found on protocol-updates');
      blocks[i] = { ...blocks[i], text: blocks[i].text + '\n' + PROTOCOL_PARA };
      return `appended paragraph to block ${i} (Eagle Ray section)`;
    },
  },
  {
    tagPath: 'blog',
    slug: 'week-in-review',
    version: '1.21.0',
    changeType: 'minor',
    sentinel: 'the first estimate of this claim',
    message:
      'Open predictions re-read, blog rotation. Three of the six moved on 7 September 2026 and are scored against the evening\'s evidence. The mainnet-restart claim is re-read at 23:06:43 UTC: HTTP 500, current_sync_delay_seconds 611,257, miss condition holding. The babylon-node claim\'s baseline said the fix lives in an open, unmerged pull request, which stopped being true at 17:33:31 UTC when #2093 merged and Scrypto v1.4.0 was published; the claim itself is untouched because it asks for the node half, and the Radix Accountability Council\'s 20:45:41 UTC update is the first estimate of the remaining distance from anyone doing the work. The MIDAO certificate claim gains the report on the 7 September Monday it is measured from: sign-up concluded, submission to the Marshall Islands registry not yet made. The scoring note\'s stale 6 September reading was re-stamped.',
    mutate(blocks) {
      const i = blocks.findIndex((b) => (b.text || '').includes('<h2>Open predictions</h2>'));
      if (i < 0) throw new Error('open predictions block not found');
      let t = blocks[i].text;
      const edits = [
        [
          'and had still produced no round when this page was re-read at 11:02 UTC on 6 September.',
          'and had still produced no round when this page was re-read at 23:06:43 UTC on 7 September.',
        ],
        [
          'Read the unpinned endpoint, not /status/gateway-status, which answers 200 from the frozen ledger throughout the halt and cannot distinguish a restart from its absence.',
          'Read the unpinned endpoint, not /status/gateway-status, which answers 200 from the frozen ledger throughout the halt and cannot distinguish a restart from its absence.' + RE_READ_RESTART,
        ],
        [
          'so this claim has to resolve before 2026-09-06-mainnet-restart can.',
          'so this claim has to resolve before 2026-09-06-mainnet-restart can.' + RE_READ_NODE,
        ],
        [
          'Six weeks from 7 September closes on 19 October, so the fortnight of slack recorded above is now six days.',
          'Six weeks from 7 September closes on 19 October, so the fortnight of slack recorded above is now six days.' + RE_READ_MIDAO,
        ],
      ];
      for (const [from, to] of edits) {
        if (!t.includes(from)) throw new Error(`open-predictions find-string not matched: ${from.slice(0, 60)}`);
        t = t.replace(from, to);
      }
      blocks[i] = { ...blocks[i], text: t };
      return `re-read three claims and the scoring note in block ${i}`;
    },
  },
];

try {
  for (const s of [DRAIN_SECTION, PROTOCOL_PARA, RE_READ_RESTART, RE_READ_NODE, RE_READ_MIDAO]) {
    if (/[ —]/.test(s)) throw new Error('new prose contains U+00A0 or an em dash');
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
