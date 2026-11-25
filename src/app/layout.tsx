// src/app/layout.tsx

import '@/styles/globals.css';
import Link from 'next/link';
import Image from 'next/image';
import { RailFrame, SiteDocument, SiteShell } from 'wiki-formant/react-server';
import { RadixProvider } from '@/components/RadixProvider';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { TrollboxDock } from '@/components/TrollboxDock';

import { fontVariables } from '@/app/fonts';
import { SITE_NAME, site } from '@/lib/site';

export const metadata = site.metadata;
export const viewport = site.viewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteDocument className={fontVariables} site={site}>
      <RadixProvider>
        {/* The rail is the site nav, on every route, so the root layout mounts it. */}
        <SiteShell
          logo={<>
            <Image src="/logo.png" alt="" width={240} height={240} className="size-8 object-contain" priority />
            <span className="logo-text">{SITE_NAME}</span>
          </>}
          header={<Header />}
          site={site}
          link={Link}
        >
          <RailFrame rail={<Sidebar />} preview={{ scope: '.prose-content' }}>
            {children}
          </RailFrame>
        </SiteShell>
        <TrollboxDock />
      </RadixProvider>
    </SiteDocument>
  );
}
