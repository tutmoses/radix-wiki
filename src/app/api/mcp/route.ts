// src/app/api/mcp/route.ts — Radix Wiki MCP server (Streamable HTTP transport).
//
// The protocol edges live in `wiki-formant/mcp`, the tool manifest in
// @/lib/mcp-tools, and the handlers in @/lib/mcp-server. This file is the
// route: the rate limit, the browser redirect, and the CORS preflight.

import { NextRequest } from 'next/server';
import { mcpResponse, mcpOptions, mcpGet, withMcpCors } from 'wiki-formant/mcp';
import { serverConfig } from '@/lib/mcp-server';
import { BASE_URL } from '@/lib/utils';
import { checkRateLimit } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const OPTIONS = mcpOptions;
export const GET = () => mcpGet(`${BASE_URL}/AGENTS.md`);

export async function POST(request: NextRequest) {
  // Anonymous and `force-dynamic`, so every call is a fresh query. Budget
  // generously — an agent legitimately fans out across pages in a burst — but
  // not unboundedly. Stated in the initialize instructions.
  const capped = checkRateLimit(request, 'mcp', { capacity: 60, refillPerSec: 1 });
  if (capped) return withMcpCors(capped);

  return mcpResponse(request, serverConfig(request.headers.get('Authorization')));
}
