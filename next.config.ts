// next.config.ts

import type { NextConfig } from 'next';

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