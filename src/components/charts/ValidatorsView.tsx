// src/components/charts/ValidatorsView.tsx – /charts/validators

import Link from 'next/link';
import { ArrowLeft, CalendarClock, Coins, Crown, Percent, Scale, Server } from 'lucide-react';
import { getNetworkStats, type NetworkStats } from '@/lib/radix/network';
import { ValidatorsTable } from './ValidatorsTable';
import LedgerUnavailable from './LedgerUnavailable';
import StatGrid, { type Stat } from './StatGrid';
import { formatPercent, formatXrd } from './format';

function stakingCards({ staking, xrdSupply }: NetworkStats): Stat[] {
  return [
    { icon: Coins, value: formatXrd(staking.totalStake), label: `Staked, ${formatPercent((staking.totalStake / xrdSupply) * 100, 1)} of all $XRD` },
    { icon: Scale, value: String(staking.nakamoto), label: 'Validators holding a third of active stake' },
    { icon: Crown, value: formatPercent(staking.top10Share), label: 'Of active stake held by the largest 10' },
    { icon: Percent, value: formatPercent(staking.weightedFee * 100), label: 'Average fee on active stake' },
    { icon: CalendarClock, value: String(staking.pendingFeeChanges), label: 'Fee changes pending' },
  ];
}

export default async function ValidatorsView() {
  const stats = await getNetworkStats().catch(() => null);

  return (
    <div className="stack">
      <div className="stack-sm">
        <Link href="/charts" className="charts-section-link">
          <ArrowLeft size={14} /> Charts
        </Link>
        <div className="row">
          <Server size={24} className="text-accent" />
          <h1>Validators</h1>
        </div>
        {stats && (
          <p className="text-text-muted">
            {stats.staking.active} of the {stats.staking.registered} registered validators are validating this epoch. Click any column to sort.
          </p>
        )}
      </div>
      {stats ? (
        <>
          <StatGrid stats={stakingCards(stats)} />
          <ValidatorsTable validators={stats.validators} />
        </>
      ) : (
        <LedgerUnavailable what="The validator directory" />
      )}
    </div>
  );
}
