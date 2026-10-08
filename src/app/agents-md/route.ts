// src/app/agents-md/route.ts — Serve the repo-root AGENTS.md over HTTP.
//
// AGENTS.md is the agents.md-standard file for agents working in a checkout;
// this route makes the same single copy reachable on-domain, so llms.txt and
// the agent card can point at radix.wiki/AGENTS.md instead of a repository URL
// that rots whenever the repo moves or goes private.
//
// Reached via the /AGENTS.md rewrite in next.config.ts — it must sit on a
// non-.md path because the /:path*.md rewrite claims that extension for
// markdown renders of wiki pages.
//
// The checkout copy also carries a block `next dev` writes and re-adds — an
// instruction to coding agents about this repo's Next.js version — which means
// nothing to a visiting agent and was being published here. It is cut on the
// way out rather than from the file, because the file regrows it.

import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { AGENT_CARD_CACHE_CONTROL } from 'wiki-formant/well-known';

export const revalidate = 86400;

const DEV_BLOCK = /\n*<!-- BEGIN:nextjs-agent-rules -->[\s\S]*?<!-- END:nextjs-agent-rules -->\n*/g;

export async function GET() {
  const doc = (await readFile(join(process.cwd(), 'AGENTS.md'), 'utf8')).replace(DEV_BLOCK, '\n').trimEnd() + '\n';
  return new NextResponse(doc, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': AGENT_CARD_CACHE_CONTROL,
    },
  });
}
