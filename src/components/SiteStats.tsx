// src/components/SiteStats.tsx – the wiki's own analytics, behind a passkey.
// The figures are the ones radix-studio's stats.py reads, with the same handle
// and sibling sites.

import { cookies } from 'next/headers';
import { digest } from 'wiki-formant/analytics';
import { PasskeyButton } from 'wiki-formant/passkey-button';
import { Stats, statsDays } from 'wiki-formant/stats';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { gate } from '@/lib/admin';
import { SITE_URL } from '@/lib/site';
import { sql } from '@/lib/track';

const SIBLINGS = ['caper.network', 'acuiq.com', 'miow.me'];

export default async function SiteStats({ days: param, invite }: { days?: string | undefined; invite?: string | undefined }) {
  const signedIn = await gate.signedIn((await cookies()).get(gate.cookie)?.value);
  const days = statsDays(param);
  const open = !signedIn && !invite && (await gate.open());

  return (
    <div className="stack">
      <Breadcrumbs path={['stats']} leafTitle="Stats" />
      <h1 id="stats">Stats</h1>
      {signedIn && !invite ? (
        <Stats digest={await digest(sql, { days, handle: 'radixwiki', siblings: SIBLINGS })} days={days} />
      ) : (
        <>
          <p className="text-text-muted">
            {invite
              ? `Save a passkey on this device to open ${new URL(SITE_URL).host}'s stats.`
              : open
                ? `No passkey is saved for ${new URL(SITE_URL).host} yet. Save the first one here; any after that needs an invite.`
                : 'Sign in with a passkey saved for this site.'}
          </p>
          <div className="stack-sm items-start">
            <PasskeyButton endpoint="/api/passkey" invite={invite} create={open} className="btn btn-primary" errorClassName="text-error" />
          </div>
        </>
      )}
    </div>
  );
}
