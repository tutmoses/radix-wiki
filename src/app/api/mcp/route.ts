// src/app/api/mcp/route.ts — Radix Wiki MCP server (Streamable HTTP transport).
//
// The protocol edges live in `wiki-formant/mcp`, the tool manifest in
// @/lib/mcp-tools, and the handlers in @/lib/mcp-server. This file is the
// route: the rate limit, the browser redirect, and the CORS preflight.

import { NextRequest } from 'next/server';
import { mcpResponse, mcpOptions, mcpGet, mcpRateLimited } from 'wiki-formant/mcp';
import { withRateLimit } from 'wiki-formant/rate-limit';
import { serverConfig } from '@/lib/mcp-server';
import { BASE_URL } from '@/lib/utils';
import { MCP_RATE_LIMIT_PER_MIN, rateLimitVerdict } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const OPTIONS = mcpOptions;
export const GET = () => mcpGet(`${BASE_URL}/AGENTS.md`);

export async function POST(request: NextRequest) {
  // Anonymous and `force-dynamic`, so every call is a fresh query. Budget
  // generously — an agent legitimately fans out across pages in a burst — but
  // not unboundedly. Stated in the initialize instructions.
  //
  // The refusal is a JSON-RPC envelope, not a bare `{error: "..."}`: a client
  // that meets this is mid-fan-out and parsing every response as JSON-RPC, so a
  // string where it expects `{code, message}` is the one refusal it cannot read.
  const budget = { capacity: MCP_RATE_LIMIT_PER_MIN, refillPerSec: MCP_RATE_LIMIT_PER_MIN / 60 };
  const limit = rateLimitVerdict(request, 'mcp', budget);
  if (!limit.ok) return mcpRateLimited(limit.retryAfterSec);

  // The headroom rides on the 200s too. Stating the budget only in the 429
  // means an agent can find it only by exceeding it, which is the one moment
  // it is least able to act on the answer.
  return withRateLimit(
    await mcpResponse(request, serverConfig(request.headers.get('Authorization'))),
    limit,
    budget,
  );
}
