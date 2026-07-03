// src/lib/map-utils.ts - Map embed URL resolution

export function mapsEmbedUrl(lat: number, lon: number, zoom = 15): string {
  return `https://maps.google.com/maps?q=${lat},${lon}&z=${zoom}&output=embed`;
}

function extractCoordsFromUrl(url: string): { lat: number; lon: number; zoom?: number } | null {
  const coords = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),?(\d+\.?\d*)?z?/);
  if (coords) return { lat: +coords[1]!, lon: +coords[2]!, zoom: coords[3] ? +coords[3] : undefined };
  const search = url.match(/\/search\/(-?\d+\.?\d*),[\s+]*(-?\d+\.?\d*)/);
  if (search) return { lat: +search[1]!, lon: +search[2]! };
  const data = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (data) return { lat: +data[1]!, lon: +data[2]! };
  try {
    const u = new URL(url);
    const ll = u.searchParams.get('ll') || u.searchParams.get('sll');
    if (ll) { const [lat, lon] = ll.split(',').map(Number); if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) return { lat, lon }; }
  } catch { /* not a valid URL */ }
  return null;
}

export function toMapEmbedUrl(url: string): string | null {
  if (/google\.[a-z.]+\/maps\/embed/.test(url)) return url;
  if (/embed\.apple\.com\/maps/.test(url)) return url;
  const c = extractCoordsFromUrl(url);
  if (c) return mapsEmbedUrl(c.lat, c.lon, c.zoom);
  if (/google\.[a-z.]+\/maps/.test(url)) {
    const place = url.match(/\/place\/([^/@]+)/);
    if (place) return `https://maps.google.com/maps?q=${encodeURIComponent(decodeURIComponent(place[1]!).replace(/\+/g, ' '))}&output=embed`;
  }
  if (/maps\.apple\.com/.test(url)) {
    try {
      const u = new URL(url);
      const ll = u.searchParams.get('ll') || u.searchParams.get('sll');
      const q = u.searchParams.get('q') || u.searchParams.get('address');
      const params = new URLSearchParams();
      if (ll) params.set('ll', ll);
      if (q) params.set('q', q);
      return `https://embed.apple.com/maps?${params.toString()}`;
    } catch { return null; }
  }
  return null;
}

export async function resolveMapUrl(url: string): Promise<string | null> {
  const sync = toMapEmbedUrl(url);
  if (sync) return sync;
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(url)) {
    try {
      const res = await fetch(`/api/resolve-map?url=${encodeURIComponent(url)}`);
      const { resolved } = await res.json();
      if (resolved) return toMapEmbedUrl(resolved);
    } catch { /* fall through */ }
  }
  return null;
}
