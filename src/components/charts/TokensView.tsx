// src/components/charts/TokensView.tsx – /charts/tokens

import { Coins } from 'lucide-react';
import { getTopTokens, TOP_TOKENS_LIMIT } from '@/lib/radix/tokens';
import { PageHeading } from '@/components/PageHeading';
import { TokensTable } from './TokensTable';
import { tokenRows } from './rows';

export default async function TokensView() {
  const tokens = await getTopTokens().catch(() => null);
  const rows = tokens && await tokenRows(tokens);

  return (
    <div className="stack">
      <PageHeading icon={Coins} id="tokens" title="Tokens" back={{ href: '/charts', label: 'Charts' }} description={<>
        {tokens ? `${tokens.length} of OciSwap's ${TOP_TOKENS_LIMIT} highest-ranked tokens traded in the last 24 hours, sorted by volume.` : `OciSwap's ${TOP_TOKENS_LIMIT} highest-ranked tokens that traded in the last 24 hours, sorted by volume.`} Prices and volume from OciSwap.
      </>} />
      <TokensTable tokens={rows} />
    </div>
  );
}
