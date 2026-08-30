// src/app/.well-known/mcp-registry-auth/route.ts — domain proof for the
// official MCP registry, the only pull-based discovery path in the ecosystem
// and so the only descriptor here an agent can find without already knowing
// this origin.
//
// `mcp-publisher login http --domain=radix.wiki` makes the registry fetch this
// exact path and check that the key here verifies the signature its login
// presents. Passing grants publish rights over the reversed domain — the
// `wiki.radix/*` namespace that server.json's name sits in.
//
// The record itself is `wiki-formant/well-known`, shared with the other agent
// surfaces: all three had written the same handler, differing only in the
// domain named in this comment. Key material stays an env var — see that
// module for why, and for how to generate one.

import { NextResponse } from 'next/server';
import { registryAuthRecord } from 'wiki-formant/well-known';

export const dynamic = 'force-dynamic';

export async function GET() {
  const record = registryAuthRecord(process.env.MCP_REGISTRY_PUBLIC_KEY, process.env.MCP_REGISTRY_KEY_TYPE);
  // Unset → 404 rather than a malformed record, so a missing key reads as
  // "not configured" instead of failing verification for a reason nobody sees.
  if (!record) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(record.body, {
    headers: { 'Content-Type': record.contentType, 'Cache-Control': record.cacheControl },
  });
}
