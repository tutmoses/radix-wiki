// src/app/layout.tsx

import '@/styles/globals.css';
import Link from 'next/link';
import { RailFrame, SiteDocument, SiteShell } from 'wiki-formant/react-server';
import { RadixProvider } from '@/components/RadixProvider';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { TrollboxDock } from '@/components/TrollboxDock';

import { fontVariables } from '@/app/fonts';
import { site } from '@/lib/site';

export const { metadata, viewport } = site;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteDocument className={fontVariables} site={site}>
      <RadixProvider>
        {/* The rail is the site nav, on every route, so the root layout mounts it. */}
        <SiteShell header={<Header />} site={site} link={Link}>
          <RailFrame rail={<Sidebar />} preview={{ scope: '.prose-content' }}>
            {children}
          </RailFrame>
        </SiteShell>
        <TrollboxDock />
      </RadixProvider>
    </SiteDocument>
  );
}
