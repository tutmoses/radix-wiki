// src/lib/radix/ledger.ts — On-chain wiki backup via account metadata

import pako from 'pako';
import { paginatedGatewayFetch } from './gateway';

// ========== TYPES ==========

export interface PageSnapshot {
  id: string;
  slug: string;
  tagPath: string;
  title: string;
  content: unknown;
  excerpt: string | null;
  version: string;
  updatedAt: string;
}

export interface LedgerAnchor {
  timestamp: string;
  slug: string;
  version: number;
  pageVersion: string;
  chunks: number;
}

// ========== CONFIG ==========

const PAGE_PREFIX = 'wiki_page:';
const ANCHOR_KEY = 'wiki_anchor';
const CHUNK_MAX = 3800; // safe limit under Radix's 4096-byte metadata cap (hex + escaping overhead)

// ========== COMPRESSION ==========

export function compressPage(page: PageSnapshot): string {
  const json = JSON.stringify(page);
  const compressed = pako.gzip(new TextEncoder().encode(json));
  return Buffer.from(compressed).toString('hex');
}

export function decompressPage(hex: string): PageSnapshot {
  const bytes = Buffer.from(hex, 'hex');
  const decompressed = pako.ungzip(bytes);
  return JSON.parse(new TextDecoder().decode(decompressed));
}

// ========== MANIFEST BUILDER ==========

function metadataInstruction(address: string, key: string, value: string): string {
  const escaped = value.replace(/"/g, '\\"');
  return `SET_METADATA\n  Address("${address}")\n  "${key}"\n  Enum<Metadata::String>("${escaped}")\n;\n`;
}

export function buildPageBackupManifest(accountAddress: string, page: PageSnapshot): string {
  const compressed = compressPage(page);
  const chunks: string[] = [];
  for (let i = 0; i < compressed.length; i += CHUNK_MAX) {
    chunks.push(compressed.slice(i, i + CHUNK_MAX));
  }

  const anchor: LedgerAnchor = {
    timestamp: new Date().toISOString(),
    slug: page.slug,
    version: 1,
    pageVersion: page.version,
    chunks: chunks.length,
  };

  const baseKey = `${PAGE_PREFIX}${page.slug}`;
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

export async function readAllPagesFromLedger(accountAddress: string): Promise<PageSnapshot[]> {
  const metadata = await fetchAllMetadata(accountAddress);
  const pages: PageSnapshot[] = [];
  const seen = new Set<string>();

  for (const [key] of metadata) {
    if (!key.startsWith(PAGE_PREFIX)) continue;
    // Extract base slug: "wiki_page:foo:0" → "wiki_page:foo", "wiki_page:foo" → "wiki_page:foo"
    const withoutPrefix = key.slice(PAGE_PREFIX.length);
    const baseSlug = withoutPrefix.replace(/:\d+$/, '');
    if (seen.has(baseSlug)) continue;
    seen.add(baseSlug);

    try {
      const baseKey = `${PAGE_PREFIX}${baseSlug}`;
      let hex = '';
      for (let i = 0; ; i++) {
        const chunk = metadata.get(`${baseKey}:${i}`);
        if (!chunk) break;
        hex += chunk;
      }
      if (hex) pages.push(decompressPage(hex));
    } catch (err) {
      console.error(`[ledger] Failed to decompress ${key}:`, err);
    }
  }

  return pages;
}
