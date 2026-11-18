// src/app/api/trollbox/me/route.ts – what the reader may do in the room, asked once when it opens.

import { NextRequest } from 'next/server';
import { handleRoute, json } from 'wiki-formant/http';
import { gate } from '@/lib/admin';
import { getSession } from '@/lib/auth';
import type { Me } from '@/lib/trollbox';
import { HOLDER_XRD, mutedUntil, weightOf } from '@/lib/trollbox/server';

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const [session, admin] = await Promise.all([getSession(request), gate.allows(request)]);
    if (!session) return json({ holder: false, admin, mutedUntil: null } satisfies Me);
    const [holder, muted] = await Promise.all([
      // An unread wallet is not a wallet below the bar: the room says so rather than hiding the flag.
      weightOf(session.userId).then(weight => weight >= HOLDER_XRD, () => null),
      mutedUntil(session.userId),
    ]);
    return json({ holder, admin, mutedUntil: muted?.toISOString() ?? null } satisfies Me);
  }, 'Your standing could not be read');
}
