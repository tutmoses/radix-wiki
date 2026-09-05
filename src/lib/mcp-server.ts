// src/lib/mcp-server.ts — the wiki's MCP server: instructions, resources, tool
// handlers, and the config that wires them onto the manifest.
//
// Separate from @/lib/mcp-tools, which is the manifest alone. Three other
// routes (.well-known/agent.json, the server card, the OpenAPI spec) read that
// manifest and have no business pulling a Prisma client in behind it, which is
// what a single combined module would cost them.
//
// The protocol edges (CORS, GET→405, −32700, bare 202, batch cap, teaching arg
// validation) are `wiki-formant/mcp`, shared with the other wikis.

import { prisma } from '@/lib/prisma/client';
import { BASE_URL, categoryLabel, pageUrl, pagePath } from '@/lib/utils';
import { NOT_HIDDEN, orderByIds, searchPageIds, summarizePage, SUMMARY_SELECT } from '@/lib/wiki';
import { listEnvelope } from 'wiki-formant/pagination';
import { MCP_RATE_LIMIT_TEXT } from '@/lib/api';
import { extractText } from '@/lib/content';
import { buildFullCorpus, buildLlmsTxt } from '@/lib/llms';
import { TAG_HIERARCHY, getMetadataKeys, type TagNode } from '@/lib/tags';
import { TOOLS, SERVER_INFO } from '@/lib/mcp-tools';
import { RADIX_CONFIG } from '@/lib/radix/config';
import { trackMcpCall } from '@/lib/track';
import { McpToolError, type McpServerConfig, type McpResource } from 'wiki-formant/mcp';
import type { Block } from '@/types/blocks';

const INSTRUCTIONS = [
  'Community-maintained knowledge base for Radix DLT, the layer-1 with linear scalability and asset-oriented smart contracts.',
  'Usual sequence: get_categories to orient, search_wiki or list_pages to locate, then get_page to read. Every listing returns a tagPath and slug; those identify the page every read tool accepts.',
  `Reads are open and never authenticate. Rate limit: ${MCP_RATE_LIMIT_TEXT}, shared across all methods.`,
  'Writing without leaving the protocol: get_challenge → sign the ROLA message with your own Ed25519 key → login (returns a Bearer token) → create_page / edit_page with that token as an HTTP `Authorization: Bearer <token>` header on the POSTs carrying the calls.',
  `Deep reference (ROLA signing spec, REST equivalents, content model): ${BASE_URL}/AGENTS.md (also served at ${BASE_URL}/agents-md). Any page URL + ".md" is its markdown twin.`,
].join('\n');

// ========== RESOURCES ==========

const RESOURCES: McpResource[] = [
  {
    uri: 'radix-wiki://llms.txt',
    name: 'RADIX Wiki LLM Briefing',
    description: 'Narrative briefing document with investment thesis, technical overview, and page index.',
    mimeType: 'text/plain',
    // Built in-process. This used to fetch `${BASE_URL}/llms.txt` — a round
    // trip out of the datacentre to reach a function in the same process,
    // which also served null whenever the deploy it called was cold or down.
    read: () => buildLlmsTxt(),
  },
  {
    uri: 'radix-wiki://categories',
    name: 'Wiki Categories',
    description: 'Tag hierarchy with descriptions and page counts.',
    mimeType: 'application/json',
    read: async () => JSON.stringify(await get_categories(), null, 2),
  },
];

// ========== DB SELECT SHAPES ==========

const FULL_SELECT = { ...SUMMARY_SELECT, version: true } as const;
const IDEAS_SELECT = { title: true, tagPath: true, slug: true, metadata: true, updatedAt: true } as const;

// ========== IDEAS BOARD HELPERS ==========

/** Assignee is stored either as a JSON string {name,address} or a plain name. */
function assigneeName(raw?: string): string | null {
  if (!raw) return null;
  try { const parsed = JSON.parse(raw); return (parsed && parsed.name) || null; } catch { return raw; }
}

