// src/app/.well-known/mcp-registry-auth/route.ts — Domain proof for the
// official MCP registry.
//
// `mcp-publisher login http --domain=radix.wiki` fetches this file and checks
// that the public key here matches the private key signing the login, which is
// what grants publishing rights to the `wiki.radix/*` namespace.
//
// The key material is an env var, not a committed file: the PUBLIC half is
// harmless to serve but pointless to keep in git, and keeping it out means the
// PRIVATE half has an obvious home too (your keychain, never the repo).
//
//   openssl genpkey -algorithm Ed25519 -out key.pem
//   openssl pkey -in key.pem -pubout -outform DER | tail -c 32 | base64
//   → set MCP_REGISTRY_PUBLIC_KEY to that value in Vercel, redeploy
//
// Unset → 404 rather than a malformed record, so a missing key reads as
// "not configured" instead of failing verification for a reason nobody can see.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const publicKey = process.env.MCP_REGISTRY_PUBLIC_KEY;
  if (!publicKey) return new NextResponse('Not found', { status: 404 });

  // ed25519 unless a P-384 key was used instead (the LibreSSL-friendly path).
  const keyType = process.env.MCP_REGISTRY_KEY_TYPE || 'ed25519';

  return new NextResponse(`v=MCPv1; k=${keyType}; p=${publicKey}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
