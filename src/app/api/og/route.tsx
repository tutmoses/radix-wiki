import { ImageResponse } from 'next/og';
import { SocialCard, bannerField, bubbles, cardRandom, OG_SIZE, OG_HEADERS } from 'wiki-formant/og';
import { paletteFor } from '@/lib/utils';
import { SITE_NAME } from '@/lib/site';

export const runtime = 'nodejs';

// Every stored banner is on this wiki's Vercel Blob store (measured, Sep 2026).
const BANNER_HOST = /\.public\.blob\.vercel-storage\.com$/;

function generatedField(title: string, tagPath: string) {
  const palette = paletteFor(tagPath);
  return bubbles(cardRandom(title, tagPath), {
    field: [palette[0], `${palette[1]}40`],
    colors: [palette[1], palette[2]],
    count: 8, radius: [40, 160], opacity: [0.15, 0.25],
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || SITE_NAME;
  const tagPath = searchParams.get('tagPath') || '';
  const description = searchParams.get('description') || 'A decentralized wiki powered by Radix DLT';
  // A banner is the card; the generated field only fills a page without one.
  const field = await bannerField(searchParams.get('banner'), BANNER_HOST) ?? generatedField(title, tagPath);

  return new ImageResponse(
    <SocialCard
      title={title}
      description={description}
      mark="RADIX.wiki"
      colors={{ text: '#fff', muted: 'rgba(255,255,255,0.8)', accent: '#ff9da0' }}
      {...field}
    />,
    { ...OG_SIZE, headers: OG_HEADERS },
  );
}
