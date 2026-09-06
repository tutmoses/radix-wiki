// src/components/charts/ValidatorsView.tsx — /charts/validators

import Link from 'next/link';
import { Server, ArrowLeft } from 'lucide-react';
import { getValidators } from '@/lib/radix/validators';
import { ValidatorsTable } from './ValidatorsTable';
import LedgerUnavailable from './LedgerUnavailable';
import { formatXrd } from './format';

export default async function ValidatorsView() {
  const validators = await getValidators().catch(() => null);
  const total = validators?.reduce((s, v) => s + v.totalStake, 0) ?? 0;
  const active = validators?.filter(v => v.isRegistered && v.totalStake > 0).length ?? 0;

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
        {validators && (
          <p className="text-text-muted">
            {active} active validators securing {formatXrd(total)} in total stake. Click any column to sort.
          </p>
        )}
      </div>
      {validators
        ? <ValidatorsTable validators={validators} />
        : <LedgerUnavailable what="The validator directory" />}
    </div>
  );
}
