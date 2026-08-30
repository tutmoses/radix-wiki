// src/app/.well-known/agent.json/route.ts — A2A Agent Card (Google Agent2Agent
// protocol). The envelope and the tools-to-skills mapping are
// `wiki-formant/well-known`, shared with the other agent surfaces; what stays
// here is what a card is supposed to differ in.

import { NextResponse } from 'next/server';
import { agentCard, skillsFromTools, AGENT_CARD_CACHE_CONTROL } from 'wiki-formant/well-known';
import { BASE_URL } from '@/lib/utils';
import { TOOLS, SERVER_INFO } from '@/lib/mcp-tools';

// Skills come from the MCP tool manifest, so the card can never advertise a
// capability the server does not have.
const AGENT_CARD = agentCard({
  name: 'Radix Wiki',
  description: 'Community-maintained knowledge base for Radix DLT — the layer-1 blockchain with linear scalability and asset-oriented smart contracts.',
  url: BASE_URL,
  version: SERVER_INFO.version,
  skills: skillsFromTools(TOOLS),
  license: { name: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/', scope: 'content' },
  extra: {
    mcpServerCard: `${BASE_URL}/api/mcp/server-card`,
    openapiUrl: `${BASE_URL}/openapi.json`,
    securitySchemes: {
      rola: {
        type: 'custom',
        description: 'Radix On-Ledger Authentication — Ed25519 keypair signed challenge. Required by the create_page and edit_page tools.',
        documentationUrl: `${BASE_URL}/AGENTS.md`,
      },
    },
  },
});

export async function GET() {
  return NextResponse.json(AGENT_CARD, { headers: { 'Cache-Control': AGENT_CARD_CACHE_CONTROL } });
}
