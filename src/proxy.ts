import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { detectAiBot } from 'wiki-formant/crawlers';


// The roster is `wiki-formant/crawlers`, shared with robots.ts, which used to
// keep a second and different list of the same thing.
export function proxy(request: NextRequest, event: NextFetchEvent) {
  const botName = detectAiBot(request.headers.get('user-agent'));
  if (!botName) return NextResponse.next();

  // Imported here, not at the top: track.ts pulls in Prisma, which a static
  // import would load for every request the proxy sees, bots or not.
  event.waitUntil(
    import('@/lib/track').then(m => m.trackEvent('AI Bot Visit', request.nextUrl.href, { bot: botName }, request.headers)),
  );

  return NextResponse.next();
}

export const config = {
  // The negative lookahead excludes /api wholesale, which would blind the
  // AI-bot counter to the machine surface – so the two agent-facing API
  // prefixes are matched back in explicitly. /api/view stays out: the beacon
  // is sent by browsers, and collect() drops bots itself. Each exclusion ends
  // at a slash or the path's end: a bare `api` also skipped pages like /apiary.
  matcher: ['/((?!api/|api$|_next/|favicon\\.ico$|logo\\.png$).*)', '/api/mcp', '/api/wiki/:path*'],
};
