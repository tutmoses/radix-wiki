// src/lib/map-utils.ts - Map embed URL resolution

export function mapsEmbedUrl(lat: number, lon: number, zoom = 15): string {
  const d = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom) * 500;
  return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d${d.toFixed(1)}!2d${lon}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s!2s!5e0!3m2!1sen!2sus`;
}

function extractCoordsFromUrl(url: string): { lat: number; lon: number; zoom?: number } | null {
  const coords = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),?(\d+\.?\d*)?z?/);
  if (coords) return { lat: +coords[1], lon: +coords[2], zoom: coords[3] ? +coords[3] : undefined };
  const search = url.match(/\/search\/(-?\d+\.?\d*),[\s+]*(-?\d+\.?\d*)/);
  if (search) return { lat: +search[1], lon: +search[2] };
  try {
    const u = new URL(url);
    const ll = u.searchParams.get('ll') || u.searchParams.get('sll');
    if (ll) { const [lat, lon] = ll.split(',').map(Number); if (!isNaN(lat) && !isNaN(lon)) return { lat, lon }; }
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
    if (place) return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d5000!2d0!3d0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s!2s${encodeURIComponent(decodeURIComponent(place[1]).replace(/\+/g, ' '))}!5e0!3m2!1sen!2sus`;
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
