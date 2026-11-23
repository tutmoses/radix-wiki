// src/app/layout.tsx

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { RailFrame, SiteDocument, SiteShell } from 'wiki-formant/react-server';
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
  return (
    <SiteDocument
      bodyClassName={`${inter.variable} font-sans antialiased`}
      links={{
        feeds: [
          { href: '/blog.xml', title: 'RADIX Wiki Blog' },
          { href: '/week-in-review.xml', title: 'Radix Week in Review' },
        ],
        agentsMd: true,
      }}
      graph={SITE_JSON_LD}
    >
      <RadixProvider>
        {/* The rail is the site nav, on every route, so the root layout mounts it. */}
        <SiteShell className="bg-surface-0" header={<Header />} footer={<Footer />}>
          <RailFrame rail={<Sidebar />}>
            <div className="page-frame">{children}</div>
          </RailFrame>
        </SiteShell>
        <TrollboxDock />
        <Toast />
      </RadixProvider>
    </SiteDocument>
  );
}
