// next.config.ts

import type { NextConfig } from 'next';

// Content-Security-Policy (STRUCTURE.md S9). Enforcing in production, dev exempt
// (Next's inline HMR runtime would trip it). Verified against home, article pages
// with embeds/images, and the wallet-connect init before flipping from
// Report-Only. 'unsafe-inline' is required (Next injects inline hydration + an
// inline plausible-init script, no nonce middleware); img/frame stay `https:`-broad
// because published articles embed arbitrary hosts; connect-src covers the Radix
// Gateway + wallet Connect Relay (both under *.radixdlt.com) and OciSwap.
const isProd = process.env.NODE_ENV === 'production';
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.radixdlt.com https://api.ociswap.com",
  "frame-src https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ');

const nextConfig: NextConfig = {
  // Studio renders boot a second dev server alongside your running one. Next 16
  // allows only one dev server per distDir (the lock lives at <distDir>/lock),
  // so the studio runs on its own distDir to coexist with `:3000`. Off unless
  // STUDIO_DIST_DIR is set, so normal dev/build keep the default `.next`.
  ...(process.env.STUDIO_DIST_DIR ? { distDir: process.env.STUDIO_DIST_DIR } : {}),
  reactStrictMode: true,
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
      {
        protocol: 'https',
        hostname: 'cdn.prod.website-files.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn-images-1.medium.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
      },
      {
        protocol: 'https',
        hostname: '*.ytimg.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...(isProd ? [{ key: 'Content-Security-Policy', value: csp }] : []),
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
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
      { source: '/talent-pool/dan-hughes', destination: '/community/dan-hughes', permanent: true },
      { source: '/community/radix-accountability-council', destination: '/ecosystem/radix-accountability-council', permanent: true },
      { source: '/community/hydraswap', destination: '/ecosystem/hydraswap', permanent: true },
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
        { source: '/:path*.md', destination: '/api/wiki/:path*?format=text' },
      ],
      afterFiles: [
        { source: '/js/script.js', destination: 'https://plausible.io/js/pa-5NRG8r4xW19fPk-6FUmFm.js' },
        { source: '/api/event', destination: 'https://plausible.io/api/event' },
      ],
    };
  },
};

export default nextConfig;