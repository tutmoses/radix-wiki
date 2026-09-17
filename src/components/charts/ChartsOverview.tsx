// src/components/charts/ChartsOverview.tsx – /charts dashboard

import Link from 'next/link';
import { ArrowRight, Activity, Coins, Server, BarChart3 } from 'lucide-react';
import { getNetworkStats, type NetworkStats } from '@/lib/radix/network';
import { getTopTokens } from '@/lib/radix/tokens';
import { ValidatorsTable } from './ValidatorsTable';
import { TokensTable } from './TokensTable';
import LedgerUnavailable from './LedgerUnavailable';
import StatGrid, { type Stat } from './StatGrid';
import { formatXrd, formatCompact } from './format';

function statCards({ staking, xrdSupply, epoch, stateVersion }: NetworkStats): Stat[] {
  return [
    { icon: Server, value: String(staking.active), label: `Active validators, of ${staking.registered} registered` },
    { icon: Coins, value: formatXrd(staking.totalStake), label: 'Total stake' },
    { icon: Activity, value: formatXrd(xrdSupply), label: '$XRD supply' },
    { icon: Activity, value: formatCompact(epoch), label: 'Epoch' },
    { icon: Activity, value: formatCompact(stateVersion), label: 'State version' },
  ];
}

export default async function ChartsOverview() {
  // Token prices come from OciSwap and survive a Gateway that will not answer state
  // reads, so they are fetched apart from the ledger and still render alone.
  const [stats, tokens] = await Promise.all([getNetworkStats().catch(() => null), getTopTokens()]);

  return (
    <div className="stack">
      <div className="stack-sm">
        <div className="row">
          <BarChart3 size={24} className="text-accent" />
          <h1 id="charts">Charts</h1>
        </div>
        <p className="text-text-muted">
          Live Radix network statistics, validator directory, and ecosystem token data.
        </p>
      </div>

      {stats ? <StatGrid stats={statCards(stats)} /> : <LedgerUnavailable what="Live network data" />}

      <section className="stack-sm">
        <div className="spread">
          <h2 id="top-tokens" className="charts-section-title">Top tokens</h2>
          <Link href="/charts/tokens" className="charts-section-link">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <TokensTable tokens={tokens} limit={10} />
      </section>

      {stats && (
        <section className="stack-sm">
          <div className="spread">
            <h2 id="top-validators" className="charts-section-title">Top validators</h2>
            <Link href="/charts/validators" className="charts-section-link">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <ValidatorsTable validators={stats.validators} limit={10} />
        </section>
      )}

      <p className="text-text-muted text-small">
        Data updates every 1–5 minutes. Validator and network data: Radix Gateway. Token prices: OciSwap.
      </p>
    </div>
  );
}
