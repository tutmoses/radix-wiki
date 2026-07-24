// next.config.ts

import type { NextConfig } from 'next';

// Content-Security-Policy (STRUCTURE.md S9). Landed as Report-Only in production
// first — it enforces nothing, only reports violations — so the wallet-connect,
// KaTeX/TipTap, and arbitrary wiki-content embed/image surfaces can be observed
// before flipping the key to the enforcing `Content-Security-Policy`. Dev is
// exempt (Next's inline HMR runtime would spam it). 'unsafe-inline' is required
// (Next injects inline hydration + an inline plausible-init script, no nonce
// middleware); img/frame stay `https:`-broad because published articles embed
// arbitrary hosts.
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
          ...(isProd ? [{ key: 'Content-Security-Policy-Report-Only', value: csp }] : []),
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
    ];
  },

  async rewrites() {
    return {
      beforeFiles: [
        { source: '/og', destination: '/api/og' },
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