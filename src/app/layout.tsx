// src/app/layout.tsx

import type { Metadata } from 'next';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { RailFrame, SiteDocument, SiteFooter, SiteShell } from 'wiki-formant/react-server';
import { cardUrl, rootMetadata, siteGraphLd } from 'wiki-formant/metadata';
import { RadixProvider } from '@/components/RadixProvider';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
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
  api: {
    description: 'REST API and MCP server for reading and writing Radix ecosystem wiki content',
    url: `${SITE_URL}/api/wiki`,
  },
});

// Home, Contents, Charts and Leaderboard are the rail's; the footer keeps what
// nothing else on the page links to.
const FOOTER_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/policy', label: 'Policy' },
  { href: '/llms.txt', label: 'llms.txt' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

const FOOTER_NOTE = (
  <p>
    Content licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Powered by Radix DLT.
  </p>
);

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
        <SiteShell
          className="bg-surface-0"
          header={<Header />}
          footer={<SiteFooter links={FOOTER_LINKS} x={X} owner={SITE_NAME} note={FOOTER_NOTE} link={Link} />}
        >
          <RailFrame rail={<Sidebar />} preview={{ endpoint: '/api/wiki/preview', scope: '.prose-content' }}>
            {children}
          </RailFrame>
        </SiteShell>
        <TrollboxDock />
        <Toast />
      </RadixProvider>
    </SiteDocument>
  );
}
