import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';

const AI_BOTS: Record<string, string> = {
  'GPTBot': 'GPTBot',
  'ChatGPT-User': 'ChatGPT',
  'ClaudeBot': 'ClaudeBot',
  'Claude-Web': 'ClaudeBot',
  'PerplexityBot': 'PerplexityBot',
  'Amazonbot': 'Amazonbot',
  'Google-Extended': 'GoogleExtended',
  'Bytespider': 'Bytespider',
  'CCBot': 'CCBot',
  'cohere-ai': 'CohereBot',
};

const PLAUSIBLE_DOMAIN = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki').hostname; }
  catch { return 'radix.wiki'; }
})();

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const ua = request.headers.get('user-agent') || '';
  const bot = Object.entries(AI_BOTS).find(([pattern]) => ua.includes(pattern));
  if (!bot) return NextResponse.next();

  const [, botName] = bot;

  event.waitUntil(
    fetch('https://plausible.io/api/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; BotTracker/1.0)',
        'X-Forwarded-For': request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1',
      },
      body: JSON.stringify({
        name: 'AI Bot Visit',
        url: request.nextUrl.href,
        domain: PLAUSIBLE_DOMAIN,
        props: JSON.stringify({ bot: botName }),
      }),
    }).catch(() => {})
  );

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|js|favicon\\.ico|logo\\.png).*)'],
};
