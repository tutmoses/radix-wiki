// src/lib/well-known.ts — what an arriving agent reads before it knows
// anything else about this origin: the A2A agent card and the MCP discovery
// manifest. The envelopes are `wiki-formant/well-known`; what stays here is
// what a card and a manifest are supposed to differ in. Skills and tools come
// from the one tool manifest, so neither can advertise a capability the server
// does not have.

import { agentCard, mcpManifest, skillsFromTools } from 'wiki-formant/well-known';
import { SITE_DESCRIPTION, SITE_URL, WIKI_LICENSE } from '@/lib/site';
import { TOOLS, SERVER_INFO } from '@/lib/mcp-tools';
import serverManifest from '../../server.json';

export const AGENT_CARD = agentCard({
  name: 'Radix Wiki',
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  version: SERVER_INFO.version,
  skills: skillsFromTools(TOOLS),
  license: WIKI_LICENSE,
  licenseScope: 'content',
  extra: {
    securitySchemes: {
      rola: {
        type: 'custom',
        description: 'Radix On-Ledger Authentication — Ed25519 keypair signed challenge. Required by the create_page and edit_page tools.',
        documentationUrl: `${SITE_URL}/AGENTS.md`,
      },
    },
  },
});

export const MCP_MANIFEST = mcpManifest({
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
