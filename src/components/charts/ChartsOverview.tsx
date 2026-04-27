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

  return (
    <div className="stack">
      <div className="stack-sm">
        <div className="row">
          <BarChart3 size={24} className="text-accent" />
          <h1>Charts</h1>
        </div>
        <p className="text-text-muted">
          Live Radix network statistics, validator directory, and ecosystem token data. Continuing the
          mission of <a href="https://www.radixcharts.com" rel="noopener" target="_blank" className="text-accent hover:underline">RadixCharts</a> with public, open data sourced directly from the
          Radix Gateway and OciSwap.
        </p>
      </div>

      <div className="charts-stat-grid">
        <div className="stat-card">
          <Server size={18} className="text-text-muted" />
          <span className="stat-value">{stats.activeValidatorCount}</span>
          <span className="text-small text-text-muted">Active validators</span>
        </div>
        <div className="stat-card">
          <Coins size={18} className="text-text-muted" />
          <span className="stat-value">{formatXrd(stats.totalStake)}</span>
          <span className="text-small text-text-muted">Total stake</span>
        </div>
        <div className="stat-card">
          <Activity size={18} className="text-text-muted" />
          <span className="stat-value">{formatXrd(stats.xrdSupply)}</span>
          <span className="text-small text-text-muted">XRD supply</span>
        </div>
        <div className="stat-card">
          <Activity size={18} className="text-text-muted" />
          <span className="stat-value">{formatCompact(stats.currentEpoch)}</span>
          <span className="text-small text-text-muted">Epoch</span>
        </div>
        <div className="stat-card">
          <Activity size={18} className="text-text-muted" />
          <span className="stat-value">{formatCompact(stats.ledgerStateVersion)}</span>
          <span className="text-small text-text-muted">State version</span>
        </div>
      </div>

      <section className="stack-sm">
        <div className="spread">
          <h2 className="charts-section-title">Top validators</h2>
          <Link href="/charts/validators" className="charts-section-link">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <ValidatorsTable validators={validators} limit={10} />
      </section>

      <section className="stack-sm">
        <div className="spread">
          <h2 className="charts-section-title">Top tokens</h2>
          <Link href="/charts/tokens" className="charts-section-link">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <TokensTable tokens={tokens} limit={10} />
      </section>

      <p className="text-text-muted text-small">
        Data updates every 1–5 minutes. Validator and network data: Radix Gateway. Token prices: OciSwap.
      </p>
    </div>
  );
}
