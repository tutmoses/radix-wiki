// src/app/llms-full.txt/route.ts — the whole corpus as one document.
//
// The walk is shared with the MCP `get_full_corpus` tool; what this URL owns
// is its preamble, which carries the licence grant an ingesting crawler needs.

import { buildFullCorpus, corpusRoute } from '@/lib/llms';
import { BASE_URL } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const header = (pageCount: number) => [
  `# RADIX Wiki — Full Content Export`,
  ``,
  `> This is the full-text version of llms.txt for ${BASE_URL}`,
  `> ${pageCount} pages, last generated ${new Date().toISOString().split('T')[0]}`,
  ``,
  `> License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)`,
  `> Attribution: "Source: RADIX.wiki (${BASE_URL}), CC BY 4.0"`,
  `> Full license text: https://creativecommons.org/licenses/by/4.0/legalcode`,
  ``,
].join('\n\n');

export const GET = corpusRoute('llms-full', () => buildFullCorpus(header));
