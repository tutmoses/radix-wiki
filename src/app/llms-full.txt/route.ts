// src/app/llms-full.txt/route.ts — the whole corpus as one document.
//
// The walk is shared with the MCP `get_full_corpus` tool; what this URL owns
// is its preamble, which carries the licence grant an ingesting crawler needs.

import { isoDate } from 'wiki-formant/freshness';
import { LICENSE_BLOCK, buildFullCorpus, corpusRoute } from '@/lib/llms';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

const header = (pageCount: number, updated: Date) => [
  `# RADIX Wiki — Full Content Export`,
  ``,
  `> This is the full-text version of llms.txt for ${SITE_URL}`,
  `> ${pageCount} pages, last updated ${isoDate(updated)}`,
  ``,
  LICENSE_BLOCK,
  ``,
].join('\n\n');

export const GET = corpusRoute('llms-full', updated => buildFullCorpus(pageCount => header(pageCount, updated)));