/** Working group is encoded as a "<WG> · <task>" title prefix. */
function workingGroupFromTitle(title: string): string | null {
  const i = title.indexOf('·');
  return i === -1 ? null : title.slice(0, i).trim();
}

// ========== TAG HIERARCHY HELPERS ==========

function buildCategoryTree(nodes: TagNode[], counts: Map<string, number>, parent = ''): object[] {
  return nodes.filter(n => !n.hidden && n.slug).map(n => {
    const path = parent ? `${parent}/${n.slug}` : n.slug;
    return {
      path,
      name: categoryLabel(n.name),
      ...(n.description ? { description: n.description } : {}),
      pageCount: counts.get(path) || 0,
      ...(n.children ? { children: buildCategoryTree(n.children, counts, path) } : {}),
    };
  });
}

// ========== READ HANDLERS ==========

async function search_wiki(args: { query: string; tagPath?: string; page?: number; pageSize?: number }) {
  const { query, tagPath, page = 1, pageSize = 20 } = args;
  const size = Math.min(pageSize, 50);
  const { ids, total, headlines } = await searchPageIds(query, { tagPath, skip: (page - 1) * size, take: size });
  const results = ids.length
    ? await prisma.page.findMany({ where: { id: { in: ids } }, select: { id: true, ...SUMMARY_SELECT } })
    : [];
  return listEnvelope(orderByIds(results, ids).map(p => summarizePage(p, query, headlines.get(p.id))), total, page, size);
}

async function get_page(args: { tagPath: string; slug: string }) {
  const p = await prisma.page.findUnique({
    where: { tagPath_slug: { tagPath: args.tagPath, slug: args.slug } },
    select: FULL_SELECT,
  });
  if (!p) {
    throw new McpToolError(
      `No page at tagPath "${args.tagPath}", slug "${args.slug}". Find valid paths with search_wiki, list_pages, or get_categories.`,
    );
  }
  return {
    ...summarizePage(p),
    version: p.version,
    content: extractText((p.content as unknown as Block[]) || []),
  };
}

async function list_pages(args: { tagPath?: string; sort?: string; page?: number; pageSize?: number }) {
  const { tagPath, sort = 'updatedAt', page = 1, pageSize = 20 } = args;
  const size = Math.min(pageSize, 100);
  // Naming a path gets that path. Naming none gets article space, not the
  // wiki's own operations log sitting at the top of it.
  const where = tagPath ? { tagPath } : { tagPath: NOT_HIDDEN };
  const orderBy = sort === 'title' ? { title: 'asc' as const } : { updatedAt: 'desc' as const };
  const [results, total] = await Promise.all([
    prisma.page.findMany({ where, select: SUMMARY_SELECT, orderBy, skip: (page - 1) * size, take: size }),
    prisma.page.count({ where }),
  ]);
  return listEnvelope(results.map(page => summarizePage(page)), total, page, size);
}

async function get_categories() {
  // The tree already drops hidden nodes; the total has to drop their pages too,
  // or `get_categories` and `list_pages` report two different sizes for the
  // same wiki and an agent has no way to tell which one it is walking.
  const counts = await prisma.page.groupBy({ by: ['tagPath'], _count: true, where: { tagPath: NOT_HIDDEN } });
  const countMap = new Map(counts.map(c => [c.tagPath, c._count]));
  return { categories: buildCategoryTree(TAG_HIERARCHY, countMap), totalPages: counts.reduce((s, c) => s + c._count, 0) };
}

async function get_recent_changes(args: { days?: number; limit?: number }) {
  const days = Math.min(args.days || 7, 30);
  const limit = Math.min(args.limit || 20, 50);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const pages = await prisma.page.findMany({
    where: { updatedAt: { gte: since }, tagPath: NOT_HIDDEN },
    select: SUMMARY_SELECT,
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });
  return { days, count: pages.length, pages: pages.map(page => summarizePage(page)) };
}

