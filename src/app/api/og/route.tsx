import { ImageResponse } from 'next/og';
import { hashStr, seededRandom, paletteFor } from '@/lib/utils';
import { CACHE } from '@/lib/api';
import sharp from 'sharp';

export const runtime = 'nodejs';

const SIZE = { width: 1200, height: 630 };
const SCRIM = 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)';

/** Inlines the banner so the renderer never fetches; an unreachable or undecodable one falls back to its URL. */
async function bannerDataUrl(banner: string) {
  try {
    const res = await fetch(banner);
    if (!res.ok) return banner;
    const png = await sharp(Buffer.from(await res.arrayBuffer())).resize(1200, 630, { fit: 'cover' }).png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch { return banner; }
}

function generatedBackground(title: string, tagPath: string) {
  const palette = paletteFor(tagPath);
  const rand = seededRandom(hashStr(title + tagPath));
  const angle = Math.floor(rand() * 360);
  return {
    background: `linear-gradient(${angle}deg, ${palette[0]}, ${palette[1]}40)`,
    circles: Array.from({ length: 8 }, () => ({
      cx: rand() * 1200, cy: rand() * 630,
      r: 40 + rand() * 160,
      color: rand() > 0.5 ? palette[1] : palette[2],
      opacity: 0.15 + rand() * 0.25,
    })),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || 'RADIX Wiki';
  const tagPath = searchParams.get('tagPath') || '';
  const description = searchParams.get('description') || 'A decentralized wiki powered by Radix DLT';
  const banner = searchParams.get('banner');
  const bannerSrc = banner ? await bannerDataUrl(banner) : '';
  // A banner brings its own art and takes the scrim; without one the card paints itself.
  // Satori iterates every style key and does not skip `undefined`, so each variant's
  // background must be spread in or left out — assigning undefined throws mid-render.
  const generated = bannerSrc ? null : generatedBackground(title, tagPath);

  return new ImageResponse(
    (
      <div style={{
        display: 'flex', width: '100%', height: '100%', position: 'relative',
        ...(generated ? { background: generated.background } : {}),
      }}>
        {generated ? generated.circles.map((c, i) => (
          <div key={i} style={{
            position: 'absolute', left: c.cx - c.r, top: c.cy - c.r,
            width: c.r * 2, height: c.r * 2, borderRadius: '50%',
            background: c.color, opacity: c.opacity,
          }} />
        )) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerSrc} alt="" width={1200} height={630} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute' }} />
        )}
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          width: '100%', height: '100%', padding: '48px 56px', position: 'relative',
          ...(generated ? {} : { background: SCRIM }),
        }}>
          <div style={{ fontSize: 56, fontWeight: 700, color: '#fff', lineHeight: 1.15, marginBottom: 12 }}>
            {title.length > 50 ? title.slice(0, 50) + '...' : title}
          </div>
          <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#ff9da0', fontWeight: 600 }}>RADIX.wiki</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>|</span>
            <span>{description.length > 80 ? description.slice(0, 80) + '...' : description}</span>
          </div>
        </div>
      </div>
    ),
    { ...SIZE, headers: CACHE.og },
  );
}
