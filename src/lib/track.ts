// src/lib/track.ts — server-side Plausible events, shared by the proxy
// ("AI Bot Visit") and the MCP route ("MCP Call") so the two never drift.
//
// The event body and the JSON-RPC props extraction are
// `wiki-formant/analytics`, shared with the other wikis. What stays here is
// this wiki's domain and the Next deferral.

import { after } from 'next/server';
import { plausibleEvent as send, mcpCallProps, plausibleDomain } from 'wiki-formant/analytics';

// Hostname the Plausible property is registered under.
export const PLAUSIBLE_DOMAIN = plausibleDomain(process.env.NEXT_PUBLIC_APP_URL, 'radix.wiki');

// Callers decide how to defer it (event.waitUntil in the proxy vs after() in routes).
export function plausibleEvent(
  name: string,
  url: string,
  props: Record<string, string>,
  headers: Headers,
): Promise<unknown> {
  return send({ domain: PLAUSIBLE_DOMAIN }, name, url, props, headers);
}

// Tool-level MCP analytics. UA matching in the proxy can't see inside the
// JSON-RPC envelope, so this is the only place tool names are countable.
// Fired via after() so it never blocks the response.
export function trackMcpCall(request: Request, server: string, body: unknown) {
  const props = mcpCallProps(request, body, server);
  const { url, headers } = request;
  after(() => plausibleEvent('MCP Call', url, props, headers));
}
