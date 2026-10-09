// sweep 561 — blog rotation. Score 2026-09-27-one-transaction-fees on /blog/week-in-review.
//
// The claim, recorded 27 September and due 11 October: the four fee increases queued in
// one transaction on 23 September take effect as queued (Radstakes 0.25 -> 0.4, RadixStake
// 0.149 -> 0.2989, Sirius and Polaris 0 -> 0.25) at epoch 347,421. Scored on the check as
// the claim wrote it:
//
//   POST https://mainnet.radixdlt.com/state/validators/list  (no at_ledger_state)
//   read 19:05 UTC 9 Oct -> HTTP 200, epoch 348,051, state version 561,990,122, 289 validators
//   Radstakes   effective_fee_factor.current 0.4     no pending           93,474,561 XRD
//   RadixStake  effective_fee_factor.current 0.2989  no pending          108,074,174 XRD
//   Sirius      effective_fee_factor.current 0.25    pending 0.5 @ 352,012  106,801,938 XRD
//   Polaris     effective_fee_factor.current 0.25    pending 0.5 @ 352,012   74,558,790 XRD
//   hit condition: all four at their queued value at an epoch >= 347,421 by 11 Oct.  HIT.
//
// The state is the page's machine state; week-in-review.mjs `write` re-renders the index
// from it and writes the revision row. Run:  node scripts/sweep-561-score-one-transaction-fees.mjs [--dry-run]

import { execFileSync } from 'node:child_process';

const DRY = process.argv.includes('--dry-run');
const ID = '2026-09-27-one-transaction-fees';
const run = (...a) => execFileSync('node', ['scripts/week-in-review.mjs', ...a], { encoding: 'utf8' });

const out = run('read');
const state = JSON.parse(out.slice(out.search(/^\{/m)));
const p = state.predictions.find((x) => x.id === ID);
if (!p) throw new Error(`${ID} not found`);
if (p.status !== 'open') {
  console.log(`  ${ID} already ${p.status} — no write`);
  process.exit(0);
}

Object.assign(p, {
  status: 'hit',
  resolved: '2026-10-09',
  resolvedIn: 'Wiki maintenance sweep, 9 October 2026',
  evidence:
    'Hit, two days before the due date. Read with no at_ledger_state at 19:05 UTC on 9 October 2026, ' +
    'POST /state/validators/list answers HTTP 200 at epoch 348,051, state version 561,990,122, and all four read ' +
    'effective_fee_factor.current at their queued value: Radstakes 0.4 on 93,474,561 XRD, RadixStake 0.2989 on ' +
    '108,074,174 XRD, Sirius 0.25 on 106,801,938 XRD and Polaris 0.25 on 74,558,790 XRD. None was withdrawn. ' +
    'The settling epoch 347,421 passed on 7 October. Sirius and Polaris now each carry a further pending ' +
    'fee_factor of 0.5, effective at epoch 352,012.',
});
state.scoring =
  'One claim settled on 9 October 2026: all four fee increases queued in one transaction on 23 September ' +
  'took effect as queued, Radstakes at 40%, RadixStake at 29.89%, and Sirius and Polaris at 25%.';

const args = ['write', JSON.stringify(state)];
if (DRY) args.push('--dry-run');
process.stdout.write(run(...args));
