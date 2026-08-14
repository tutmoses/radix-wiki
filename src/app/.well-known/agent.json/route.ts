// src/app/.well-known/agent.json/route.ts — A2A Agent Card (Google Agent2Agent protocol)

import { NextResponse } from 'next/server';
import { BASE_URL } from '@/lib/utils';
import { TOOLS, SERVER_INFO } from '@/lib/mcp-tools';

const AGENT_CARD = {
  name: 'Radix Wiki',
  description: 'Community-maintained knowledge base for Radix DLT — the layer-1 blockchain with linear scalability and asset-oriented smart contracts.',
  url: BASE_URL,
  version: SERVER_INFO.version,
  capabilities: {
    streaming: false,
    pushNotifications: false,
  },
  skills: TOOLS.filter(t => t.skill).map(t => ({
    id: t.skill!.id,
    name: t.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: t.description,
    tags: t.skill!.tags,
    ...(t.skill!.examples ? { examples: t.skill!.examples } : {}),
    ...(t.auth ? { authentication: t.auth } : {}),
  })),
  provider: {
    organization: 'Radix Wiki',
    url: BASE_URL,
  },
  documentationUrl: `${BASE_URL}/llms.txt`,
  mcpEndpoint: `${BASE_URL}/api/mcp`,
  mcpServerCard: `${BASE_URL}/api/mcp/server-card`,
  openapiUrl: `${BASE_URL}/openapi.json`,
  license: {
    name: 'CC-BY-4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    scope: 'content',
  },
  securitySchemes: {
    rola: {
      type: 'custom',
      description: 'Radix On-Ledger Authentication — Ed25519 keypair signed challenge. Required by the create_page and edit_page tools.',
      documentationUrl: `${BASE_URL}/AGENTS.md`,
    },
  },
  defaultInputModes: ['text/plain', 'application/json'],
  defaultOutputModes: ['text/plain', 'application/json', 'text/markdown'],
};

export async function GET() {
  return NextResponse.json(AGENT_CARD, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
