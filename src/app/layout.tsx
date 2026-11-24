// src/app/layout.tsx

import type { Metadata } from 'next';
import '@/styles/globals.css';
import { RailFrame, SiteDocument, SiteShell } from 'wiki-formant/react-server';
import { cardUrl, rootMetadata } from 'wiki-formant/metadata';
import { RadixProvider } from '@/components/RadixProvider';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Toast } from '@/components/Toast';
import { TrollboxDock } from '@/components/TrollboxDock';

import { fontVariables } from '@/app/fonts';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, X, siteGraph } from '@/lib/site';
import { CARD } from '@/lib/og';

export const metadata: Metadata = rootMetadata({
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  image: cardUrl(CARD, { title: SITE_NAME, description: SITE_DESCRIPTION }),
  handle: X.handle,
  keywords: ['wiki', 'radix', 'blockchain', 'decentralized', 'web3', 'scrypto', 'defi', 'layer-1', 'radix dlt', 'xrd'],
  icons: { icon: '/favicon.ico', apple: '/logo.png' },
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteDocument
      className={fontVariables}
      bodyClassName="font-sans antialiased"
      links={{
        feeds: [
          { href: '/blog.xml', title: 'RADIX Wiki Blog' },
          { href: '/week-in-review.xml', title: 'Radix Week in Review' },
        ],
        agentsMd: true,
      }}
      graph={siteGraph}
    >
      <RadixProvider>
        {/* The rail is the site nav, on every route, so the root layout mounts it. */}
        <SiteShell header={<Header />} footer={<Footer />}>
          <RailFrame rail={<Sidebar />} preview={{ scope: '.prose-content' }}>
            {children}
          </RailFrame>
        </SiteShell>
        <TrollboxDock />
        <Toast />
      </RadixProvider>
    </SiteDocument>
  );
}
