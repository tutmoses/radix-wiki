// src/components/charts/ChartsOverview.tsx — /charts dashboard

import Link from 'next/link';
import { ArrowRight, Activity, Coins, Server, BarChart3 } from 'lucide-react';
import { getNetworkStats } from '@/lib/radix/network';
import { getValidators } from '@/lib/radix/validators';
import { getTopTokens } from '@/lib/radix/tokens';
import { ValidatorsTable } from './ValidatorsTable';
import { TokensTable } from './TokensTable';
import { formatXrd, formatCompact } from './format';

export default async function ChartsOverview() {
  const [stats, validators, tokens] = await Promise.all([
    getNetworkStats(),
    getValidators(),
    getTopTokens(50),
  ]);

  const STAT_CARDS = [
    { icon: Server, value: stats.activeValidatorCount, label: `Active validators, of ${stats.registeredValidatorCount} registered` },
    { icon: Coins, value: formatXrd(stats.totalStake), label: 'Total stake' },
    { icon: Activity, value: formatXrd(stats.xrdSupply), label: 'XRD supply' },
    { icon: Activity, value: formatCompact(stats.currentEpoch), label: 'Epoch' },
    { icon: Activity, value: formatCompact(stats.ledgerStateVersion), label: 'State version' },
  ];

  return (
    <div className="stack">
      <div className="stack-sm">
        <div className="row">
          <BarChart3 size={24} className="text-accent" />
          <h1>Charts</h1>
        </div>
        <p className="text-text-muted">
          Live Radix network statistics, validator directory, and ecosystem token data.
        </p>
      </div>

      <div className="charts-stat-grid">
        {STAT_CARDS.map(({ icon: Icon, value, label }) => (
          <div key={label} className="stat-card">
            <Icon size={18} className="text-text-muted" />
            <span className="stat-value">{value}</span>
            <span className="text-small text-text-muted">{label}</span>
          </div>
        ))}
      </div>

      <section className="stack-sm">
        <div className="spread">
          <h2 className="charts-section-title">Top tokens</h2>
          <Link href="/charts/tokens" className="charts-section-link">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <TokensTable tokens={tokens} limit={10} />
      </section>

      <section className="stack-sm">
        <div className="spread">
          <h2 className="charts-section-title">Top validators</h2>
          <Link href="/charts/validators" className="charts-section-link">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <ValidatorsTable validators={validators} limit={10} />
      </section>

      <p className="text-text-muted text-small">
        Data updates every 1–5 minutes. Validator and network data: Radix Gateway. Token prices: OciSwap.
      </p>
    </div>
  );
}
