// src/app/.well-known/mcp.json/route.ts — MCP discovery manifest.
//
// The third of the three paths an arriving agent probes, after the agent card
// and the OpenAPI spec. Two of the three origins in this workspace served it
// and this one 404'd, so a client that probed here concluded the origin had no
// MCP server while /api/mcp was answering the whole time.
//
// The envelope, the protocol versions and the rate limit are `mcpManifest`,
// shared with the other origins. The tools listed here ARE the JSON-RPC tools
// /api/mcp serves — the same manifest module, so the two cannot disagree. What
// stays here is the auth note, which no other origin has.

import { descriptorHandler, mcpManifest } from 'wiki-formant/well-known';
import { SERVER_INFO, TOOLS } from '@/lib/mcp-tools';
import { SITE_URL } from '@/lib/site';
import serverManifest from '../../../../server.json';

export const revalidate = 86400;

const manifest = mcpManifest({
  name: 'Radix Wiki',
  registryName: serverManifest.name,
  version: SERVER_INFO.version,
  description:
    'Community-maintained knowledge base for Radix DLT. Reading is anonymous and free; writing takes a ROLA-signed token from your own Radix key.',
  url: SITE_URL,
  tools: TOOLS,
  extra: {
    auth: {
      reads: 'none',
      writes: 'ROLA — get_challenge, sign with your own Ed25519 key, login, then Authorization: Bearer',
      documentationUrl: `${SITE_URL}/AGENTS.md`,
    },
  },
});

export const GET = descriptorHandler(manifest, { extra: { 'Access-Control-Allow-Origin': '*' } });
