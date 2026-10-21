// src/app/api/mcp/read/route.ts – the MCP server with its writes taken off, for
// the ChatGPT plugin (chatgpt/mcp.json names this URL).
//
// Plugin review refuses a tool its reviewers cannot run, and every write here
// needs a ROLA signature from the caller's own Radix key. `readOnly` keeps the
// read tools and drops the instruction line and prompt that teach the write
// flow; /api/mcp keeps all of it.

import { NextRequest } from 'next/server';
import { mcpResponse, mcpOptions, mcpGet, readOnly } from 'wiki-formant/mcp';
import { serverConfig } from '@/lib/mcp-server';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

export const OPTIONS = mcpOptions;
export const GET = () => mcpGet(`${SITE_URL}/AGENTS.md`);

export async function POST(request: NextRequest) {
  return mcpResponse(request, readOnly(serverConfig(request)));
}
