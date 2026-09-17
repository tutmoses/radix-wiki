// src/components/charts/TokensView.tsx – /charts/tokens

import Link from 'next/link';
import { Coins, ArrowLeft } from 'lucide-react';
import { getTopTokens, TOP_TOKENS_LIMIT } from '@/lib/radix/tokens';
import { TokensTable } from './TokensTable';

export default async function TokensView() {
  const tokens = await getTopTokens();

  return (
    <div className="stack">
      <div className="stack-sm">
        <Link href="/charts" className="charts-section-link">
          <ArrowLeft size={14} /> Charts
        </Link>
        <div className="row">
          <Coins size={24} className="text-accent" />
          <h1 id="tokens">Tokens</h1>
        </div>
        <p className="text-text-muted">
          {tokens.length} of OciSwap's {TOP_TOKENS_LIMIT} highest-ranked tokens traded in the last 24 hours, sorted by volume. Prices and volume from OciSwap.
        </p>
      </div>
      <TokensTable tokens={tokens} />
    </div>
  );
}
