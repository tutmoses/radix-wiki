// scripts/wiki-utils.ts — what this wiki's scripts add to `wiki-formant/scripts`:
// the author the routines write as, the locked pages the app refuses, the
// figures the week in review formats, and the two writes the infographics and
// the seeds make. The client, the store and the revision write are the
// package's.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertLinkShapes, content, readPage, storeFor, uid, withClient, writeRevision as revision, type RevisionOptions, type ScriptClient } from 'wiki-formant/scripts';
import type { WikiPageRow } from 'wiki-formant/store';

export { assertLinkShapes, content, readPage, storeFor, uid, withClient };

export const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz';
const ROOT = resolve(import.meta.dirname, '..');

export const esc = (s: unknown): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** "WikiPage".metadata is jsonb; every caller wants an object. */
export const meta = (row: { metadata?: unknown } | null | undefined): Record<string, unknown> =>
  row?.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {};
export const argOf = (flag: string): string | null => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
};

/** The Sunday that ends a week, so the ledger, the repositories and the recap key alike. */
export function weekKey(iso?: string): string {
  const d = iso ? new Date(`${iso}T00:00:00Z`) : new Date();
  const sunday = new Date(d);
  sunday.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return sunday.toISOString().slice(0, 10);
}

/** `blank` is what an absent reading prints: a dash in prose, nothing at all in an SVG figure. */
export const fmt = (n: number | null | undefined, digits = 0, blank = '—'): string =>
  n == null || !isFinite(n) ? blank : n.toLocaleString('en-US', { maximumFractionDigits: digits });

export function compact(n: number | null | undefined, blank = '—'): string {
  if (n == null || !isFinite(n)) return blank;
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return fmt(n, 0, blank);
}

/** Never invent a comparison: an absent or stale prior reading yields no delta at all. */
export function delta(now: number | null | undefined, was: number | null | undefined, { percent = true, staleDays = 10, gapDays = 0 } = {}): string {
  if (was == null || now == null || !isFinite(was) || !isFinite(now) || was === 0) return '';
  if (gapDays > staleDays) return '';
  const diff = now - was;
  if (diff === 0) return 'no change';
  const sign = diff > 0 ? '+' : '−';
  const mag = Math.abs(diff);
  return percent ? `${sign}${((mag / Math.abs(was)) * 100).toFixed(1)}%` : `${sign}${compact(mag)}`;
}

/**
 * The pages no script may write. `src/lib/tags.ts` guards the API path; a
 * direct-DB script bypasses it, so it reads the same literal from the source,
 * which a `node` run cannot import through the app's `@/` alias.
 */
const LOCKED_PAGES = new Set(
  [...(readFileSync(resolve(ROOT, 'src/lib/tags.ts'), 'utf8').match(/LOCKED_PAGES\s*=\s*new Set\(\[([^\]]*)\]/)?.[1] ?? '').matchAll(/['"`]([^'"`]+)['"`]/g)].map(m => m[1]!),
);
export const isLockedPage = (tagPath: string, slug: string): boolean => LOCKED_PAGES.has(`${tagPath}/${slug}`);

type Page = WikiPageRow<{ id: string; type: string }>;
type Blocks = Page['content'];

/**
 * Insert or replace a `data-graphic="<marker>"` figure block on a loaded page row,
 * writing one revision when it changes. Idempotent: html identical to what is
 * already stored is not rewritten. `place(blocks)` chooses where a new block goes
 * and defaults to the end. Null when the page already carries exactly this figure.
 */
export async function embedFigure(
  client: ScriptClient,
  page: Page,
  { marker, html, place, message, dry }: { marker: string; html: string; place?: (blocks: Blocks) => number; message?: string; dry?: boolean },
): Promise<{ action: string; version: string; blocks: Blocks } | null> {
  const blocks: Blocks = Array.isArray(page.content) ? JSON.parse(JSON.stringify(page.content)) : [];
  const has = (b: { type: string; text?: unknown }) => b.type === 'content' && typeof b.text === 'string' && b.text.includes(`data-graphic="${marker}"`);
  const at = blocks.findIndex(has);

  let action: string;
  if (at >= 0) {
    if ((blocks[at] as { text?: string }).text === html) return null;
    blocks[at] = { ...blocks[at]!, text: html } as Blocks[number];
    action = `replaced [${at}]`;
  } else {
    const pos = place ? place(blocks) : blocks.length;
    blocks.splice(pos, 0, content(html));
    action = pos === blocks.length - 1 ? `appended [${pos}]` : `inserted [${pos}]`;
  }

  const version = await writeRevision(client, page, blocks, { message, dry });
  return { action, version, blocks };
}

/** The package's `writeRevision`, signed by Hydrate. */
export const writeRevision = (client: ScriptClient, page: Page, blocks: Blocks, opts: RevisionOptions = {}) =>
  revision(client, page, blocks, { authorId: AUTHOR_ID, ...opts });

/** Insert pages into the database, skipping locked ones and ones that exist. */
export async function insertPages(
  pages: Array<{ slug: string; title: string; content: Blocks; metadata?: Record<string, unknown>; tagPath?: string }>,
  defaultTagPath: string,
  revisionMessage = 'Initial page',
): Promise<void> {
  await withClient(async client => {
    const store = storeFor(client);
    let inserted = 0, skipped = 0;
    for (const page of pages) {
      const tagPath = page.tagPath || defaultTagPath;
      if (isLockedPage(tagPath, page.slug)) {
        console.warn(`SKIP ${tagPath}/${page.slug} — locked page (LOCKED_PAGES in src/lib/tags.ts)`);
        skipped++;
        continue;
      }
      if (await store.get(tagPath, page.slug)) { skipped++; continue; }
      assertLinkShapes(page.content, `${tagPath}/${page.slug}`);
      await store.save({ tagPath, slug: page.slug, title: page.title, content: page.content, metadata: page.metadata ?? {}, authorId: AUTHOR_ID, message: revisionMessage });
      inserted++;
    }
    console.log(`Done. Inserted: ${inserted}, Skipped: ${skipped}`);
  });
}
