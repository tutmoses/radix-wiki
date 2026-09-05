// src/app/llms.txt/route.ts — the compact agent-facing map of the wiki.
//
// Kept deliberately small (llms.txt is a map, not the territory): preamble,
// recently updated pages, per-section counts, and category links. The
// exhaustive per-page listing lives at /llms-index.txt; the full corpus text
// at /llms-full.txt.
//
// The document itself is built in @/lib/llms, so the MCP resource of the same
// name can call it directly instead of fetching this URL over the network.

import { buildLlmsTxt, corpusRoute } from '@/lib/llms';

export const dynamic = 'force-dynamic';

export const GET = corpusRoute(buildLlmsTxt);
