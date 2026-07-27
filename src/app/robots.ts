import type { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/utils';

export default function robots(): MetadataRoute.Robots {
  const aiAllow = ['/', '/api/mcp', '/api/wiki/', '/llms.txt', '/llms-full.txt'];
  // Edit/history/mdx variants of canonical pages should not be indexed
  const pageVariantDisallow = ['/*/edit', '/*/history', '/*/mdx', '/edit', '/history', '/mdx'];
  // A crawler obeys only its most-specific matching group, so every named agent
  // needs its own disallow — omitting it grants that agent unrestricted access.
  // The aiAllow entries still win over `/api/` by longest-match precedence,
  // which is what keeps /api/mcp and /api/wiki/ reachable for agents.
  const disallow = ['/api/', ...pageVariantDisallow];
  const aiAgents = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Amazonbot', 'Google-Extended'];
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      ...aiAgents.map(userAgent => ({ userAgent, allow: aiAllow, disallow })),
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
