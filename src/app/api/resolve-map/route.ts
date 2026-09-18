// src/app/api/resolve-map/route.ts — resolves a Google Maps short link to its
// embeddable target for the editor, which cannot read the redirect cross-origin.
//
// The whole route is `wiki-formant/maps`: exact shortlink hosts, one manual hop,
// an anchored Google landing-host check and a 5s timeout. Signed-in only, to
// keep the outbound fetch off an anonymous surface; only the editor calls it.

import type { NextRequest } from 'next/server';
import { resolveMapHandler } from 'wiki-formant/maps';
import { requireAuth } from '@/lib/api';

export const GET = resolveMapHandler({
  authorize: async request => !('error' in (await requireAuth(request as NextRequest))),
});
