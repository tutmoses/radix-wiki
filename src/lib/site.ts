// src/lib/site.ts – the canonical origin every absolute URL is built from, named
// and placed as in caper and acuiq2 so one grep finds it in all three.
import { ccBy40 } from 'wiki-formant/license';
import { cardUrl, defineSite, siteRefs } from 'wiki-formant/metadata';
import { xAccount } from 'wiki-formant/social';

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';
export const SITE_NAME = 'RADIX Wiki';
export const SITE_DESCRIPTION = 'RADIX Wiki is a community-edited encyclopedia that documents Radix, a layer-1 blockchain with asset-oriented smart contracts, for its users and builders.';

// The wiki as schema.org names it: `@id` references to the Organization and
// WebSite nodes `site.graph` states once on every page. Each
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

/** The generated 1200x630 card, for `cardUrl`. `tagPath` picks the section palette; `banner` overrides the gradient. */
export const CARD = `${SITE_URL}/og`;

/** The page's ground, `--color-surface-0`: the browser chrome's colour on a phone and the installed app's. */
export const THEME_COLOR = '#393e50';

// The grant, its name and the credit line, from `wiki-formant/license`. Only the
// site's own identity is passed in. Here rather than beside any one surface
// because every surface states it: the footer, the markdown twins, the llms
// exports, the feeds, the agent card, the OpenAPI info and the Article JSON-LD.
export const WIKI_LICENSE = ccBy40({ siteName: SITE_NAME, siteUrl: SITE_URL });

// The wiki's identity as every surface states it: the root layout's metadata,
// viewport, head links, the Organization and WebSite graph, and the footer.
export const site = defineSite({
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  image: cardUrl(CARD, { title: SITE_NAME, description: SITE_DESCRIPTION }),
  keywords: ['wiki', 'radix', 'blockchain', 'decentralized', 'web3', 'scrypto', 'defi', 'layer-1', 'radix dlt', 'xrd'],
  icons: { icon: '/favicon.ico', apple: '/logo.png' },
  x: X,
  feeds: [
    { href: '/blog.xml', title: 'RADIX Wiki Blog' },
    { href: '/week-in-review.xml', title: 'Radix Week in Review' },
  ],
  agentsMd: true,
  themeColor: THEME_COLOR,
  graph: {
    logo: `${SITE_URL}/logo.png`,
    // The wiki's own accounts only: listing the Radix GitHub org or a Radix
    // Telegram here asserts the wiki is that organisation.
    sameAs: [X.url, 'https://www.moltbook.com/u/RadixWiki', 'https://github.com/tutmoses/radix-wiki'],
    api: {
      description: 'REST API and MCP server for reading and writing Radix ecosystem wiki content',
      url: `${SITE_URL}/api/wiki`,
    },
  },
  // What nothing else on the page links to: Home, Contents, Charts and
  // Leaderboard are the rail's.
  footer: {
    links: [
      { href: '/about', label: 'About' },
      { href: '/policy', label: 'Policy' },
      { href: '/llms.txt', label: 'llms.txt' },
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
    ],
    license: WIKI_LICENSE,
    note: 'Powered by Radix DLT.',
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
