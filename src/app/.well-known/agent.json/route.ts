// src/app/.well-known/agent.json/route.ts — A2A Agent Card (Google Agent2Agent
// protocol). The envelope, the tools-to-skills mapping, the discovery URLs and
// the licence projection are `wiki-formant/well-known`, shared with the other
// agent surfaces; what stays here is what a card is supposed to differ in.

import { descriptorResponse } from 'wiki-formant/http';
import { agentCard, skillsFromTools } from 'wiki-formant/well-known';
import { SITE_URL } from '@/lib/site';
import { WIKI_LICENSE } from '@/lib/markdown';
import { TOOLS, SERVER_INFO } from '@/lib/mcp-tools';

// Skills come from the MCP tool manifest, so the card can never advertise a
// capability the server does not have.
const AGENT_CARD = agentCard({
  name: 'Radix Wiki',
  description: 'Community-maintained knowledge base for Radix DLT — the layer-1 blockchain with linear scalability and asset-oriented smart contracts.',
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

// `descriptorResponse` rather than a bare JSON body: the card is the document
// an A2A client refetches most and it carried no validator at all, so a caller
// fell back to heuristic freshness with no way to revalidate — a corrected card
// reached nobody on any schedule this origin controlled.
export async function GET(request: Request) {
  return descriptorResponse(request, AGENT_CARD);
}
