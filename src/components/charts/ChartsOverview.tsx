// src/components/charts/ChartsOverview.tsx — /charts dashboard

import Link from 'next/link';
import { ArrowRight, Activity, Coins, Server, BarChart3 } from 'lucide-react';
import { getNetworkStats, type NetworkStats } from '@/lib/radix/network';
import { getValidators, type Validator } from '@/lib/radix/validators';
import { getTopTokens } from '@/lib/radix/tokens';
import { ValidatorsTable } from './ValidatorsTable';
import { TokensTable } from './TokensTable';
import LedgerUnavailable from './LedgerUnavailable';
import { formatXrd, formatCompact } from './format';

function statCards(stats: NetworkStats) {
  return [
    { icon: Server, value: String(stats.activeValidatorCount), label: `Active validators, of ${stats.registeredValidatorCount} registered` },
    { icon: Coins, value: formatXrd(stats.totalStake), label: 'Total stake' },
    { icon: Activity, value: formatXrd(stats.xrdSupply), label: '$XRD supply' },
    { icon: Activity, value: formatCompact(stats.currentEpoch), label: 'Epoch' },
    { icon: Activity, value: formatCompact(stats.ledgerStateVersion), label: 'State version' },
  ];
}

export default async function ChartsOverview() {
  // Token prices come from OciSwap and survive a Gateway that will not answer state
  // reads, so they are fetched apart from the ledger pair and still render alone.
  const [ledger, tokens] = await Promise.all([
    Promise.all([getNetworkStats(), getValidators()])
      .then(([stats, validators]): { stats: NetworkStats; validators: Validator[] } => ({ stats, validators }))
      .catch(() => null),
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
          Live Radix network statistics, validator directory, and ecosystem token data.
        </p>
      </div>

      {ledger ? (
        <div className="charts-stat-grid">
          {statCards(ledger.stats).map(({ icon: Icon, value, label }) => (
            <div key={label} className="stat-card">
              <Icon size={18} className="text-text-muted" />
              <span className="stat-value">{value}</span>
              <span className="text-small text-text-muted">{label}</span>
            </div>
          ))}
        </div>
      ) : (
        <LedgerUnavailable what="Live network data" />
      )}

      <section className="stack-sm">
        <div className="spread">
          <h2 className="charts-section-title">Top tokens</h2>
          <Link href="/charts/tokens" className="charts-section-link">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <TokensTable tokens={tokens} limit={10} />
      </section>

      {ledger && (
        <section className="stack-sm">
          <div className="spread">
            <h2 className="charts-section-title">Top validators</h2>
            <Link href="/charts/validators" className="charts-section-link">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <ValidatorsTable validators={ledger.validators} limit={10} />
        </section>
      )}

      <p className="text-text-muted text-small">
        Data updates every 1–5 minutes. Validator and network data: Radix Gateway. Token prices: OciSwap.
      </p>
    </div>
  );
}
