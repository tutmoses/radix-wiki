import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RADIX Wiki',
    short_name: 'RADIX Wiki',
    description: 'A decentralized wiki powered by Radix DLT',
    start_url: '/',
    display: 'standalone',
    background_color: '#393e50',
    theme_color: '#393e50',
    icons: [
      { src: '/favicon.png', sizes: '48x48', type: 'image/png' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
