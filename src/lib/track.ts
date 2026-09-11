// src/lib/track.ts — server-side Plausible events, shared by the proxy
// ("AI Bot Visit"), the MCP route ("MCP Call") and the wiki search endpoint
// ("Search Query") so the three never drift.
//
// The event body and the JSON-RPC props extraction are
// `wiki-formant/analytics`, shared with the other wikis. What stays here is
// this wiki's domain and the Next deferral.

import { after } from 'next/server';
import { BASE_URL } from '@/lib/utils';
import { plausibleEvent as send, mcpCallProps, searchQueryProps, plausibleDomain, type PlausibleExtra } from 'wiki-formant/analytics';

// Hostname the Plausible property is registered under.
export const PLAUSIBLE_DOMAIN = plausibleDomain(process.env.NEXT_PUBLIC_APP_URL, 'radix.wiki');

// Callers decide how to defer it (event.waitUntil in the proxy vs after() in routes).
export function plausibleEvent(
  name: string,
  url: string,
  props: Record<string, string>,
  headers: Headers,
  extra?: PlausibleExtra,
): Promise<unknown> {
  return send({ domain: PLAUSIBLE_DOMAIN }, name, url, props, headers, extra);
}

// Tool-level MCP analytics. UA matching in the proxy can't see inside the
// JSON-RPC envelope, so this is the only place tool names are countable.
// Fired via after() so it never blocks the response.
export function trackMcpCall(request: Request, server: string, body: unknown) {
  const props = mcpCallProps(request, body, server);
  const { url, headers } = request;
  after(() => plausibleEvent('MCP Call', url, props, headers));
}

// Human search analytics, the twin of trackMcpCall. Without it this wiki counts
// every question an agent asks and none of the questions a person asks, and the
// zero-result queries are the ones worth having: they name a gap in the corpus
// in the reader's own words, which is otherwise only ever guessed at.
//
// Called from the one GET that serves the search box, so it sees the settled
// query the typeahead debounce dispatched rather than every keystroke. `total`
// is the match count before pagination — the page-one slice would report zero
// only for a genuinely empty result anyway, but the filter that yields the gap
// list reads `results == "0"` and must not be confused by a deep page.
export function trackSearch(request: Request, query: string, results: number) {
  const props = searchQueryProps({ query, results, surface: 'wiki' });
  if (!props) return;
  const { headers } = request;
  // The referer is the page the reader searched from; the search endpoint's own
  // URL would file every query against /api/wiki.
  const url = headers.get('referer') || BASE_URL;
  after(() => plausibleEvent('Search Query', url, props, headers, {
    // A person triggered this, so send their own user agent and let the event
    // join their session. The bot-tracker default would file every search as a
    // separate pseudo-visitor and inflate the very human lane this explains.
    userAgent: headers.get('user-agent') ?? undefined,
  }));
}
