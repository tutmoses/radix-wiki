// next.config.ts

import type { NextConfig } from 'next';
import { contentSecurityPolicy, securityHeaders } from 'wiki-formant/headers';

// Content-Security-Policy (STRUCTURE.md S9): the shared base from
// `wiki-formant/headers`, with this origin's own source lists. Verified against
// home, article pages with embeds/images, and the wallet-connect init before
// flipping from Report-Only. img-src stays `https:`-broad because published
// articles embed arbitrary hosts; frame-src too, on purpose — IFRAME_HOSTS in
// src/lib/sanitize.ts decides which embeds survive, so the policy need not
// repeat it. connect-src covers the Radix Gateway + wallet Connect Relay (both
// under *.radixdlt.com) and OciSwap.
const isProd = process.env.NODE_ENV === 'production';
const csp = contentSecurityPolicy({
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'connect-src': ["'self'", 'https://*.radixdlt.com', 'https://api.ociswap.com'],
  'frame-src': ['https:'],
  'worker-src': ["'self'", 'blob:'],
  'manifest-src': ["'self'"],
});

const nextConfig: NextConfig = {
  // Studio renders boot a second dev server alongside your running one. Next 16
  // allows only one dev server per distDir (the lock lives at <distDir>/lock),
  // so the studio runs on its own distDir to coexist with `:3000`. Off unless
  // STUDIO_DIST_DIR is set, so normal dev/build keep the default `.next`.
  ...(process.env.STUDIO_DIST_DIR ? { distDir: process.env.STUDIO_DIST_DIR } : {}),
  compress: true,
  
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // Image optimization for external sources
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: '*.blob.vercel-storage.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders(isProd ? csp : null),
      },
    ];
  },

  async redirects() {
    return [
      { source: '/llm.txt', destination: '/llms.txt', permanent: true },
      // Developers taxonomy reorganisation, 2026-07-27: the AI-agent guides and tools were
      // collected under /developers/ai-agents, and the oracle guide joined the Scrypto series.
      { source: '/developers/infrastructure/ai-agents-and-x402', destination: '/developers/ai-agents/ai-agents-and-x402', permanent: true },
      { source: '/developers/infrastructure/radix-context', destination: '/developers/ai-agents/radix-context', permanent: true },
      { source: '/developers/tools/agent-wallet-ai', destination: '/developers/ai-agents/agent-wallet-ai', permanent: true },
      { source: '/developers/tools/igentix', destination: '/developers/ai-agents/igentix', permanent: true },
      { source: '/developers/infrastructure/03-oracle-integration', destination: '/developers/scrypto/08-oracle-integration', permanent: true },
      // RRC-404 is a token standard, not a developer tool.
      { source: '/developers/tools/rrc-404', destination: '/contents/tech/core-protocols/rrc-404', permanent: true },
      // Community cleanup, 2026-07-27: these URLs still draw traffic but their pages moved
      // out of /community (projects and councils belong under /ecosystem).
      // Dan Hughes's biography left /community when that section was retired on
      // 2026-09-09; both old addresses point at where it actually lives.
      { source: '/talent-pool/dan-hughes', destination: '/contents/history/dan-hughes', permanent: true },
      { source: '/community/dan-hughes', destination: '/contents/history/dan-hughes', permanent: true },
      { source: '/community/radix-accountability-council', destination: '/ecosystem/radix-accountability-council', permanent: true },
      { source: '/community/hydraswap', destination: '/ecosystem/hydraswap', permanent: true },
      // Search Console's 404 list, 2026-09-06: URLs Google still holds whose page
      // moved rather than went. The rest of that list — talent-pool, the culled
      // community shells, retired proposals — has no successor and stays a 404.
      { source: '/charts-validators', destination: '/charts/validators', permanent: true },
      { source: '/charts-tokens', destination: '/charts/tokens', permanent: true },
      { source: '/contents/history/history-of-radix', destination: '/contents/history', permanent: true },
      { source: '/ecosystem/radix-desktop-tool', destination: '/developers/tools/radix-desktop-tool', permanent: true },
      { source: '/ecosystem/radix-ecosystem-fund', destination: '/contents/history/radix-ecosystem-funding', permanent: true },
      { source: '/contents/tech/comparison', destination: '/contents/tech/comparisons', permanent: true },
      { source: '/contents/tech/comparison/polkadot', destination: '/contents/tech/comparisons/radix-vs-polkadot', permanent: true },
      // The ideas board was reseeded as the DAO transition's work queue; these are
      // the proposals that became a card, at the card's slug.
      { source: '/ideas/xian-protocol-upgrade', destination: '/ideas/dao-xian-protocol-upgrade', permanent: true },
      { source: '/ideas/consultations-v2', destination: '/ideas/dao-governance-app-consultation-v2', permanent: true },
      { source: '/ideas/rfc-migrate-radix-developer-documentation-to-radixwiki', destination: '/ideas/dao-migrate-dev-docs-wiki', permanent: true },
      { source: '/ideas/dao-treasury-custody', destination: '/ideas/dao-xrd-custody', permanent: true },
      // DeSci lives on caper.network now, same slugs.
      { source: '/contents/tech/desci', destination: 'https://caper.network/wiki/desci', permanent: true },
      { source: '/contents/tech/desci/:slug(desci-and-radix|desci-funding|ip-nfts)', destination: 'https://caper.network/wiki/desci/:slug', permanent: true },
      { source: '/ecosystem/:slug(vitadao|psydao|athenadao|bio-xyz|genomesdao|gitcoin-desci|molecule|ultrarare-bio)', destination: 'https://caper.network/wiki/desci/ecosystem/:slug', permanent: true },
      // The legacy docs mirrored docs.radixdlt.com, whose pages still answer at
      // the same final slug (10 of 12 sampled). The two that do not 404 there
      // instead of here, which is no worse.
      { source: '/developers/legacy-docs', destination: 'https://docs.radixdlt.com/', permanent: true },
      { source: '/developers/legacy-docs/:path*/:last', destination: 'https://docs.radixdlt.com/docs/:last', permanent: true },
    ];
  },

  async rewrites() {
    return {
      beforeFiles: [
        { source: '/og', destination: '/api/og' },
        // Must precede the .md rule below, which would otherwise swallow
        // /AGENTS.md into the wiki API and 404. The agent API reference is a
        // real document, not a wiki page rendered as markdown.
        { source: '/AGENTS.md', destination: '/agents-md' },
        // The `.md` rides through to the destination instead of being traded
        // for a `?format=text`: Next drops a query string written into a
        // rewrite destination (a client-supplied one survives, one authored
        // here does not), so the extension has to be what carries the intent.
        { source: '/:path*.md', destination: '/api/wiki/:path*.md' },
      ],
    };
  },
};

export default nextConfig;