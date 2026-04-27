// src/components/charts/TokensView.tsx — /charts/tokens

import Link from 'next/link';
import { Coins, ArrowLeft } from 'lucide-react';
import { getTopTokens } from '@/lib/radix/tokens';
import { TokensTable } from './TokensTable';

export default async function TokensView() {
  const tokens = await getTopTokens(100);

  return (
    <div className="stack">
      <div className="stack-sm">
        <Link href="/charts" className="charts-section-link">
          <ArrowLeft size={14} /> Charts
        </Link>
        <div className="row">
          <Coins size={24} className="text-accent" />
          <h1>Tokens</h1>
        </div>
        <p className="text-text-muted">
          Top {tokens.length} tokens on Radix by total value locked. Prices and volume from OciSwap.
        </p>
      </div>
      <TokensTable tokens={tokens} />
    </div>
  );
}