// The same walk /llms-full.txt serves. The document header stays this tool's
// own — its clients parse it, and the URL's carries a licence grant instead.
const get_full_corpus = () => buildFullCorpus(pageCount =>
  `# Radix Wiki — Full Content\n\n> ${pageCount} pages, generated ${new Date().toISOString().split('T')[0]}`);

async function get_ideas_board(args: { category?: string; workingGroup?: string }) {
  const pages = await prisma.page.findMany({
    where: { tagPath: { startsWith: 'ideas' } },
    select: IDEAS_SELECT,
    orderBy: { updatedAt: 'desc' },
  });

  const catFilter = args.category ? categoryLabel(args.category).toLowerCase() : null;
  const wgFilter = args.workingGroup ? args.workingGroup.toLowerCase() : null;

  const cards = pages.map(p => {
    const m = (p.metadata ?? {}) as Record<string, string>;
    return {
      title: p.title,
      url: pageUrl(p.tagPath, p.slug),
      workingGroup: workingGroupFromTitle(p.title),
      rawStatus: m.status ?? '',
      priority: categoryLabel(m.priority) || null,
      category: categoryLabel(m.category) || null,
      assignee: assigneeName(m.assignee),
      updatedAt: p.updatedAt.toISOString().split('T')[0],
    };
  }).filter(c => {
    if (catFilter && (c.category ?? '').toLowerCase() !== catFilter) return false;
    if (wgFilter && !(c.workingGroup ?? '').toLowerCase().includes(wgFilter)) return false;
    return true;
  });

  const statusOptions = getMetadataKeys(['ideas']).find(k => k.key === 'status')?.options ?? [];
  const known = new Set(statusOptions);
  const shape = (c: typeof cards[number]) => ({
    title: c.title, workingGroup: c.workingGroup, category: c.category,
    priority: c.priority, assignee: c.assignee, url: c.url, updatedAt: c.updatedAt,
  });

  const columns = statusOptions.map(opt => {
    const items = cards.filter(c => c.rawStatus === opt);
    return { status: categoryLabel(opt), count: items.length, cards: items.map(shape) };
  });
  const orphans = cards.filter(c => !known.has(c.rawStatus));
  if (orphans.length) columns.push({ status: 'Uncategorized', count: orphans.length, cards: orphans.map(shape) });

  return { board: 'ideas', url: `${BASE_URL}/ideas`, totalCards: cards.length, columns };
}

// ========== AUTH BOOTSTRAP HANDLERS ==========
//
// The challenge→sign→token chain as tools, forwarding to the same REST auth
// endpoints the wallet flow uses, so an agent never has to leave the protocol.
// Auth rides the HTTP layer, not the tool arguments: `login` returns a Bearer
// token, and the client sends it as an `Authorization` header on the POSTs
// that carry subsequent write calls (the CORS allow-list already names it).

async function get_challenge() {
  const res = await fetch(`${BASE_URL}/api/auth/challenge`);
  const data = await res.json().catch(() => null) as { challenge?: string; expiresAt?: string; error?: string } | null;
  if (!res.ok || !data?.challenge) throw new McpToolError(data?.error || `Challenge request failed (${res.status})`);
  return {
    challenge: data.challenge,
    expiresAt: data.expiresAt,
    sign: {
      message: `blake2b-256 of: "R" (ascii) + challenge (hex-decoded) + one length byte of "${RADIX_CONFIG.dAppDefinitionAddress}" + that address (utf-8) + "${BASE_URL}" (utf-8)`,
      curve: 'curve25519 (Ed25519); sign the 32-byte hash, hex-encode the signature',
      address: 'your virtual account address derived from the public key — the key must be an on-ledger owner_keys entry for that account',
      then: 'Call login with { challenge, address, publicKey, signature, curve }.',
    },
  };
}

