// src/app/api/scout/route.ts — Scout agent (sensory system): ecosystem intel gathering
//
// Monitors Radix blog, GitHub releases, and the Radix learn site.
// Stores intel records and flags topics that lack wiki coverage.

import { prisma } from '@/lib/prisma/client';
import { json, handleRoute, requireCron } from '@/lib/api';
import { generateWithLLM } from '@/lib/moltbook';

export const maxDuration = 120;

// --- Sources ---

interface IntelItem {
  source: string;
  title: string;
  url: string;
  summary: string;
  date: string;
}

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
          date: r.published_at?.split('T')[0] || new Date().toISOString().split('T')[0],
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
      const path = match[1];
      if (seen.has(path) || path === '/blog/rss.xml') continue;
      seen.add(path);
      if (items.length >= 8) break;
      items.push({
        source: 'radix_blog',
        title: path.replace('/blog/', '').replace(/-/g, ' '),
        url: `https://www.radixdlt.com${path}`,
        summary: '',
        date: new Date().toISOString().split('T')[0],
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
      const path = match[1];
      if (path === '/' || items.length >= 5) continue;
      items.push({
        source: 'radix_learn',
        title: match[2].trim(),
        url: `https://learn.radixdlt.com${path}`,
        summary: '',
        date: new Date().toISOString().split('T')[0],
      });
    }
    return items;
  } catch { return []; }
}

// --- Triage ---

const TRIAGE_PROMPT = `You are a research scout for radix.wiki. Given intel items from Radix ecosystem sources and a list of existing wiki pages, identify items that:
1. Are NOT already covered by existing wiki pages
2. Are significant enough to warrant a new wiki article

For each relevant item, output a JSON array: [{ "title": "...", "url": "...", "reason": "...", "suggestedSlug": "...", "suggestedTagPath": "contents/tech/..." }]

Only include genuinely newsworthy items (major releases, new features, architectural changes). Skip minor patches, routine updates, and already-covered topics.
Respond with ONLY the JSON array. If nothing is noteworthy, respond with [].`;

// --- Route ---

export async function GET(request: Request) {
  return handleRoute(async () => {
    const cronErr = requireCron(request);
    if (cronErr) return cronErr;

    // 1. Gather intel from all sources
    const [github, blog, learn] = await Promise.all([
      fetchGitHubReleases(),
      fetchRadixBlog(),
      fetchRadixLearn(),
    ]);
    const allIntel = [...github, ...blog, ...learn];

    if (allIntel.length === 0) return json({ status: 'no_sources_reachable', items: 0 });

    // 2. Deduplicate against intel gathered in the last 7 days
    const recentIntel = await prisma.tweet.findMany({
      where: { type: 'scout_intel', createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      select: { inReplyTo: true },
    });
    const recentUrls = new Set(recentIntel.map(r => r.inReplyTo).filter(Boolean));
    const newIntel = allIntel.filter(i => !recentUrls.has(i.url));

    if (newIntel.length === 0) return json({ status: 'no_new_intel', items: 0 });

    // 3. Store all new intel
    for (const item of newIntel) {
      await prisma.tweet.create({
        data: { type: 'scout_intel', text: JSON.stringify(item), status: 'new', inReplyTo: item.url },
      });
    }

    // 4. LLM triage: which items deserve wiki pages?
    const existingPages = await prisma.page.findMany({ select: { title: true, slug: true, tagPath: true } });
    const pageList = existingPages.map(p => `${p.tagPath}/${p.slug}: ${p.title}`).join('\n');
    const triageInput = `Intel items:\n${JSON.stringify(newIntel, null, 2)}\n\nExisting wiki pages:\n${pageList}`;
    const triageResult = await generateWithLLM(TRIAGE_PROMPT, triageInput, 500);

    let flagged: Array<{ url?: string }> = [];
    if (triageResult) {
      try {
        const match = triageResult.match(/\[[\s\S]*\]/);
        flagged = match ? JSON.parse(match[0]) : [];
      } catch { flagged = []; }
    }

    // 5. Mark flagged items
    for (const item of flagged) {
      if (item.url) {
        await prisma.tweet.updateMany({
          where: { type: 'scout_intel', inReplyTo: item.url },
          data: { status: 'flagged' },
        });
      }
    }

    return json({
      status: 'completed',
      sources: { github: github.length, blog: blog.length, learn: learn.length },
      new: newIntel.length,
      flagged: flagged.length,
      items: flagged,
    });
  }, 'Scout: intel sweep failed');
}
