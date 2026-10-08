import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { trackAiBot } from 'wiki-formant/crawlers';

// The roster is `wiki-formant/crawlers`, shared with robots.ts, which used to
// keep a second and different list of the same thing. track.ts is loaded only
// for a bot: it pulls in Prisma, which a static import would load for every
// request the proxy sees.
export function proxy(request: NextRequest, event: NextFetchEvent) {
  trackAiBot(request, event, () => import('@/lib/track'));
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
