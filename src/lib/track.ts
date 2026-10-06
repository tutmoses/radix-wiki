// src/lib/track.ts – server-side events, counted in this wiki's own database and
// shared by the proxy ("AI Bot Visit"), the MCP route ("MCP Call") and the wiki
// search endpoint ("Search Query") so the three never drift.
//
// `wiki-formant/analytics` owns the tables' SQL, the visitor hash and the props
// extraction; this binds it to Prisma. Page views arrive separately, from
// <Beacon> through POST /api/view.

import { after } from 'next/server';
import { SITE_URL } from '@/lib/site';
import { prisma } from '@/lib/prisma/client';
import { recordEvent, mcpCallProps, searchQueryProps, type Sql } from 'wiki-formant/analytics';

export const sql: Sql = (query, ...values) => prisma.$queryRawUnsafe(query, ...values);

// Dev and previews share production's database, so only production records.
// `headers` are the request of whoever caused the event, so it joins their
// visitor, agents included. Callers decide how to defer it (event.waitUntil in
// the proxy, after() in routes).
export function trackEvent(
  name: string,
  url: string,
  props: Record<string, string>,
  headers?: Headers,
): Promise<void> {
  if (process.env.VERCEL_ENV !== 'production') return Promise.resolve();
  return recordEvent(sql, { name, url, props, headers });
}

// Tool-level MCP analytics. UA matching in the proxy can't see inside the
// JSON-RPC envelope, so this is the only place tool names are countable.
// Fired via after() so it never blocks the response.
export function trackMcpCall(request: Request, server: string, body: unknown) {
  const props = mcpCallProps(request, body, server);
  const { url, headers } = request;
  after(() => trackEvent('MCP Call', url, props, headers));
}

// Human search analytics, the twin of trackMcpCall. Without it this wiki counts
// every question an agent asks and none of the questions a person asks, and the
// zero-result queries are the ones worth having: they name a gap in the corpus
// in the reader's own words, which is otherwise only ever guessed at.
//
// Called from the one GET that serves the search box, so it sees the settled
// query the typeahead debounce dispatched rather than every keystroke. `total`
// is the match count before pagination – the page-one slice would report zero
// only for a genuinely empty result anyway, but the filter that yields the gap
// list reads `results == "0"` and must not be confused by a deep page.
export function trackSearch(request: Request, query: string, results: number) {
  const props = searchQueryProps({ query, results, surface: 'wiki' });
  if (!props) return;
  const { headers } = request;
  // The referer is the page the reader searched from; the search endpoint's own
  // URL would file every query against /api/wiki. The reader's own headers make
  // the search join their visitor rather than count as a separate one.
  const url = headers.get('referer') || SITE_URL;
  after(() => trackEvent('Search Query', url, props, headers));
}
