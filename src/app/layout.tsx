// src/app/layout.tsx

import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { RadixProvider } from '@/components/RadixProvider';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Toast } from '@/components/Toast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://radix.wiki';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'RADIX Wiki',
    template: '%s | RADIX Wiki',
  },
  description: 'Community-maintained knowledge base for Radix DLT — the layer-1 blockchain with linear scalability and asset-oriented smart contracts.',
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
    other: {
      ...(process.env.BING_SITE_VERIFICATION ? { 'msvalidate.01': [process.env.BING_SITE_VERIFICATION] } : {}),
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'RADIX Wiki',
    description: 'Community-maintained knowledge base for Radix DLT — the layer-1 blockchain with linear scalability and asset-oriented smart contracts.',
    type: 'website',
    siteName: 'RADIX Wiki',
    locale: 'en_US',
  },
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
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${BASE_URL}/?search={search_term_string}` }, 'query-input': 'required name=search_term_string' },
  },
]);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="help" type="text/plain" href="/llms.txt" />
        <link rel="alternate" type="text/plain" href="/llms-full.txt" title="Full LLM content" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SITE_JSON_LD }} />
        <Script
          src="/js/script.js"
          data-api="/api/event"
          strategy="afterInteractive"
        />
        <Script id="plausible-init" strategy="afterInteractive">
          {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init();`}
        </Script>
        <RadixProvider>
          <div className="min-h-screen bg-surface-0">
            <a href="#main" className="skip-link">Skip to content</a>
            <Header />
            <div className="flex">
              <Sidebar />
              <main id="main" className="app-main">
                <div className="app-content">{children}</div>
              </main>
            </div>
          </div>
          <Toast />
        </RadixProvider>
      </body>
    </html>
  );
}
