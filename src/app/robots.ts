import type { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/utils';

export default function robots(): MetadataRoute.Robots {
  const aiAllow = ['/', '/api/mcp', '/api/wiki/', '/llms.txt', '/llms-full.txt'];
  // Edit/history/mdx variants of canonical pages should not be indexed
  const pageVariantDisallow = ['/*/edit', '/*/history', '/*/mdx', '/edit', '/history', '/mdx'];
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', ...pageVariantDisallow] },
      { userAgent: 'GPTBot', allow: aiAllow },
      { userAgent: 'ChatGPT-User', allow: aiAllow },
      { userAgent: 'ClaudeBot', allow: aiAllow },
      { userAgent: 'PerplexityBot', allow: aiAllow },
      { userAgent: 'Amazonbot', allow: aiAllow },
      { userAgent: 'Google-Extended', allow: aiAllow },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
