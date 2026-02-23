// src/app/layout.tsx

import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import 'katex/dist/katex.min.css';
import '@/styles/globals.css';
import { RadixProvider } from '@/components/RadixProvider';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'RADIX Wiki',
    template: '%s | RADIX Wiki',
  },
  description: 'A decentralized wiki powered by Radix DLT',
  keywords: ['wiki', 'radix', 'blockchain', 'decentralized', 'web3'],
  authors: [{ name: 'RADIX Wiki' }],
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'RADIX Wiki',
    description: 'A decentralized wiki powered by Radix DLT',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Script
          src="https://plausible.io/js/pa-5NRG8r4xW19fPk-6FUmFm.js"
          strategy="afterInteractive"
        />
        <Script id="plausible-init" strategy="afterInteractive">
          {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init();`}
        </Script>
        <RadixProvider>
          <div className="min-h-screen bg-surface-0">
            <Header />
            <div className="flex">
              <Sidebar />
              <main className="app-main">
                <div className="app-content">{children}</div>
              </main>
            </div>
          </div>
        </RadixProvider>
      </body>
    </html>
  );
}
