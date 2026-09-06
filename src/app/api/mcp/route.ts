// src/app/api/mcp/route.ts — Radix Wiki MCP server (Streamable HTTP transport).
//
// The protocol edges live in `wiki-formant/mcp`, the tool manifest in
// @/lib/mcp-tools, and the handlers in @/lib/mcp-server. This file is the
// route: the browser redirect and the CORS preflight. The rate limit is
// declared on the config and enforced by the package.

import { NextRequest } from 'next/server';
import { mcpResponse, mcpOptions, mcpGet } from 'wiki-formant/mcp';
import { serverConfig } from '@/lib/mcp-server';
import { BASE_URL } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const OPTIONS = mcpOptions;
export const GET = () => mcpGet(`${BASE_URL}/AGENTS.md`);

// The budget is declared on the config (`MCP_RATE_LIMIT` in @/lib/api) and
// enforced by `mcpResponse`: the JSON-RPC refusal, the pre-parse ordering and
// the headroom headers are one decision shared with the other agent surfaces,
// not four transcriptions of it.
export async function POST(request: NextRequest) {
  return mcpResponse(request, serverConfig(request.headers.get('Authorization')));
}