async function login(args: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accounts: [{ address: args.address }],
      signedChallenge: {
        challenge: args.challenge,
        address: args.address,
        proof: { publicKey: args.publicKey, signature: args.signature, curve: args.curve },
      },
    }),
  });
  const data = await res.json().catch(() => null) as Record<string, unknown> | null;
  if (!res.ok || !data?.token) {
    throw new McpToolError((data?.error as string) || `Login failed (${res.status})`, {
      hint: 'Challenges are single-use and expire after 5 minutes — call get_challenge again. The signing recipe is in its response; the public key must be an on-ledger owner_keys entry for the account.',
    });
  }
  return {
    token: data.token,
    tokenType: 'Bearer',
    expiresAt: data.expiresAt,
    radixAddress: data.radixAddress,
    note: 'Send as an HTTP `Authorization: Bearer <token>` header on the POSTs carrying create_page / edit_page calls.',
  };
}

// ========== WRITE HANDLERS ==========
//
// Writes forward to the REST wiki API carrying the caller's bearer token, so
// ROLA auth, XRD balance gating, locked/author-only checks, block validation,
// semver bumping, the revision entry, and cache revalidation all stay in the
// one handler that already owns them. Nothing about the write path is
// reimplemented here — this is a transport, not a second implementation.

async function forwardWrite(path: string, method: 'POST' | 'PUT', body: unknown, auth: string | null): Promise<Record<string, unknown>> {
  if (!auth) {
    throw new McpToolError(
      'Not authenticated. Call get_challenge, sign the ROLA message with your own key, call login, then resend this call with the returned token as an HTTP `Authorization: Bearer <token>` header.',
      { flow: ['get_challenge', 'login', 'create_page / edit_page'], reference: `${BASE_URL}/AGENTS.md` },
    );
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null) as Record<string, unknown> | null;
  if (!res.ok) throw new McpToolError((data?.error as string) || `Request failed (${res.status})`);
  return data ?? {};
}

async function create_page(args: Record<string, unknown>, auth: string | null) {
  const { tagPath, title, content, metadata, slug, bannerImage } = args;
  const result = await forwardWrite('/api/wiki', 'POST', { tagPath, title, content, metadata, slug, bannerImage }, auth);
  return {
    created: true,
    url: pageUrl(result.tagPath as string, result.slug as string),
    tagPath: result.tagPath,
    slug: result.slug,
    version: result.version,
    ...(result.isFirstContribution ? { isFirstContribution: true } : {}),
  };
}

async function edit_page(args: Record<string, unknown>, auth: string | null) {
  const { tagPath, slug, content, title, revisionMessage, metadata } = args;
  const result = await forwardWrite(`/api/wiki${pagePath(tagPath as string, (slug as string) ?? '')}`, 'PUT', { content, title, revisionMessage, metadata }, auth);
  return {
    edited: true,
    url: pageUrl(result.tagPath as string, result.slug as string),
    version: result.version,
  };
}

// ========== WIRING ==========

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

export function serverConfig(auth: string | null): McpServerConfig {
  const handlers: Record<string, Handler> = {
    search_wiki: args => search_wiki(args as Parameters<typeof search_wiki>[0]),
    get_page: args => get_page(args as Parameters<typeof get_page>[0]),
    list_pages: args => list_pages(args as Parameters<typeof list_pages>[0]),
    get_categories,
    get_recent_changes: args => get_recent_changes(args as Parameters<typeof get_recent_changes>[0]),
    get_full_corpus,
    get_ideas_board: args => get_ideas_board(args as Parameters<typeof get_ideas_board>[0]),
    get_challenge,
    login,
    create_page: args => create_page(args, auth),
    edit_page: args => edit_page(args, auth),
  };
  return {
    serverInfo: SERVER_INFO,
    instructions: INSTRUCTIONS,
    tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({
      name, title, description, inputSchema, annotations, handler: handlers[name]!,
    })),
    resources: RESOURCES,
    docsUrl: `${BASE_URL}/AGENTS.md`,
    onCall: (req, body) => trackMcpCall(req, SERVER_INFO.name, body),
  };
}
