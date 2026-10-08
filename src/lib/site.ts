// src/lib/site.ts – the canonical origin every absolute URL is built from, named
// and placed as in caper and acuiq2 so one grep finds it in all three.
import { ccBy40 } from 'wiki-formant/license';
import { siteRefs } from 'wiki-formant/metadata';

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';
export const SITE_NAME = 'RADIX Wiki';
export const SITE_DESCRIPTION = 'Community-maintained knowledge base for Radix DLT — the layer-1 blockchain with linear scalability and asset-oriented smart contracts.';

// The wiki as schema.org names it: `@id` references to the Organization and
// WebSite nodes the layout's `siteGraphLd` states once on every page. Each
// Article and collection points at these rather than restating the nodes, which
// had been declared twice and had already parted on the logo.
export const SITE_REFS = siteRefs(SITE_URL);

// The sister wiki, named in llms.txt and the MCP instructions so an agent that
// arrives here with a question about DAOs in general finds where it is answered.
// The split is the one the wiki sweeps route facts by: this wiki owns Radix,
// including the Radix DAO's own decisions, and caper.network owns the rest.
export const SIBLING_WIKI = {
  covers: 'DAO governance in general, DeSci and economics',
  url: 'https://caper.network/wiki',
  mcp: 'https://caper.network/api/mcp',
};

// The grant, its name and the credit line, from `wiki-formant/license` — the
// same four fields the other two wikis had each written out. Only the site's own
// identity is passed in. Here rather than beside any one surface because every
// surface states it: the markdown twins, the llms exports, the feeds, the agent
// card, the OpenAPI info and the Article JSON-LD.
export const WIKI_LICENSE = ccBy40({ siteName: SITE_NAME, siteUrl: SITE_URL });
