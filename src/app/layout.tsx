// src/app/layout.tsx

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Beacon, SidebarProvider } from 'wiki-formant/react';
import { sidebarBootScript } from 'wiki-formant/sidebar';
import { JsonLd, SiteLinks } from 'wiki-formant/react-server';
import { cardUrl, rootMetadata, siteGraphLd } from 'wiki-formant/metadata';
import { RadixProvider } from '@/components/RadixProvider';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Footer } from '@/components/Footer';
import { Toast } from '@/components/Toast';
import { TrollboxDock } from '@/components/TrollboxDock';

import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, X } from '@/lib/site';
import { CARD } from '@/lib/og';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  ...rootMetadata({
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    image: cardUrl(CARD, { title: SITE_NAME, description: SITE_DESCRIPTION }),
    handle: X.handle,
    keywords: ['wiki', 'radix', 'blockchain', 'decentralized', 'web3', 'scrypto', 'defi', 'layer-1', 'radix dlt', 'xrd'],
    icons: { icon: '/favicon.ico', apple: '/logo.png' },
  }),
  authors: [{ name: SITE_NAME }],
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    other: {
      ...(process.env.BING_SITE_VERIFICATION ? { 'msvalidate.01': [process.env.BING_SITE_VERIFICATION] } : {}),
    },
  },
};

const SITE_JSON_LD = siteGraphLd({
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  logo: `${SITE_URL}/logo.png`,
  // The wiki's own accounts only: listing the Radix GitHub org or a Radix
  // Telegram here asserts the wiki is that organisation.
  sameAs: [X.url, 'https://www.moltbook.com/u/RadixWiki', 'https://github.com/tutmoses/radix-wiki'],
  searchUrl: `${SITE_URL}/search?q={search_term_string}`,
  api: {
    description: 'REST API and MCP server for reading and writing Radix ecosystem wiki content',
    url: `${SITE_URL}/api/wiki`,
    documentation: `${SITE_URL}/llms.txt`,
  },
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning: the sidebar boot script below stamps
  // data-sidebar on <html> before React hydrates, so the server HTML and the
  // client DOM differ by exactly that attribute, by design.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before first paint: stamp the remembered rail state on <html>, so a
            rail the reader collapsed does not paint open and animate shut. */}
        <script dangerouslySetInnerHTML={{ __html: sidebarBootScript() }} />
        <SiteLinks
          feeds={[
            { href: '/blog.xml', title: 'RADIX Wiki Blog' },
            { href: '/week-in-review.xml', title: 'Radix Week in Review' },
          ]}
          agentsMd
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <JsonLd data={SITE_JSON_LD} />
        <Beacon />
        <RadixProvider>
          {/* The rail and the header button that toggles it are not siblings,
              so the collapse state spans them through this provider. */}
          <SidebarProvider>
            <div className="app-shell bg-surface-0">
              <a href="#main" className="skip-link">Skip to content</a>
              <Header />
              <div className="wiki-layout">
                <Sidebar />
                <main id="main" className="app-main wiki-layout__main">
                  <div className="page-frame">{children}</div>
                  <Footer />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <TrollboxDock />
          <Toast />
        </RadixProvider>
      </body>
    </html>
  );
}
