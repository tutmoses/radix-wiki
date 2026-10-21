// scripts/migrate-lists.ts – one-off: recentPages and pageList, rewritten as
// wiki-formant's list over every stored page and revision. Delete it once it has run.
//
//   npx tsx scripts/migrate-lists.ts [--write] [--backup <file>]
//
// recentPages { tagPath, limit } becomes list { source: 'newest', under, count };
// pageList { pageIds } becomes list { source: 'chosen', pages }, the same ids in
// the same order. Newest pages show as cards, as the homepage draws them; picked
// pages as links. The id and every other field stay, at any
// depth, so a list inside columns or an infobox is rewritten too.
//
// Without --write it reads everything, checks each rewritten page against
// validateBlocks, and says what it would change. --write applies it in one
// transaction, in SQL so no page's updatedAt moves, and refuses while any page
// fails the check; a revision that fails is reported. --backup saves every row
// it would change, as it is now.

import { writeFileSync } from 'node:fs';

try { process.loadEnvFile(); } catch {} // the .env in the working directory
export {};

// The Prisma client connects on import, so it is loaded only once the env is.
const { prisma } = await import('@/lib/prisma/client');
const { validateBlocks, blockIssues } = await import('@/lib/block-utils');
const { describeBlockIssues, blockLimit, MAX_BLOCK_ROWS } = await import('wiki-formant/validation');

const write = process.argv.includes('--write');
const backupFlag = process.argv.indexOf('--backup');
const backupAt = backupFlag === -1 ? undefined : process.argv[backupFlag + 1];
if (backupFlag !== -1 && (!backupAt || backupAt.startsWith('--'))) throw new Error('--backup takes a file');

type Raw = Record<string, unknown>;
const OLD = /"type":\s*"(recentPages|pageList)"/;

const tally = { recentPages: 0, pageList: 0 };

function block({ type, tagPath, section, limit, pageIds, resolvedPages: _, ...rest }: Raw): Raw {
  if (type === 'recentPages') {
    tally.recentPages++;
    const under = [tagPath, section].find(s => typeof s === 'string' && s.trim());
    return { ...rest, type: 'list', source: 'newest', ...(under ? { under } : {}), count: blockLimit(limit, 5, MAX_BLOCK_ROWS), show: 'cards' };
  }
  tally.pageList++;
  return { ...rest, type: 'list', source: 'chosen', pages: Array.isArray(pageIds) ? pageIds : [], show: 'links' };
}

/** Every recentPages and pageList in a JSON value, however deep, rewritten. */
function rewrite(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewrite);
  if (!value || typeof value !== 'object') return value;
  const raw = value as Raw;
  const next = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, rewrite(v)]));
  return raw.type === 'recentPages' || raw.type === 'pageList' ? block(next) : next;
}

const stale = (v: unknown) => OLD.test(JSON.stringify(v));
const why = (content: unknown) => describeBlockIssues(blockIssues(content));

type PageRow = { id: string; siteId: string; tagPath: string; slug: string; content: unknown };
type RevisionRow = { id: string; pageId: string; version: string; content: unknown };

const pages = (await prisma.$queryRaw<PageRow[]>`SELECT id, "siteId", "tagPath", slug, content FROM "WikiPage"`).filter(p => stale(p.content));
const revisions = (await prisma.$queryRaw<RevisionRow[]>`SELECT id, "pageId", version, content FROM "WikiRevision"`).filter(r => stale(r.content));

const before = { ...tally };
const nextPages = pages.map(p => ({ id: p.id, content: rewrite(p.content) }));
const pageBlocks = { recentPages: tally.recentPages - before.recentPages, pageList: tally.pageList - before.pageList };
const nextRevisions = revisions.map(r => ({ id: r.id, content: rewrite(r.content) }));
const revisionBlocks = { recentPages: tally.recentPages - pageBlocks.recentPages, pageList: tally.pageList - pageBlocks.pageList };

const failing: string[] = [];
pages.forEach((p, i) => {
  const where = `${p.siteId ? `${p.siteId}:` : ''}/${[p.tagPath, p.slug].filter(Boolean).join('/')}`;
  if (!validateBlocks(nextPages[i]!.content)) failing.push(`page ${where}: ${why(nextPages[i]!.content)}`);
});
for (const x of [...nextPages, ...nextRevisions]) if (stale(x.content)) failing.push(`still holds an old block: ${x.id}`);
// A revision is history, and may hold a type retired before this one, so it is
// reported rather than refused.
const oldRevisions = revisions.flatMap((r, i) => validateBlocks(nextRevisions[i]!.content) ? [] : [`revision ${r.id} (page ${r.pageId}, ${r.version}): ${why(nextRevisions[i]!.content)}`]);

// Anywhere else a stored JSON column could hold one, counted so a miss shows.
const [elsewhere] = await prisma.$queryRaw<{ metadata: number; props: number }[]>`
  SELECT (SELECT count(*)::int FROM "WikiPage" WHERE metadata::text ~ '"type": ?"(recentPages|pageList)"') AS metadata,
         (SELECT count(*)::int FROM "Event" WHERE props::text ~ '"type": ?"(recentPages|pageList)"') AS props`;

console.log(`WikiPage: ${pages.length} pages, ${pageBlocks.recentPages} recentPages and ${pageBlocks.pageList} pageList blocks.`);
console.log(`WikiRevision: ${revisions.length} revisions, ${revisionBlocks.recentPages} recentPages and ${revisionBlocks.pageList} pageList blocks.`);
console.log(`Elsewhere: ${elsewhere?.metadata ?? 0} page metadata, ${elsewhere?.props ?? 0} analytics events (neither is rewritten).`);
for (const p of pages) {
  const lists = JSON.stringify(nextPages.find(n => n.id === p.id)!.content).match(/\{[^{}]*"type":"list"[^{}]*\}/g) ?? [];
  console.log(`  /${[p.tagPath, p.slug].filter(Boolean).join('/')}: ${lists.map(l => { const b = JSON.parse(l) as Raw; return b.source === 'chosen' ? `chosen ${(b.pages as string[]).length}` : `newest ${b.count}${b.under ? ` in ${b.under}` : ''}`; }).join(', ')}`);
}
console.log(`Every rewritten page passes validateBlocks: ${failing.length ? 'no' : 'yes'}.`);
if (failing.length) console.log(failing.slice(0, 40).join('\n'));
console.log(`Rewritten revisions that fail validateBlocks: ${oldRevisions.length}.`);
if (oldRevisions.length) console.log(oldRevisions.slice(0, 20).join('\n'));

if (backupAt) {
  writeFileSync(backupAt, JSON.stringify({ pages, revisions }));
  console.log(`Saved the ${pages.length + revisions.length} rows as they are to ${backupAt}.`);
}

if (write) {
  if (failing.length) throw new Error('Refusing to write while any rewritten page fails validateBlocks.');
  await prisma.$transaction(async tx => {
    for (const p of nextPages) await tx.$executeRaw`UPDATE "WikiPage" SET content = ${JSON.stringify(p.content)}::jsonb WHERE id = ${p.id}`;
    for (const r of nextRevisions) await tx.$executeRaw`UPDATE "WikiRevision" SET content = ${JSON.stringify(r.content)}::jsonb WHERE id = ${r.id}`;
  }, { maxWait: 10_000, timeout: 300_000 });
  console.log(`Written: ${nextPages.length} pages and ${nextRevisions.length} revisions.`);
}
process.exit(0);
