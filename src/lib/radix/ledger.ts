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
  pageVersion?: string;
}

// ========== CONFIG ==========

const PAGE_PREFIX = 'wiki_page:';
const ANCHOR_KEY = 'wiki_anchor';

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
  const anchor: LedgerAnchor = {
    timestamp: new Date().toISOString(),
    slug: page.slug,
    version: 1,
    pageVersion: page.version,
  };

  const key = `${PAGE_PREFIX}${page.slug}`;
  const compressed = compressPage(page);

  return [
    metadataInstruction(accountAddress, ANCHOR_KEY, JSON.stringify(anchor)),
    metadataInstruction(accountAddress, key, compressed),
  ].join('\n');
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

  for (const [key, value] of metadata) {
    if (!key.startsWith(PAGE_PREFIX)) continue;
    try {
      pages.push(decompressPage(value));
    } catch (err) {
      console.error(`[ledger] Failed to decompress ${key}:`, err);
    }
  }

  return pages;
}
