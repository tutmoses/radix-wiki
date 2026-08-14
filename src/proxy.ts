import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { plausibleEvent } from '@/lib/track';

// Applebot-Extended is deliberately absent: it never fetches pages — it is a
// robots.txt-only token that Applebot checks before using crawled data for AI.
const AI_BOTS: Record<string, string> = {
  'GPTBot': 'GPTBot',
  'ChatGPT-User': 'ChatGPT',
  'OAI-SearchBot': 'OAISearchBot',
  'ClaudeBot': 'ClaudeBot',
  'Claude-Web': 'ClaudeBot',
  'Claude-User': 'ClaudeUser',
  'Claude-SearchBot': 'ClaudeSearchBot',
  'PerplexityBot': 'PerplexityBot',
  'Perplexity-User': 'PerplexityUser',
  'Amazonbot': 'Amazonbot',
  'Google-Extended': 'GoogleExtended',
  'Bytespider': 'Bytespider',
  'CCBot': 'CCBot',
  'cohere-ai': 'CohereBot',
  'Meta-ExternalAgent': 'MetaExternalAgent',
  'Meta-ExternalFetcher': 'MetaExternalFetcher',
  'MistralAI-User': 'MistralAI',
  'DuckAssistBot': 'DuckAssistBot',
};

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const ua = request.headers.get('user-agent') || '';
  const bot = Object.entries(AI_BOTS).find(([pattern]) => ua.includes(pattern));
  if (!bot) return NextResponse.next();

  const [, botName] = bot;

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
