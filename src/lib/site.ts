// src/lib/site.ts – the canonical origin every absolute URL is built from, named
// and placed as in caper and acuiq2 so one grep finds it in all three.
import { ccBy40 } from 'wiki-formant/license';
import { siteGraphLd, siteRefs } from 'wiki-formant/metadata';
import { xAccount } from 'wiki-formant/social';

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';
export const SITE_NAME = 'RADIX Wiki';
export const SITE_DESCRIPTION = 'RADIX Wiki is a community-edited encyclopedia that documents Radix, a layer-1 blockchain with asset-oriented smart contracts, for its users and builders.';

// The wiki as schema.org names it: `@id` references to the Organization and
// WebSite nodes `siteGraph` states once on every page. Each
// Article and collection points at these rather than restating the nodes, which
// had been declared twice and had already parted on the logo.
export const SITE_REFS = siteRefs(SITE_URL);

// The X account, as the social cards, the JSON-LD `sameAs`, the footer, llms.txt,
// AGENTS.md and the MCP instructions name it. `posts` is what the `x` and
// `radix-week-in-review` routines in radix-studio post from it.
export const X = xAccount({
  siteName: SITE_NAME,
  handle: '@RadixWiki',
  posts: 'news from the Radix ecosystem, one update per post, and a link to the Week in Review essay every Sunday',
});

// The Organization and WebSite nodes, which the root layout states on every page.
export const siteGraph = siteGraphLd({
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  logo: `${SITE_URL}/logo.png`,
  // The wiki's own accounts only: listing the Radix GitHub org or a Radix
  // Telegram here asserts the wiki is that organisation.
  sameAs: [X.url, 'https://www.moltbook.com/u/RadixWiki', 'https://github.com/tutmoses/radix-wiki'],
  api: {
    description: 'REST API and MCP server for reading and writing Radix ecosystem wiki content',
    url: `${SITE_URL}/api/wiki`,
  },
});

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
