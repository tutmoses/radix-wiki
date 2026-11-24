import type { MetadataRoute } from 'next';
import { SITE_NAME, THEME_COLOR } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: 'A decentralized wiki powered by Radix DLT',
    start_url: '/',
    display: 'standalone',
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: '/favicon.png', sizes: '48x48', type: 'image/png' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
