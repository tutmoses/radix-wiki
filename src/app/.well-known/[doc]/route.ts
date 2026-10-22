// src/app/.well-known/[doc]/route.ts — the whole directory: the agent card at
// both its paths, the MCP manifest, the OpenAPI spec (also at /openapi.json,
// by a rewrite in next.config.ts) and the registry's domain proof.

import { wellKnownHandler } from 'wiki-formant/well-known';
import { SPEC } from '@/lib/openapi';
import { AGENT_CARD, MCP_MANIFEST } from '@/lib/well-known';

export const revalidate = 86400;

export const GET = wellKnownHandler({ agentCard: AGENT_CARD, mcpManifest: MCP_MANIFEST, openapi: SPEC });
