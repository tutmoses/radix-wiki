// src/app/layout.tsx

import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { RadixProvider } from '@/components/RadixProvider';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Footer } from '@/components/Footer';
import { Toast } from '@/components/Toast';

import { BASE_URL } from '@/lib/utils';
import { PLAUSIBLE_DOMAIN } from '@/lib/track';
import { ogMetadata, SITE_NAME } from '@/lib/og';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const SITE_DESCRIPTION = 'Community-maintained knowledge base for Radix DLT — the layer-1 blockchain with linear scalability and asset-oriented smart contracts.';

// Default card for URLs that declare none of their own. Next *replaces* rather than
// merges these objects, so every page that sets one restates them via ogMetadata().
// `alternates` is deliberately not inherited — canonical belongs to each URL.
const SITE_CARD = ogMetadata({ title: SITE_NAME, description: SITE_DESCRIPTION, url: BASE_URL });

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'RADIX Wiki',
    template: '%s | RADIX Wiki',
  },
  description: SITE_DESCRIPTION,
  keywords: ['wiki', 'radix', 'blockchain', 'decentralized', 'web3', 'scrypto', 'defi', 'layer-1', 'radix dlt', 'xrd'],
  authors: [{ name: 'RADIX Wiki' }],
  robots: {
    index: true,
    follow: true,
    'max-snippet': -1,
    'max-image-preview': 'large' as const,
    'max-video-preview': -1,
  },
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    other: {
      ...(process.env.BING_SITE_VERIFICATION ? { 'msvalidate.01': [process.env.BING_SITE_VERIFICATION] } : {}),
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.png',
  },
  openGraph: SITE_CARD.openGraph,
  twitter: SITE_CARD.twitter,
};

const SITE_JSON_LD = JSON.stringify([
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'RADIX Wiki',
    url: BASE_URL,
    description: 'Community-maintained knowledge base for Radix DLT — the layer-1 blockchain with linear scalability and asset-oriented smart contracts.',
    sameAs: ['https://twitter.com/RadixWiki', 'https://www.moltbook.com/u/RadixWiki', 'https://github.com/radixdlt', 'https://t.me/RadixDevelopers'],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'RADIX Wiki',
    url: BASE_URL,
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${BASE_URL}/search?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebAPI',
    name: 'RADIX Wiki API',
    description: 'REST API and MCP server for reading and writing Radix ecosystem wiki content',
    url: `${BASE_URL}/api/wiki`,
    documentation: `${BASE_URL}/llms.txt`,
    provider: { '@type': 'Organization', name: 'RADIX Wiki', url: BASE_URL },
  },
]);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="help" type="text/plain" href="/llms.txt" />
        <link rel="alternate" type="text/plain" href="/llms-full.txt" title="Full LLM content" />
        {/* Kept here rather than in `alternates.types`: pages set `alternates.canonical`,
            which replaces the whole object and would drop the feed link from every page. */}
        <link rel="alternate" type="application/rss+xml" href="/blog.xml" title="RADIX Wiki Blog" />
        <link rel="alternate" type="application/rss+xml" href="/week-in-review.xml" title="Radix Week in Review" />
        {/* IANA link relations, machine-readable first: the MCP endpoint is the
            service description, the agent card is general metadata, AGENTS.md is
            the prose documentation. No registered rel for MCP exists yet, and no
            MCP discovery standard is ratified — see /api/mcp/server-card. */}
        <link rel="service-desc" type="application/json" href="/api/mcp" title="MCP endpoint" />
        <link rel="service-meta" type="application/json" href="/.well-known/agent-card.json" />
        <link rel="service-doc" type="text/markdown" href="/AGENTS.md" title="Agent API reference" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SITE_JSON_LD }} />
        <Script src="/js/script.js" strategy="afterInteractive" />
        <Script id="plausible-init" strategy="afterInteractive">
          {/* endpoint must stay same-origin: the pa-* script ignores data-api and defaults
              to plausible.io/api/event, which connect-src blocks (next.config.ts CSP). */}
          {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init({ domain: ${JSON.stringify(PLAUSIBLE_DOMAIN)}, endpoint: '/api/event' });`}
        </Script>
        <RadixProvider>
          <div className="min-h-screen bg-surface-0">
            <a href="#main" className="skip-link">Skip to content</a>
            <Header />
            <div className="flex">
              <Sidebar />
              <main id="main" className="app-main">
                <div className="app-content">{children}</div>
                <Footer />
              </main>
            </div>
          </div>
          <Toast />
        </RadixProvider>
      </body>
    </html>
  );
}
