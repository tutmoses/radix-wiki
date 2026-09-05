// src/app/.well-known/mcp.json/route.ts — MCP discovery manifest.
//
// The third of the three paths an arriving agent probes, after the agent card
// and the OpenAPI spec. Two of the three origins in this workspace served it
// and this one 404'd, so a client that probed here concluded the origin had no
// MCP server while /api/mcp was answering the whole time.
//
// The tools listed here ARE the JSON-RPC tools /api/mcp serves — the same
// manifest module, so the two cannot disagree.

import { descriptorResponse } from 'wiki-formant/http';
import { MCP_PROTOCOL_VERSION, MCP_PROTOCOL_VERSIONS } from 'wiki-formant/mcp';
import { SERVER_INFO, TOOLS } from '@/lib/mcp-tools';
import { MCP_RATE_LIMIT_TEXT } from '@/lib/api';
import { BASE_URL } from '@/lib/utils';
import serverManifest from '../../../../server.json';

export const revalidate = 86400;

const manifest = {
  schema_version: '1.0',
  name: 'Radix Wiki',
  registryName: serverManifest.name,
  version: SERVER_INFO.version,
  description:
    'Community-maintained knowledge base for Radix DLT. Reading is anonymous and free; writing takes a ROLA-signed token from your own Radix key.',
  url: BASE_URL,
  provider: { name: 'Radix Wiki', url: BASE_URL },
  api: { type: 'openapi', url: `${BASE_URL}/.well-known/openapi.json` },
  mcp: {
    endpoint: `${BASE_URL}/api/mcp`,
    transport: 'streamable-http',
    protocol: 'JSON-RPC 2.0',
    // Single-sourced from the transport that actually answers, so the manifest
    // cannot advertise a version the server does not speak.
    protocolVersion: MCP_PROTOCOL_VERSION,
    supportedProtocolVersions: MCP_PROTOCOL_VERSIONS,
    rateLimit: MCP_RATE_LIMIT_TEXT,
  },
  auth: {
    reads: 'none',
    writes: 'ROLA — get_challenge, sign with your own Ed25519 key, login, then Authorization: Bearer',
    documentationUrl: `${BASE_URL}/AGENTS.md`,
  },
  tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({
    name, title, description, inputSchema, annotations,
  })),
};

export async function GET(request: Request) {
  return descriptorResponse(request, manifest, { extra: { 'Access-Control-Allow-Origin': '*' } });
}
