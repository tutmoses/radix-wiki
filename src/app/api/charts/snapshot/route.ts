// src/app/api/charts/snapshot/route.ts – one week's on-chain reading, for scripts/network-snapshot.mjs
//
// This route exists so the weekly snapshot and /charts share one implementation. A .mjs
// script calling the Gateway itself would need its own fee parser, and a second fee parser
// is exactly how /charts came to publish the stored fee instead of the charged one.

import { NextResponse } from 'next/server';
import { getNetworkStats } from '@/lib/radix/network';
import { getDexStats } from '@/lib/radix/tokens';

export const revalidate = 300;

export async function GET() {
  let stats, dex;
  try {
    [stats, dex] = await Promise.all([getNetworkStats(), getDexStats()]);
  } catch (err) {
    // 200-with-zeros is the one answer this route must never give: the weekly snapshot
    // stores whatever it returns, so an unreadable ledger would enter the wiki's record
    // as a week in which the network had no validators and no stake.
    return NextResponse.json(
      { error: 'ledger unavailable', reason: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }

  const { validators, staking } = stats;
  const active = validators.filter((v) => v.isActive);
  const feeDivergent = validators.filter((v) => Math.abs(v.fee - v.storedFee) > 1e-12);
  const pendingFeeChanges = validators
    .filter((v) => v.feeChange)
    .map((v) => ({
      address: v.address,
      name: v.name,
      epoch: v.feeChange!.epoch,
      fee: v.feeChange!.fee,
      currentFee: v.fee,
      stake: Math.round(v.totalStake),
    }))
    .sort((a, b) => a.epoch - b.epoch);

  return NextResponse.json({
    capturedAt: new Date().toISOString(),
    epoch: stats.epoch,
    stateVersion: stats.stateVersion,
    validators: validators.length,
    registered: staking.registered,
    active: staking.active,
    totalStake: Math.round(staking.totalStake),
    activeStake: Math.round(staking.activeStake),
    xrdSupply: Math.round(stats.xrdSupply),
    nakamoto: staking.nakamoto,
    top10Share: staking.top10Share,
    ociswap: dex,
    // Reconciliation inputs for the weekly finding: see the radix-week-in-review skill.
    feeDivergentCount: feeDivergent.length,
    feeDivergentActiveCount: feeDivergent.filter((v) => v.isActive).length,
    feeDivergentActiveStake: Math.round(
      feeDivergent.filter((v) => v.isActive).reduce((s, v) => s + v.totalStake, 0),
    ),
    pendingFeeChanges,
    top25: active.slice(0, 25).map((v) => [v.address, Math.round(v.totalStake), v.fee] as const),
  });
}
