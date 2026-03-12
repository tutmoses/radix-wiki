// src/app/api/scout/route.ts — Scout agent (sensory system): ecosystem intel gathering
//
// Monitors Radix blog, GitHub releases, and the Radix learn site.
// Stores intel records and flags topics that lack wiki coverage.

import { json, handleRoute, requireCron } from '@/lib/api';
import { triageIntel, type IntelItem } from '@/lib/scout';

export const maxDuration = 120;

// --- Sources ---

const GITHUB_REPOS = [
  'radixdlt/radixdlt-scrypto',
  'radixdlt/babylon-gateway',
  'radixdlt/official-examples',
  'radixdlt/radix-engine-toolkit',
];

async function fetchGitHubReleases(): Promise<IntelItem[]> {
  const items: IntelItem[] = [];
  for (const repo of GITHUB_REPOS) {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=3`, {
        headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'radix-wiki-scout' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const releases = await res.json() as Array<{
        name?: string; tag_name: string; html_url: string; body?: string; published_at?: string;
      }>;
      for (const r of releases) {
        items.push({
          source: 'github',
          title: `${repo.split('/')[1]}: ${r.name || r.tag_name}`,
          url: r.html_url,
          summary: (r.body || '').slice(0, 300),
          date: r.published_at?.split('T')[0] ?? new Date().toISOString().split('T')[0]!,
        });
      }
    } catch { continue; }
  }
  return items;
}

async function fetchRadixBlog(): Promise<IntelItem[]> {
  try {
    const res = await fetch('https://www.radixdlt.com/blog', { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const html = await res.text();

    // Extract post URLs and titles from blog listing page
    const items: IntelItem[] = [];
    const linkPattern = /href="(\/blog\/[a-z0-9-]+)"/g;
    const seen = new Set<string>();
    for (const match of html.matchAll(linkPattern)) {
      const path = match[1]!;
      if (seen.has(path) || path === '/blog/rss.xml') continue;
      seen.add(path);
      if (items.length >= 8) break;
      items.push({
        source: 'radix_blog',
        title: path.replace('/blog/', '').replace(/-/g, ' '),
        url: `https://www.radixdlt.com${path}`,
        summary: '',
        date: new Date().toISOString().split('T')[0]!,
      });
    }
    return items;
  } catch { return []; }
}

async function fetchRadixLearn(): Promise<IntelItem[]> {
  try {
    const res = await fetch('https://learn.radixdlt.com/', { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const html = await res.text();

    const items: IntelItem[] = [];
    const linkPattern = /href="(\/[a-z0-9/-]+)"[^>]*>[^<]*<[^>]*>([^<]+)/g;
    for (const match of html.matchAll(linkPattern)) {
      const path = match[1]!;
      if (path === '/' || items.length >= 5) continue;
      items.push({
        source: 'radix_learn',
        title: match[2]!.trim(),
        url: `https://learn.radixdlt.com${path}`,
        summary: '',
        date: new Date().toISOString().split('T')[0]!,
      });
    }
    return items;
  } catch { return []; }
}

// --- Route ---

export async function GET(request: Request) {
  return handleRoute(async () => {
    const cronErr = requireCron(request);
    if (cronErr) return cronErr;

    // Gather intel from all sources
    const [github, blog, learn] = await Promise.all([
      fetchGitHubReleases(),
      fetchRadixBlog(),
      fetchRadixLearn(),
    ]);
    const allIntel = [...github, ...blog, ...learn];

    if (allIntel.length === 0) return json({ status: 'no_sources_reachable', items: 0 });

    const { newCount, flagged } = await triageIntel(allIntel);
    if (newCount === 0) return json({ status: 'no_new_intel', items: 0 });

    return json({
      status: 'completed',
      sources: { github: github.length, blog: blog.length, learn: learn.length },
      new: newCount,
      flagged: flagged.length,
      items: flagged,
    });
  }, 'Scout: intel sweep failed');
}
