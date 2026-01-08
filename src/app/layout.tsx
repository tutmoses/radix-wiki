// src/app/layout.tsx

import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';
import { RadixProvider } from '@/components/RadixProvider';

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <RadixProvider>
          {children}
        </RadixProvider>
      </body>
    </html>
  );
}