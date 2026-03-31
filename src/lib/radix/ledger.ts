// src/lib/radix/ledger.ts — On-chain wiki backup via account metadata

import { paginatedGatewayFetch } from './gateway';

// ========== TYPES ==========

export interface LedgerAnchor {
  timestamp: string;
  slug: string;
  version: number;
  pageVersion: string;
  chunks: number;
}

export interface RestoredPage {
  slug: string;
  tagPath: string;
  title: string;
  version: string;
  mdx: string;
}

// ========== CONFIG ==========

const PAGE_PREFIX = 'wiki_page:';
const ANCHOR_KEY = 'wiki_anchor';
const CHUNK_MAX = 3800; // safe limit under Radix's 4096-byte metadata cap

// ========== MANIFEST BUILDER ==========

function metadataInstruction(address: string, key: string, value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `SET_METADATA\n  Address("${address}")\n  "${key}"\n  Enum<Metadata::String>("${escaped}")\n;\n`;
}

export function buildPageBackupManifest(
  accountAddress: string,
  meta: { slug: string; pageVersion: string },
  mdx: string,
): string {
  const chunks: string[] = [];
  for (let i = 0; i < mdx.length; i += CHUNK_MAX) {
    chunks.push(mdx.slice(i, i + CHUNK_MAX));
  }

  const anchor: LedgerAnchor = {
    timestamp: new Date().toISOString(),
    slug: meta.slug,
    version: 1,
    pageVersion: meta.pageVersion,
    chunks: chunks.length,
  };

  const baseKey = `${PAGE_PREFIX}${meta.slug}`;
  const instructions = [
    metadataInstruction(accountAddress, ANCHOR_KEY, JSON.stringify(anchor)),
    ...chunks.map((chunk, i) =>
      metadataInstruction(accountAddress, `${baseKey}:${i}`, chunk),
    ),
  ];

  return instructions.join('\n');
}

// ========== GATEWAY API READER ==========

interface MetadataItem {
  key: string;
  value: { typed: { type: string; value: string } };
}

async function fetchAllMetadata(address: string): Promise<Map<string, string>> {
  const items = await paginatedGatewayFetch<[string, string]>(
    '/state/entity/page/metadata/',
    { address },
    (data) => ((data as { items?: MetadataItem[] }).items ?? [])
      .filter(item => item.value?.typed?.type === 'String')
      .map(item => [item.key, item.value.typed.value] as [string, string]),
    'ledger',
  );
  return new Map(items);
}

export async function readAnchorFromLedger(accountAddress: string): Promise<LedgerAnchor | null> {
  const metadata = await fetchAllMetadata(accountAddress);
  const raw = metadata.get(ANCHOR_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LedgerAnchor;
  } catch {
    return null;
  }
}

function parseMdxFrontmatter(mdx: string): { title: string; tagPath: string; slug: string; version: string } | null {
  const match = mdx.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = match[1]!;
  const get = (key: string) => fm.match(new RegExp(`^${key}: "(.+)"`, 'm'))?.[1] ?? '';
  const path = get('path'); // e.g. /contents/tech/foo
  const parts = path.replace(/^\//, '').split('/');
  const slug = parts.pop() ?? '';
  const tagPath = parts.join('/');
  return { title: get('title'), tagPath, slug, version: get('version') };
}

export async function readAllPagesFromLedger(accountAddress: string): Promise<RestoredPage[]> {
  const metadata = await fetchAllMetadata(accountAddress);
  const pages: RestoredPage[] = [];
  const seen = new Set<string>();

  for (const [key] of metadata) {
    if (!key.startsWith(PAGE_PREFIX)) continue;
    const withoutPrefix = key.slice(PAGE_PREFIX.length);
    const baseSlug = withoutPrefix.replace(/:\d+$/, '');
    if (seen.has(baseSlug)) continue;
    seen.add(baseSlug);

    try {
      const baseKey = `${PAGE_PREFIX}${baseSlug}`;
      let mdx = '';
      for (let i = 0; ; i++) {
        const chunk = metadata.get(`${baseKey}:${i}`);
        if (!chunk) break;
        mdx += chunk;
      }
      if (!mdx) continue;
      const parsed = parseMdxFrontmatter(mdx);
      if (parsed) pages.push({ ...parsed, mdx });
    } catch (err) {
      console.error(`[ledger] Failed to parse ${key}:`, err);
    }
  }

  return pages;
}
