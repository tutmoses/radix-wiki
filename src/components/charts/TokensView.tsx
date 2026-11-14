// src/components/charts/TokensView.tsx – /charts/tokens

import { Coins } from 'lucide-react';
import { getTopTokens, TOP_TOKENS_LIMIT } from '@/lib/radix/tokens';
import { PageHeading } from '@/components/PageHeading';
import { TokensTable } from './TokensTable';
import { tokenRows } from './rows';
import { JsonLd } from 'wiki-formant/react-server';
import { collectionLd } from 'wiki-formant/metadata';
import { SITE_REFS, SITE_URL } from '@/lib/site';

export default async function TokensView() {
  const tokens = await getTopTokens().catch(() => null);
  const rows = tokens && await tokenRows(tokens);

  return (
    <div className="stack">
      {tokens && tokens.length > 0 && <JsonLd data={collectionLd({
        name: 'Radix tokens', url: `${SITE_URL}/charts/tokens`, isPartOf: SITE_REFS.website,
        description: `The ${TOP_TOKENS_LIMIT} highest-ranked tokens on OciSwap by 24-hour volume, each with its price, supply and holders.`,
        items: tokens.map(t => ({ name: t.symbol ? `${t.name} (${t.symbol})` : t.name, url: `${SITE_URL}/charts/tokens/${t.address}` })),
      })} />}
      <PageHeading icon={Coins} id="tokens" title="Tokens" back={{ href: '/charts', label: 'Charts' }} description={<>
        {tokens ? `${tokens.length} of OciSwap's ${TOP_TOKENS_LIMIT} highest-ranked tokens traded in the last 24 hours, sorted by volume.` : `OciSwap's ${TOP_TOKENS_LIMIT} highest-ranked tokens that traded in the last 24 hours, sorted by volume.`} Prices and volume from OciSwap.
      </>} />
      <TokensTable tokens={rows} />
    </div>
  );
}
