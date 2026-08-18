// src/app/api/charts/snapshot/route.ts — one week's on-chain reading, for scripts/network-snapshot.mjs
//
// This route exists so the weekly snapshot and /charts share one implementation. A .mjs
// script calling the Gateway itself would need its own fee parser, and a second fee parser
// is exactly how /charts came to publish the stored fee instead of the charged one.

import { NextResponse } from 'next/server';
import { getNetworkStats } from '@/lib/radix/network';
import { getValidators } from '@/lib/radix/validators';
import { getDexStats } from '@/lib/radix/tokens';

export const revalidate = 300;

/** Validators needed to exceed a third of active stake — the threshold that can halt consensus. */
function nakamoto(stakes: number[]): number {
  const total = stakes.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const third = total / 3;
  let running = 0;
  for (let i = 0; i < stakes.length; i++) {
    running += stakes[i]!;
    if (running > third) return i + 1;
  }
  return stakes.length;
}

export async function GET() {
  const [stats, validators, dex] = await Promise.all([
    getNetworkStats(),
    getValidators(),
    getDexStats(),
  ]);

  // `active` is the consensus set (active_in_epoch); `registered` is the wider set that has
  // registered and holds stake. They are different numbers and mean different things.
  const active = validators.filter((v) => v.isActive);
  const activeStakes = active.map((v) => v.totalStake).sort((a, b) => b - a);
  const activeStake = activeStakes.reduce((a, b) => a + b, 0);

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
    epoch: stats.currentEpoch,
    stateVersion: stats.ledgerStateVersion,
    validators: validators.length,
    registered: validators.filter((v) => v.isRegistered && v.totalStake > 0).length,
    active: active.length,
    totalStake: Math.round(stats.totalStake),
    activeStake: Math.round(activeStake),
    xrdSupply: Math.round(stats.xrdSupply),
    nakamoto: nakamoto(activeStakes),
    top10Share: activeStake > 0
      ? Number(((activeStakes.slice(0, 10).reduce((a, b) => a + b, 0) / activeStake) * 100).toFixed(2))
      : 0,
    ociswap: dex,
    // Reconciliation inputs for the weekly finding — see the radix-week-in-review skill.
    feeDivergentCount: feeDivergent.length,
    feeDivergentActiveCount: feeDivergent.filter((v) => v.isActive).length,
    feeDivergentActiveStake: Math.round(
      feeDivergent.filter((v) => v.isActive).reduce((s, v) => s + v.totalStake, 0),
    ),
    pendingFeeChanges,
    top25: active.slice(0, 25).map((v) => [v.address, Math.round(v.totalStake), v.fee] as const),
  });
}
