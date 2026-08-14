// src/lib/track.ts — server-side Plausible events, shared by the proxy
// ("AI Bot Visit") and the MCP route ("MCP Call") so the two never drift.

import { after } from 'next/server';
import type { NextRequest } from 'next/server';

// Hostname the Plausible property is registered under.
export const PLAUSIBLE_DOMAIN = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki').hostname; }
  catch { return 'radix.wiki'; }
})();

// The exact request shape Plausible's events API expects. Callers decide how
// to defer it (event.waitUntil in the proxy vs after() in routes).
export function plausibleEvent(
  name: string,
  url: string,
  props: Record<string, string>,
  headers: Headers,
): Promise<unknown> {
  return fetch('https://plausible.io/api/event', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; BotTracker/1.0)',
      'X-Forwarded-For':
        headers.get('x-forwarded-for') || headers.get('x-real-ip') || '127.0.0.1',
    },
    body: JSON.stringify({
      name,
      url,
      domain: PLAUSIBLE_DOMAIN,
      props: JSON.stringify(props),
    }),
  }).catch(() => {});
}

// Tool-level MCP analytics. UA matching in the proxy can't see inside the
// JSON-RPC envelope, so this is the only place tool names are countable.
// Fired via after() so it never blocks the response; body is untrusted, so
// every extraction is defensive.
export function trackMcpCall(request: NextRequest, server: string, body: unknown) {
  const first = (Array.isArray(body) ? body[0] : body) as
    | { method?: unknown; params?: { name?: unknown } }
    | undefined;
  const method = typeof first?.method === 'string' ? first.method : 'unknown';
  const tool = typeof first?.params?.name === 'string' ? first.params.name : undefined;
  const ua = (request.headers.get('user-agent') || 'unknown').slice(0, 80);
  const url = request.nextUrl.href;
  const headers = request.headers;
  after(() =>
    plausibleEvent('MCP Call', url, { server, method, ...(tool ? { tool } : {}), ua }, headers),
  );
}
