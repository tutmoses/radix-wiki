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

import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const revalidate = 86400;

export async function GET() {
  const doc = await readFile(join(process.cwd(), 'AGENTS.md'), 'utf8');
  return new NextResponse(doc, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
