// src/app/layout.tsx

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Beacon, SidebarProvider } from 'wiki-formant/react';
import { sidebarBootScript } from 'wiki-formant/sidebar';
import { SIDEBAR_BREAKPOINT, SIDEBAR_KEY } from '@/lib/sidebar';
import { JsonLd } from 'wiki-formant/react-server';
import { RadixProvider } from '@/components/RadixProvider';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Footer } from '@/components/Footer';
import { Toast } from '@/components/Toast';

import { SITE_DESCRIPTION, SITE_NAME, SITE_ORGANIZATION, SITE_URL, SITE_WEBSITE } from '@/lib/site';
import { ogMetadata } from '@/lib/og';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Default card for URLs that declare none of their own. Next *replaces* rather than
// merges these objects, so every page that sets one restates them via ogMetadata().
// `alternates` is deliberately not inherited — canonical belongs to each URL.
const SITE_CARD = ogMetadata({ title: SITE_NAME, description: SITE_DESCRIPTION, url: SITE_URL });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ['wiki', 'radix', 'blockchain', 'decentralized', 'web3', 'scrypto', 'defi', 'layer-1', 'radix dlt', 'xrd'],
  authors: [{ name: SITE_NAME }],
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

const SITE_JSON_LD = [
  {
    '@context': 'https://schema.org',
    ...SITE_ORGANIZATION,
    description: SITE_DESCRIPTION,
    sameAs: ['https://twitter.com/RadixWiki', 'https://www.moltbook.com/u/RadixWiki', 'https://github.com/radixdlt', 'https://t.me/RadixDevelopers'],
  },
  {
    '@context': 'https://schema.org',
    ...SITE_WEBSITE,
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebAPI',
    name: `${SITE_NAME} API`,
    description: 'REST API and MCP server for reading and writing Radix ecosystem wiki content',
    url: `${SITE_URL}/api/wiki`,
    documentation: `${SITE_URL}/llms.txt`,
    provider: SITE_ORGANIZATION,
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning: the sidebar boot script below stamps
  // data-sidebar on <html> before React hydrates, so the server HTML and the
  // client DOM differ by exactly that attribute, by design.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before first paint: stamp the remembered rail state on <html>, so a
            rail the reader collapsed does not paint open and animate shut. */}
        <script dangerouslySetInnerHTML={{ __html: sidebarBootScript(SIDEBAR_KEY, SIDEBAR_BREAKPOINT) }} />
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
        <JsonLd data={SITE_JSON_LD} />
        <Beacon />
        <RadixProvider>
          {/* The rail and the header button that toggles it are not siblings,
              so the collapse state spans them through this provider. */}
          <SidebarProvider storageKey={SIDEBAR_KEY} breakpoint={SIDEBAR_BREAKPOINT}>
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
          </SidebarProvider>
          <Toast />
        </RadixProvider>
      </body>
    </html>
  );
}
