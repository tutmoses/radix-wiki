// src/app/api/mcp/server-card/route.ts — MCP Server Card.
//
// Pre-connection discovery: lets a client learn who this server is and how to
// reach it without opening a session. Served at <mcp-url>/server-card, the
// location the Server Card extension recommends.
//
// Status: the extension is a DRAFT (SEP-1649 / SEP-2127) and its location has
// already moved once, from /.well-known/mcp.json to this path. It is served
// here only because it costs nothing to keep correct — identity comes from
// package.json and the endpoint from BASE_URL, so there is no third copy of
// anything to drift. If the draft moves again, move this route; if it dies,
// delete it. Cards deliberately omit tool listings — that is what tools/list
// is for.

import { NextResponse } from 'next/server';
import { BASE_URL } from '@/lib/utils';
import { SERVER_INFO } from '@/lib/mcp-tools';

export const revalidate = 86400;

const SERVER_CARD = {
  $schema: 'https://static.modelcontextprotocol.io/schemas/draft/server-card.schema.json',
  name: 'wiki.radix/radix-wiki',
  title: 'Radix Wiki',
  description:
    'Community-maintained knowledge base for Radix DLT. Search and read the corpus, track the Radix DAO ideas board, and — with a ROLA bearer token — create and edit pages.',
  version: SERVER_INFO.version,
  websiteUrl: BASE_URL,
  remotes: [
    {
      type: 'streamable-http',
      url: `${BASE_URL}/api/mcp`,
      supportedProtocolVersions: ['2025-03-26'],
    },
  ],
};

export async function GET() {
  return NextResponse.json(SERVER_CARD, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
