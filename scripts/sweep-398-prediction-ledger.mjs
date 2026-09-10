// sweep-398-prediction-ledger.mjs — blog rotation, run 398.
//
// The Week in Review index at /blog/week-in-review renders its visible blocks from
// pages.metadata.state, so an edit made to the blocks alone is reverted by the next
// `week-in-review.mjs sync`. Sweep 385 edited the blocks: three open predictions carry
// a 7 September re-reading on the live page that is absent from state. This restores
// those three into state, then applies this run's readings, then hands the whole state
// back to week-in-review.mjs, which is the only thing allowed to render the page.
//
//   node scripts/sweep-398-prediction-ledger.mjs [--dry-run]

import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
import { withClient, meta, isLockedPage } from './seed-utils.mjs';

config({ path: new URL('../.env', import.meta.url) });

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'Re-read 10 September 2026';

// The 7 September re-readings that live only in the rendered blocks (sweep 385).
const RESTORE = {
  '2026-09-06-mainnet-restart':
    ' Re-read at <strong>23:06:43 UTC on 7 September 2026</strong>: HTTP 500 with <code>current_sync_delay_seconds</code> 611,257, the network 7 days 1 hour 47 minutes behind, so the miss condition still holds and no round has been committed in the twenty-nine days this claim has to run.',
  '2026-09-06-eagle-ray-node-release':
    ' Re-read 7 September 2026 at 23:06 UTC, and the baseline&rsquo;s account of where the fix sits no longer holds: pull request #2093 was merged into <code>develop</code> at 17:33:31 UTC that evening and <a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">Scrypto v1.4.0 (Eagle Ray)</a> was published at 17:35:11. The claim is untouched by it, because it asks for the node half: babylon-node&rsquo;s newest release is still v1.3.0.5 of 1 June 2026. The Radix Accountability Council said at 20:45:41 UTC the same evening that the landing of Eagle Ray is <q>not enough</q>, that a build ready for general deployment has moving parts that are not ready, and that testing and reviews are incomplete, which is the first estimate of this claim&rsquo;s distance from anyone doing the work.',
  '2026-08-30-radix-dao-certificate':
    ' Re-read 7 September 2026 at 23:06 UTC, and the Monday the window is measured from has now been reported on. In its status update at 20:45:41 UTC, <a href="https://t.me/RadixAccountabilityCouncil/1000" target="_blank" rel="noopener">t.me/RadixAccountabilityCouncil/1000</a>, the council says the sign-up for MIDAO&rsquo;s service is concluded and that the transition council is working through the remaining administrative steps, up to the point where it is for MIDAO to submit the request to the Marshall Islands. So the engagement is complete and the filing with the registry has not been made, which leaves the four-to-six week grant window not yet started. Six weeks from 7 September closes on 19 October, six days inside this claim&rsquo;s due date.',
};

// This run's readings, appended to the check after the restore.
const APPEND = {
  '2026-08-30-hyperscale-vm-pace':
    ' Re-read 10 September 2026 03:06 UTC, and the two earlier readings were measuring the wrong thing. The same query now returns <strong>59 commits</strong>, and 40 of them carry author dates between 1 and 5 September, the five days both earlier readings recorded as silence. Author and committer timestamps are identical on every one of the 59 and the history holds no merge commit, so nothing was rewritten: the commits were made when they say and reached the default branch afterwards. A commit listing dates the commit, not the push, so it cannot see work held back. flightofthefox said as much in the hyperscale.rs channel while this was happening, at <a href="https://t.me/hyperscale_rs/12134" target="_blank" rel="noopener">t.me/hyperscale_rs/12134</a> on 7 September and <a href="https://t.me/hyperscale_rs/12141" target="_blank" rel="noopener">t.me/hyperscale_rs/12141</a> on 8 September: work was on a feature branch for leg local execution, an almost complete rewrite of how execution works, and he was not merging it early to move a tracker’s score. The check stands as recorded and the claim stays open: 59 of 200, with 141 to find in the four days to 13 September.',
  '2026-09-06-mainnet-restart':
    ' Re-read 10 September 2026 03:08 UTC: HTTP 500 with <code>current_sync_delay_seconds</code> 798,535, the network 9 days 5 hours 49 minutes behind, so the miss condition still holds. The first thing to move moved on the test network: the Radix Accountability Council said at 18:43 UTC on 9 September, at <a href="https://t.me/RadixAccountabilityCouncil/1012" target="_blank" rel="noopener">t.me/RadixAccountabilityCouncil/1012</a>, that the new software and protocol are deployed on Stokenet and the whole scenario validated end to end, with a final commit, a release and then a mainnet plan still to come.',
};

