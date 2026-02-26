import { ImageResponse } from 'next/og';
import { hashStr, seededRandom } from '@/lib/utils';
import { CACHE } from '@/lib/api';

export const runtime = 'nodejs';

const CATEGORY_PALETTES: Record<string, [string, string, string]> = {
  'contents/tech':    ['#1e1b4b', '#4f46e5', '#818cf8'],
  'developers':       ['#052e16', '#059669', '#6ee7b7'],
  'ecosystem':        ['#451a03', '#d97706', '#fcd34d'],
  'community':        ['#500724', '#db2777', '#f9a8d4'],
  'blog':             ['#450a0a', '#dc2626', '#fca5a5'],
  'contents/history': ['#2e1065', '#7c3aed', '#c4b5fd'],
  'forum':            ['#083344', '#0891b2', '#67e8f9'],
};
const DEFAULT_PALETTE: [string, string, string] = ['#3b1520', '#c06a73', '#ff9da0'];

function getPalette(tagPath: string) {
  return Object.entries(CATEGORY_PALETTES).find(([k]) => tagPath.startsWith(k))?.[1] ?? DEFAULT_PALETTE;
}

const SIZE = { width: 1200, height: 630 };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || 'RADIX Wiki';
  const tagPath = searchParams.get('tagPath') || '';
  const excerpt = searchParams.get('excerpt') || 'A decentralized wiki powered by Radix DLT';
  const banner = searchParams.get('banner');

  if (banner) {
    return new ImageResponse(
      (
        <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute' }} />
          <div style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            width: '100%', height: '100%', padding: '48px 56px', position: 'relative',
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
          }}>
            <div style={{ fontSize: 56, fontWeight: 700, color: '#fff', lineHeight: 1.15, marginBottom: 12 }}>
              {title.length > 50 ? title.slice(0, 50) + '...' : title}
            </div>
            <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: '#ff9da0', fontWeight: 600 }}>RADIX.wiki</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>|</span>
              <span>{excerpt.length > 80 ? excerpt.slice(0, 80) + '...' : excerpt}</span>
            </div>
          </div>
        </div>
      ),
      { ...SIZE, headers: CACHE.og },
    );
  }

  const palette = getPalette(tagPath);
  const hash = hashStr(title + tagPath);
  const rand = seededRandom(hash);
  const angle = Math.floor(rand() * 360);

  const circles = Array.from({ length: 8 }, () => ({
    cx: rand() * 1200, cy: rand() * 630,
    r: 40 + rand() * 160,
    color: rand() > 0.5 ? palette[1] : palette[2],
    opacity: 0.15 + rand() * 0.25,
  }));

  return new ImageResponse(
    (
      <div style={{
        display: 'flex', width: '100%', height: '100%', position: 'relative',
        background: `linear-gradient(${angle}deg, ${palette[0]}, ${palette[1]}40)`,
      }}>
        {circles.map((c, i) => (
          <div key={i} style={{
            position: 'absolute', left: c.cx - c.r, top: c.cy - c.r,
            width: c.r * 2, height: c.r * 2, borderRadius: '50%',
            background: c.color, opacity: c.opacity,
          }} />
        ))}
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          width: '100%', height: '100%', padding: '48px 56px', position: 'relative',
        }}>
          <div style={{ fontSize: 56, fontWeight: 700, color: '#fff', lineHeight: 1.15, marginBottom: 12 }}>
            {title.length > 50 ? title.slice(0, 50) + '...' : title}
          </div>
          <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#ff9da0', fontWeight: 600 }}>RADIX.wiki</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>|</span>
            <span>{excerpt.length > 80 ? excerpt.slice(0, 80) + '...' : excerpt}</span>
          </div>
        </div>
      </div>
    ),
    { ...SIZE, headers: CACHE.og },
  );
}
