// src/lib/map-utils.ts — map embed URL resolution.
//
// The URL parsing is `wiki-formant/maps`, shared with caper, which held a
// byte-identical copy. What stays here is the client-side redirect hop, which
// needs this app's own API route.

export { toMapEmbedUrl, mapsEmbedUrl } from 'wiki-formant/maps';

import { toMapEmbedUrl, isShortMapUrl } from 'wiki-formant/maps';

/**
 * Resolve a pasted map URL to an embeddable one, following a shortener through
 * /api/resolve-map when the URL cannot be read directly.
 */
export async function resolveMapUrl(url: string): Promise<string | null> {
  const sync = toMapEmbedUrl(url);
  if (sync) return sync;
  if (isShortMapUrl(url)) {
    try {
      const res = await fetch(`/api/resolve-map?url=${encodeURIComponent(url)}`);
      const { resolved } = await res.json();
      if (resolved) return toMapEmbedUrl(resolved);
    } catch {
      /* fall through */
    }
  }
  return null;
}
