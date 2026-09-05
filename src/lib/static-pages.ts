// src/lib/static-pages.ts — the non-article routes, declared once.
//
// `parsePath` names each of these with a type; this table is what that type
// means everywhere else — the route's metadata, its sitemap row, and the Live
// Data list in llms.txt. Three copies of the same nine facts had already
// drifted: /charts carries one description in its meta tag and another in
// llms.txt, and nobody has said which is right.

export interface StaticPage {
  /** Path under the site root — the homepage's is ''. Spelled out because the type doesn't: charts-validators lives at /charts/validators. */
  path: string;
  title: string;
  description: string;
  /** Thin or query-dependent: noindex, and no social card for a URL that shouldn't be shared. */
  noindex?: boolean;
  /** A sitemap row, for the routes that get one. */
  changeFrequency?: 'daily' | 'monthly';
  priority?: number;
  /** Bypasses the "%s | RADIX Wiki" title template. */
  absoluteTitle?: boolean;
  /** Card headline, when it should differ from a keyword-length document title. */
  imageTitle?: string;
  /** llms.txt's own copy, where it has never been reconciled with the meta tag. */
  llmsDescription?: string;
}

/** Declaration order is the sitemap's order. */
export const STATIC_PAGES: Record<string, StaticPage> = {
  homepage: { path: '', title: 'Radix Wiki: XRD, Scrypto & the Radix DLT Crypto Ecosystem', description: 'The community-maintained wiki for Radix DLT – XRD, the Radix Engine, Scrypto smart contracts, Cerberus consensus, validators, staking, and the DeFi ecosystem.', absoluteTitle: true, imageTitle: 'RADIX Wiki' },
  charts: { path: 'charts', title: 'Charts', description: 'Live Radix network statistics, validator directory, and ecosystem token analytics — successor to RadixCharts.', llmsDescription: 'Live Radix network statistics, validator directory, and ecosystem token analytics.', changeFrequency: 'daily', priority: 0.7 },
  'charts-validators': { path: 'charts/validators', title: 'Validators', description: 'Sortable directory of all Radix validators with stake, fee, and ownership data.', changeFrequency: 'daily', priority: 0.7 },
  'charts-tokens': { path: 'charts/tokens', title: 'Tokens', description: 'Top tokens on Radix ranked by total value locked, with price, volume, and 24h change.', changeFrequency: 'daily', priority: 0.7 },
  welcome: { path: 'welcome', title: 'Welcome', description: 'Get started with RADIX Wiki — connect your Radix wallet and begin contributing to the decentralized knowledge base.', changeFrequency: 'monthly', priority: 0.5 },
  leaderboard: { path: 'leaderboard', title: 'Leaderboard', description: 'Top RADIX.wiki contributors ranked by contribution points.', changeFrequency: 'monthly', priority: 0.5 },
  rewards: { path: 'rewards', title: 'Rewards', description: 'Track contributor rewards and XRD airdrop eligibility on RADIX Wiki.', changeFrequency: 'monthly', priority: 0.5 },
  // Both titles already carry the site name, so the template doubles it —
  // "Search — RADIX Wiki | RADIX Wiki". Left as it renders today. Maintenance is
  // a work queue, hidden the way Wikipedia hides its maintenance categories.
  search: { path: 'search', title: 'Search — RADIX Wiki', description: 'Search the community-maintained RADIX Wiki.', noindex: true },
  maintenance: { path: 'maintenance', title: 'Maintenance — RADIX Wiki', description: 'Pages flagged as outdated, orphaned, unsourced, or missing required metadata.', noindex: true },
};

/** Every route with a sitemap row, bar the homepage — its URL is the bare origin. */
export const SITEMAP_PAGES = Object.values(STATIC_PAGES).filter(p => p.path && p.priority !== undefined);

/**
 * `parsePath`'s dispatch, the other direction: a URL path back to the type that
 * names it. Keying the table by that type is what lets this be derived rather
 * than written out a fourth time — add a row above and the route parses itself.
 */
export const STATIC_PATH_TYPES = new Map(
  Object.entries(STATIC_PAGES).filter(([, p]) => p.path).map(([type, p]) => [p.path, type]),
);

/** The /charts routes as llms.txt's Live Data list quotes them. */
export const CHARTS_PAGES = ['charts', 'charts-validators', 'charts-tokens'].map(key => {
  const p = STATIC_PAGES[key]!;
  return { path: p.path, title: p.title, description: p.llmsDescription ?? p.description };
});
