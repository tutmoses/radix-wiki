import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { crawlerRules } from 'wiki-formant/crawlers';

export default function robots(): MetadataRoute.Robots {
  // `/api/wiki/*/mdx$` is the markdown twin of a page, and it has to out-specify the
  // `/*/*/mdx$` disallow below, which matches it too (`*` spans `/`). Precedence is by
  // pattern length, and `/api/wiki/` beat that disallow by a single character — a
  // one-char margin deciding whether agents can read the twins at all. Naming the twin
  // route outright settles it at 16 characters against 9.
  //
  // /api/mcp, the three llms exports, /openapi.json and /.well-known/ are
  // `AGENT_SURFACE_PATHS`, which `crawlerRules` allows in every group without
  // being told. This list is what this origin serves beyond them.
  const aiAllow = ['/', '/api/wiki/', '/api/wiki/*/mdx$'];
  // The /edit, /history and /mdx VIEWS of a wiki page should not be indexed.
  //
  // Two properties of robots.txt matching decide the shape of these patterns: a
  // rule is a *prefix* match unless it ends in `$`, and `*` spans `/`. The old
  // `/*/history` had neither guard, so it also matched every path beginning
  // `/<anything>/history` — which is the entire `/contents/history` branch, the
  // 24 event-history pages this sitemap publishes. Search Console filed them
  // under "Blocked by robots.txt", with history-of-radix and brunel-hack-25
  // indexed-but-uncrawlable: title in the result, no snippet.
  //
  // `$` alone is not enough. It frees the articles but still blocks
  // `/contents/history` itself, because that hub is a one-segment-then-"history"
  // path indistinguishable from a page's revision view by pattern alone. So the
  // patterns name the route shape instead: a wiki page is `/<tagPath…>/<slug>`,
  // never fewer than two segments, so its views are never fewer than three —
  // `/*/*/history$` catches /ecosystem/allnodes/history and /contents/history/
  // flexathon/history while leaving the two-segment hub alone. No reliance on
  // longest-match Allow precedence, which not every crawler implements.
  const views = ['edit', 'history', 'mdx'];
  const pageVariantDisallow = views.flatMap(v => [`/*/*/${v}$`, `/${v}$`]);
  // The aiAllow entries win over `/api/` by longest-match precedence, which is
  // what keeps /api/mcp and /api/wiki/ reachable for agents.
  const disallow = ['/api/', ...pageVariantDisallow];
  // The roster is `wiki-formant/crawlers`, shared with src/proxy.ts, which used
  // to keep a second and different list of the same thing. Five agents the proxy
  // measured — Bytespider, CCBot, cohere-ai, Claude-Web, Meta-ExternalFetcher —
  // had no group here at all, and a crawler obeys only its most-specific group,
  // so they were granted whatever `*` grants. `crawlerRules` gives every group
  // the `_rsc=` disallow and writes the Googlebot/Bingbot groups (no `/api/`,
  // no `.md` twins) itself.
  return {
    rules: crawlerRules({ allow: '/', disallow, aiAllow }),
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
