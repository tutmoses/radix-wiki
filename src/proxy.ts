import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { plausibleEvent } from '@/lib/track';
import { detectAiBot } from 'wiki-formant/crawlers';


// The roster is `wiki-formant/crawlers`, shared with robots.ts, which used to
// keep a second and different list of the same thing.
export function proxy(request: NextRequest, event: NextFetchEvent) {
  const botName = detectAiBot(request.headers.get('user-agent'));
  if (!botName) return NextResponse.next();

  event.waitUntil(
    plausibleEvent('AI Bot Visit', request.nextUrl.href, { bot: botName }, request.headers),
  );

  return NextResponse.next();
}

export const config = {
  // The negative lookahead excludes /api wholesale, which would blind the
  // AI-bot counter to the machine surface — so the two agent-facing API
  // prefixes are matched back in explicitly.
  matcher: ['/((?!api|_next|js|favicon\\.ico|logo\\.png).*)', '/api/mcp', '/api/wiki/:path*'],
};
