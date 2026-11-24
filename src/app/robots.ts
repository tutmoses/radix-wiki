import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { crawlerRules } from 'wiki-formant/crawlers';

export default function robots(): MetadataRoute.Robots {
  // A page's /edit and /history views stay out of the index. A wiki page is
  // `/<tagPath…>/<slug>`, at least two segments, so its views are at least three:
  // `/*/*/history$` leaves the two-segment `/contents/history` hub crawlable.
  const pageVariantDisallow = ['edit', 'history'].flatMap(v => [`/*/*/${v}$`, `/${v}$`]);
  return {
    // `aiAllow` wins over `/api/` by longest match, keeping the per-page wiki API
    // behind every `.md` twin open to agents; `crawlerRules` adds the agent surface.
    rules: crawlerRules({ allow: '/', disallow: ['/api/', ...pageVariantDisallow], aiAllow: ['/', '/api/wiki/'] }),
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
