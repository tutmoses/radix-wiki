import { ImageResponse } from 'next/og';
import { SocialCard, bubbles, cardRandom, OG_SIZE, OG_HEADERS } from 'wiki-formant/og';
import { paletteFor } from '@/lib/utils';
import { SITE_NAME } from '@/lib/site';
import sharp from 'sharp';

export const runtime = 'nodejs';

// Every stored banner is on this wiki's Vercel Blob store (measured, Sep 2026).
// Fetching whatever `?banner=` named made this route an anonymous proxy to any
// URL the server can reach, decoded by sharp on the way through.
const BANNER_HOST = /\.public\.blob\.vercel-storage\.com$/;

function storedBanner(banner: string | null): string | null {
  if (!banner) return null;
  try {
    const url = new URL(banner);
    return url.protocol === 'https:' && BANNER_HOST.test(url.hostname) ? url.href : null;
  } catch { return null; }
}

/** Inlines the banner so the renderer never fetches; an unreachable or undecodable one falls back to its URL. */
async function bannerDataUrl(banner: string) {
  try {
    const res = await fetch(banner, { redirect: 'error' });
    if (!res.ok) return banner;
    const png = await sharp(Buffer.from(await res.arrayBuffer())).resize(1200, 630, { fit: 'cover' }).png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch { return banner; }
}

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
  const banner = storedBanner(searchParams.get('banner'));
  // A banner brings its own art and takes the scrim; without one the card paints itself.
  const field = banner
    ? {
        background: '#111',
        // eslint-disable-next-line @next/next/no-img-element
        art: <img src={await bannerDataUrl(banner)} alt="" width={1200} height={630} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute' }} />,
      }
    : generatedField(title, tagPath);

  return new ImageResponse(
    <SocialCard
      title={title}
      description={description}
      mark="RADIX.wiki"
      colors={{ text: '#fff', muted: 'rgba(255,255,255,0.8)', accent: '#ff9da0' }}
      {...field}
      scrim={!!banner}
    />,
    { ...OG_SIZE, headers: OG_HEADERS },
  );
}
