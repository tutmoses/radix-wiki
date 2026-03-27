// src/app/.well-known/agent.json/route.ts — A2A Agent Card (Google Agent2Agent protocol)

import { NextResponse } from 'next/server';
import { BASE_URL } from '@/lib/utils';

const AGENT_CARD = {
  name: 'RADIX Wiki',
  description: 'Community-maintained knowledge base for Radix DLT — the layer-1 blockchain with linear scalability and asset-oriented smart contracts.',
  url: BASE_URL,
  version: '1.0.0',
  capabilities: {
    streaming: false,
    pushNotifications: false,
  },
  skills: [
    {
      id: 'search',
      name: 'Search Wiki',
      description: 'Search Radix Wiki pages by keyword across titles and excerpts',
      tags: ['search', 'radix', 'blockchain', 'wiki', 'scrypto', 'defi'],
      examples: ['Search for Cerberus consensus', 'Find pages about Scrypto', 'What is Xi\'an sharding?'],
    },
    {
      id: 'read',
      name: 'Read Page',
      description: 'Fetch full content of any wiki page in JSON or markdown format',
      tags: ['read', 'content', 'article', 'documentation'],
      examples: ['Read the Radix Engine overview', 'Get the Xi\'an roadmap page'],
    },
    {
      id: 'list',
      name: 'List Pages',
      description: 'List wiki pages by category with pagination and sorting',
      tags: ['list', 'browse', 'categories'],
    },
    {
      id: 'write',
      name: 'Contribute Content',
      description: 'Create or edit wiki pages. Requires ROLA authentication (Ed25519 keypair from a Radix wallet).',
      tags: ['write', 'edit', 'contribute'],
    },
  ],
  provider: {
    organization: 'RADIX Wiki',
    url: BASE_URL,
  },
  documentationUrl: `${BASE_URL}/llms.txt`,
  apiSpecUrl: `${BASE_URL}/.well-known/openapi.json`,
  mcpEndpoint: `${BASE_URL}/api/mcp`,
  securitySchemes: {
    rola: {
      type: 'custom',
      description: 'Radix On-Ledger Authentication — Ed25519 keypair signed challenge. See AGENTS.md for details.',
      documentationUrl: 'https://github.com/radix-wiki/radix-wiki/blob/main/AGENTS.md',
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
