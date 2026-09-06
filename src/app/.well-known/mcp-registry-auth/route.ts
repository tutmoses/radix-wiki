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
// The whole handler is `wiki-formant/well-known` now, not just the record: all
// three repos carried these thirty lines byte for byte, differing only in the
// domain named in this comment. Key material stays an env var — see that module
// for why, and for how to generate one.

import { registryAuthHandler } from 'wiki-formant/well-known';

export const dynamic = 'force-dynamic';

export const GET = registryAuthHandler();