// The claim this run scores.
const SCORE = {
  id: '2026-09-06-eagle-ray-node-release',
  status: 'hit',
  resolved: '2026-09-10',
  resolvedIn: 'Wiki maintenance sweep, 10 September 2026',
  evidence:
    'Hit on 8 September 2026, two days before it was scored, and the delay is this ledger’s own fault rather than the release’s. Read at 03:07 UTC on 10 September 2026, GET /repos/radixdlt/babylon-node/releases returns <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1" target="_blank" rel="noopener">v1.4.0.0-RC1</a>, named Eagle Ray v1.4.0.0-RC1, published 2026-09-08T15:35:42Z from merge commit 7400951e with seven assets attached. That is a tag above v1.3.0.5 whose notes name Eagle Ray, which is the hit condition as recorded on 6 September. The release is flagged pre-release, so GitHub’s /releases/latest still resolves to v1.3.0.5-test.1 of 2026-09-08T12:28:06Z and an operator following the documented install path gets the older build; that matters to a node runner and it is not part of the check, which asked whether a release carrying the protocol update exists. It does.',
};

const OPEN_NOTE =
  '<strong>Scoring is no longer suspended.</strong> Radix mainnet <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted at 21:19:06 UTC on 31 August 2026</a> and had still produced no round when this page was re-read at 03:08 UTC on 10 September, nine days and five hours later. The 30 August note recorded three claims as unscorable for the duration, on the ground that the Gateway answers <code>/state/validators/list</code> with HTTP 500 while its database is behind the network. That was wrong. The freshness guard is skipped for any request carrying <code>at_ledger_state</code>, so a read pinned to state version 557,840,622 returns HTTP 200 with the full validator set as it stood when the network stopped. Any on-ledger claim whose settling epoch fell before 339,896 can therefore be scored now, which is how the StakeSafe fee claim scores below. What cannot be scored is anything needing a transaction after the halt, because nothing has executed since.';

await withClient(async (client) => {
  if (isLockedPage('blog', 'week-in-review')) throw new Error('week-in-review is LOCKED');

  const { rows } = await client.query(
    "SELECT id, version, metadata FROM pages WHERE tag_path = 'blog' AND slug = 'week-in-review'");
  if (!rows.length) throw new Error('week-in-review index not found');
  const state = structuredClone(meta(rows[0]).state ?? {});
  if (!Array.isArray(state.predictions)) throw new Error('state.predictions missing');

  if (JSON.stringify(state).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const byId = Object.fromEntries(state.predictions.map((p) => [p.id, p]));
  for (const [id, tail] of Object.entries(RESTORE)) {
    const p = byId[id];
    if (!p) throw new Error(`restore target missing: ${id}`);
    if (!p.check.includes(tail.trim().slice(0, 40))) p.check += tail;
  }
  for (const [id, tail] of Object.entries(APPEND)) {
    const p = byId[id];
    if (!p) throw new Error(`append target missing: ${id}`);
    p.check += tail;
  }
  const scored = byId[SCORE.id];
  if (!scored) throw new Error(`score target missing: ${SCORE.id}`);
  Object.assign(scored, SCORE);
  state.openNote = OPEN_NOTE;

  const open = state.predictions.filter((p) => p.status === 'open').length;
  const hit = state.predictions.filter((p) => p.status === 'hit').length;
  console.log(`  ${DRY ? '[dry] ' : ''}v${rows[0].version} -> minor; ${hit} hit, ${open} open`);

  const json = JSON.stringify(state);
  console.log(`  state ${json.length} bytes`);
  if (DRY) return;
  const r = spawnSync('node', ['scripts/week-in-review.mjs', 'write', json],
    { cwd: new URL('..', import.meta.url).pathname, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`week-in-review write exited ${r.status}`);
});
