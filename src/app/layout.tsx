// src/app/layout.tsx

import '@/styles/globals.css';
import { RailFrame, SiteDocument, SiteShell } from 'wiki-formant/react-server';
import { RadixProvider } from '@/components/RadixProvider';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { TrollboxDock } from '@/components/TrollboxDock';

import { fontVariables } from '@/app/fonts';
import { site } from '@/lib/site';

export const metadata = site.metadata;
export const viewport = site.viewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteDocument className={fontVariables} site={site}>
      <RadixProvider>
        {/* The rail is the site nav, on every route, so the root layout mounts it. */}
        <SiteShell header={<Header />} footer={<Footer />}>
          <RailFrame rail={<Sidebar />} preview={{ scope: '.prose-content' }}>
            {children}
          </RailFrame>
        </SiteShell>
        <TrollboxDock />
      </RadixProvider>
    </SiteDocument>
  );
}
