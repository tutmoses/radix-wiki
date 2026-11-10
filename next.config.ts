// next.config.ts

import type { NextConfig } from 'next';
import { contentSecurityPolicy, withWikiDefaults } from 'wiki-formant/headers';

// Content-Security-Policy (STRUCTURE.md S9): the shared base from
// `wiki-formant/headers`, with this origin's own source lists. Verified against
// home, article pages with embeds/images, and the wallet-connect init before
// flipping from Report-Only. img-src stays `https:`-broad because published
// articles embed arbitrary hosts; frame-src too, on purpose — IFRAME_HOSTS in
// src/lib/sanitize.ts decides which embeds survive, so the policy need not
// repeat it. connect-src covers the Radix Gateway + wallet Connect Relay (both
// under *.radixdlt.com) and OciSwap.
const csp = contentSecurityPolicy({
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'connect-src': ["'self'", 'https://*.radixdlt.com', 'https://api.ociswap.com'],
  'frame-src': ['https:'],
  'worker-src': ["'self'", 'blob:'],
});

export default withWikiDefaults({
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
    // As miow's: three widths per kind, and a month in the optimizer's cache.
    // Every distinct width a srcset names is its own transformation and cache write.
    deviceSizes: [640, 1080, 1920],
    imageSizes: [96, 256, 384],
    minimumCacheTTL: 31 * 24 * 60 * 60,
  },

  async rewrites() {
    return {
      beforeFiles: [
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
} satisfies NextConfig, { csp });
