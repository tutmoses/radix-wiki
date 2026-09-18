import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api';

// Short-link hosts we'll follow, and the Google Maps hosts a resolved link may
// land on (google.com, maps.google.com, www.google.co.uk, www.google.com.au).
// Exact hostname checks only: a substring test let `https://evil.example/?goo.gl`
// through, and caper's `google\.[a-z.]+` suffix still admits google.evil.com.
const SHORTLINK_HOSTS = new Set(['goo.gl', 'maps.app.goo.gl']);
const RESOLVED_HOST_RE = /^(?:www\.|maps\.)?google\.(?:com|com?\.[a-z]{2}|[a-z]{2})$/;

// Resolves a Google Maps short link to its embeddable target. The editor can't
// read the redirect cross-origin, so the server follows a SINGLE hop with a
// strict host allowlist (blind-SSRF guard) and a timeout. Signed-in only, to
// keep the outbound fetch off an anonymous surface; only the editor calls it.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return auth.error;

  let url: URL;
  try {
    url = new URL(req.nextUrl.searchParams.get('url') ?? '');
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }
  if (url.protocol !== 'https:' || !SHORTLINK_HOSTS.has(url.hostname)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: ctrl.signal });
    const location = res.headers.get('location');
    if (!location) return NextResponse.json({ error: 'Failed to resolve' }, { status: 502 });

    let resolved: URL;
    try {
      resolved = new URL(location, url);
    } catch {
      return NextResponse.json({ error: 'Failed to resolve' }, { status: 502 });
    }
    if (resolved.protocol !== 'https:' || !RESOLVED_HOST_RE.test(resolved.hostname)) {
      return NextResponse.json({ error: 'Disallowed redirect target' }, { status: 502 });
    }
    return NextResponse.json({ resolved: resolved.toString() });
  } catch {
    return NextResponse.json({ error: 'Failed to resolve' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
