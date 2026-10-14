// src/components/SiteStats.tsx – the wiki's own analytics, behind a passkey.
// The figures are the ones radix-studio's stats.mjs reads, with the same handle
// and sibling sites.

import { cookies } from 'next/headers';
import { digest } from 'wiki-formant/analytics';
import { Stats, StatsGate, statsQuery } from 'wiki-formant/stats';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { gate } from '@/lib/admin';
import { SITE_URL } from '@/lib/site';
import { sql } from '@/lib/track';

const SIBLINGS = ['caper.network', 'acuiq.com', 'miow.me'];

export default async function SiteStats({ query, invite }: { query: Record<string, string | string[] | undefined>; invite?: string | undefined }) {
  const q = statsQuery(query);

  return (
    <div className="stack">
      <Breadcrumbs path={['stats']} leafTitle="Stats" />
      <h1 id="stats">Stats</h1>
      <StatsGate
        gate={gate}
        session={(await cookies()).get(gate.cookie)?.value}
        invite={invite}
        host={new URL(SITE_URL).host}
        classNames={{ text: 'text-text-muted', actions: 'stack-sm items-start', button: 'btn btn-primary', error: 'text-error' }}
      >
        {async () => <Stats digest={await digest(sql, { ...q, handle: 'radixwiki', siblings: SIBLINGS })} {...q} />}
      </StatsGate>
    </div>
  );
}
