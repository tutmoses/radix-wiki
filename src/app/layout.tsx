// src/app/layout.tsx

import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';
import { RadixProvider } from '@/components/RadixProvider';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
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
  openGraph: {
    title: 'RADIX Wiki',
    description: 'A decentralized wiki powered by Radix DLT',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <RadixProvider>
          <div className="min-h-screen bg-surface-0">
            <Header />
            <Sidebar />
            <main className="min-h-[calc(100vh-4rem)] w-full">
              <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</div>
            </main>
          </div>
        </RadixProvider>
      </body>
    </html>
  );
}