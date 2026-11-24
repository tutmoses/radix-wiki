// src/components/Footer.tsx – what every page ends on. Home, Contents, Charts
// and Leaderboard are the rail's; the footer keeps what nothing else on the
// page links to.

import Link from 'next/link';
import { SiteFooter } from 'wiki-formant/react-server';

import { SITE_NAME, X } from '@/lib/site';

const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/policy', label: 'Policy' },
  { href: '/llms.txt', label: 'llms.txt' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

export function Footer() {
  return (
    <SiteFooter
      links={LINKS}
      x={X}
      owner={SITE_NAME}
      link={Link}
      note={
        <p>
          Content licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Powered by Radix DLT.
        </p>
      }
    />
  );
}
