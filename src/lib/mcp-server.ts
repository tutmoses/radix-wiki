// src/lib/mcp-server.ts — the wiki's MCP server: instructions, resources, tool
// handlers, and the config that wires them onto the manifest.
//
// Separate from @/lib/mcp-tools, the manifest the agent card, the server card
// and the OpenAPI spec read. Its read tools come with their handlers from
// `wiki-formant/wiki-tools`; the ones only this wiki has are wired here.
//
// The protocol edges (CORS, GET→405, −32700, bare 202, batch cap, teaching arg
// validation) are `wiki-formant/mcp`, shared with the other wikis.

import { prisma } from '@/lib/prisma/client';
import { categoryLabel, pageUrl, pagePath } from '@/lib/utils';
import { isoDate } from 'wiki-formant/freshness';
import { SIBLING_WIKI, SITE_NAME, SITE_URL } from '@/lib/site';
import { MCP_RATE_LIMIT, MCP_RATE_LIMIT_TEXT } from 'wiki-formant/rate-limit';
import { buildLlmsTxt } from '@/lib/llms';
import { getMetadataKeys } from '@/lib/tags';
import { TOOLS, SERVER_INFO } from '@/lib/mcp-tools';
import { RADIX_CONFIG } from '@/lib/radix/config';
import { getLedgerDayRows } from '@/lib/radix/activity';
import { trackMcpCall } from '@/lib/track';
import { uploadImage } from '@/lib/upload';
import { generateChallenge } from '@/lib/auth';
import { McpToolError, readArgs, type McpServerConfig, type McpPrompt, type McpResource, type ToolContext } from 'wiki-formant/mcp';

const INSTRUCTIONS = [
  'Community-maintained knowledge base for Radix DLT, the layer-1 with linear scalability and asset-oriented smart contracts.',
  'Usual sequence: get_categories to orient, search_wiki or list_pages to locate, then get_page to read. Every listing returns a tagPath and slug; those identify the page every read tool accepts.',
  `Reads are open and never authenticate. Rate limit: ${MCP_RATE_LIMIT_TEXT}, shared across all methods.`,
  'Writing without leaving the protocol: get_challenge → sign the ROLA message with your own Ed25519 key → login (returns a Bearer token) → create_page / edit_page with that token as an HTTP `Authorization: Bearer <token>` header on the POSTs carrying the calls. To edit, read the page with get_page and `blocks: true`, then send edit_page its revised blocks and its `version` as baseVersion.',
  `Deep reference (ROLA signing spec, REST equivalents, content model): ${SITE_URL}/AGENTS.md (also served at ${SITE_URL}/agents-md). Any page URL + ".md" is its markdown twin; the homepage's is ${SITE_URL}/index.md.`,
  `The Radix DAO's own decisions are covered here. For ${SIBLING_WIKI.covers}, use the sister wiki's server: ${SIBLING_WIKI.mcp}.`,
].join('\n');

// ========== RESOURCES ==========

const RESOURCES: McpResource[] = [
  {
    uri: 'radix-wiki://llms.txt',
    name: `${SITE_NAME} LLM Briefing`,
    description: 'Narrative briefing document with investment thesis, technical overview, and page index.',
    mimeType: 'text/plain',
    // Built in-process rather than fetched from `${SITE_URL}/llms.txt`, which
    // would be a round trip out of the datacentre to reach a function in the
    // same process, and null whenever the deploy it called was cold or down.
    read: () => buildLlmsTxt(),
  },
  {
    uri: 'radix-wiki://categories',
    name: 'Wiki Categories',
    description: 'Tag hierarchy with descriptions and page counts.',
    mimeType: 'application/json',
    read: async () => JSON.stringify(await TOOLS.find(t => t.name === 'get_categories')!.handler!({}, {} as ToolContext), null, 2),
  },
];

// ========== PROMPTS ==========
//
// Tools are what an agent reaches for once it has a question; prompts are what
// a person clicks when they do not have one yet. Each one names the call order
// outright rather than restating the question — the model reading it holds the
// tool list already, and nothing in that list says which tool to try first.

const PROMPTS: McpPrompt[] = [
  {
    name: 'what_is_radix',
    description: 'What is Radix, and what makes it different from other layer-1s?',
    text: 'Explain Radix DLT and what distinguishes it. Start with get_categories to see how the wiki is organised, then search_wiki for "Cerberus" and "asset-oriented", and read the most relevant pages with get_page. Cite each page URL you use.',
  },
  {
    name: 'orient_me',
    description: 'Show me what this wiki covers',
    text: 'Call get_categories, then list_pages on the two or three largest branches, and summarise what the Radix Wiki covers and where the depth is. Do not call get_full_corpus.',
  },
  {
    name: 'whats_changed',
    description: "What has changed on the wiki recently, and what is the DAO working on?",
    text: 'Call get_recent_changes for the last 30 days and get_ideas_board, then summarise what has moved on the wiki and what the working groups have in flight. Group by theme, not by date.',
  },
  {
    name: 'ingest_the_wiki',
    description: 'Ingest the whole wiki into my own index',
    text: 'I want the whole corpus. Call get_full_corpus with sizeOnly=true first and tell me the size and the per-branch breakdown, then pull it in maxChars slices, following nextSkip until truncated is false.',
  },
  {
    name: 'write_a_page',
    description: 'Walk me through contributing a page with my own Radix key',
    text: 'Walk me through creating a wiki page as an agent: call get_challenge, explain exactly what I have to sign and with which key, then what login returns and how create_page carries it. Do not fabricate a signature — stop at the point where my key is needed.',
  },
];

// ========== DB SELECT SHAPES ==========

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

// ========== READ HANDLERS ==========
//
// The wiki's own reads are `wiki-formant/wiki-tools` (the manifest carries
// their handlers); what is left here is what only this wiki serves.

async function get_ideas_board(raw: Record<string, unknown>) {
  const args = readArgs(raw);
  const category = args.str('category');
  const workingGroup = args.str('workingGroup');
  const pages = await prisma.wikiPage.findMany({
    where: { tagPath: { startsWith: 'ideas' } },
    select: IDEAS_SELECT,
    orderBy: { updatedAt: 'desc' },
  });

  const catFilter = category ? categoryLabel(category).toLowerCase() : null;
  const wgFilter = workingGroup ? workingGroup.toLowerCase() : null;

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
      updatedAt: isoDate(p.updatedAt),
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

  return { board: 'ideas', url: `${SITE_URL}/ideas`, totalCards: cards.length, columns };
}

/** A page's path segments as the REST route reads them, from the path or a pasted URL of it. */
const segmentsOf = (raw: string) => raw.replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0]!.split('/').filter(Boolean);

// ========== AUTH BOOTSTRAP HANDLERS ==========
//
// The challenge→sign→token chain as tools, forwarding to the same REST auth
// endpoints the wallet flow uses, so an agent never has to leave the protocol.
// Auth rides the HTTP layer, not the tool arguments: `login` returns a Bearer
// token, and the client sends it as an `Authorization` header on the POSTs
// that carry subsequent write calls (the CORS allow-list already names it).

// Made here rather than fetched from /api/auth/challenge: that route budgets
// each caller's address, and a fetch from this function arrives from the
// server's own, so every agent would share one bucket. This route's own limit
// already holds each agent to its address.
async function get_challenge() {
  const { challenge, expiresAt } = await generateChallenge();
  return {
    challenge,
    expiresAt: expiresAt.toISOString(),
    sign: {
      message: `blake2b-256 of: "R" (ascii) + challenge (hex-decoded) + one length byte of "${RADIX_CONFIG.dAppDefinitionAddress}" + that address (utf-8) + "${SITE_URL}" (utf-8)`,
      curve: 'curve25519 (Ed25519); sign the 32-byte hash, hex-encode the signature',
      address: 'your virtual account address derived from the public key — the key must be an on-ledger owner_keys entry for that account',
      then: 'Call login with { challenge, address, publicKey, signature, curve }.',
    },
  };
}

async function login(args: Record<string, unknown>) {
  const res = await fetch(`${SITE_URL}/api/auth`, {
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
// ROLA auth, $XRD balance gating, locked/author-only checks, block validation,
// semver bumping, the revision entry, and cache revalidation all stay in the
// one handler that already owns them. Nothing about the write path is
// reimplemented here — this is a transport, not a second implementation.

/** The caller's bearer token, or the teaching refusal that names the login flow. */
function signedIn(request: Request): string {
  const auth = request.headers.get('Authorization');
  if (!auth) {
    throw new McpToolError(
      'Not authenticated. Call get_challenge, sign the ROLA message with your own key, call login, then resend this call with the returned token as an HTTP `Authorization: Bearer <token>` header.',
      { flow: ['get_challenge', 'login', 'the write tool'], reference: `${SITE_URL}/AGENTS.md` },
    );
  }
  return auth;
}

/** A write route's JSON, or its error as a tool error the agent can act on. */
async function answer(res: Response): Promise<Record<string, unknown>> {
  const data = await res.json().catch(() => null) as Record<string, unknown> | null;
  if (!res.ok) {
    throw new McpToolError((data?.error as string) || `Request failed (${res.status})`, res.status === 409
      ? { hint: 'The page changed since you read it. Read it again with get_page and `blocks: true`, reapply your change, and send the new `version` as baseVersion.' }
      : undefined);
  }
  return data ?? {};
}

async function forwardWrite(path: string, method: 'POST' | 'PUT' | 'DELETE', body: unknown, request: Request): Promise<Record<string, unknown>> {
  const auth = signedIn(request);
  return answer(await fetch(`${SITE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(body),
  }));
}

async function create_page(args: Record<string, unknown>, request: Request) {
  const { tagPath, title, content, metadata, slug, bannerImage } = args;
  const result = await forwardWrite('/api/wiki', 'POST', { tagPath, title, content, metadata, slug, bannerImage }, request);
  return {
    created: true,
    url: pageUrl(result.tagPath as string, result.slug as string),
    tagPath: result.tagPath,
    slug: result.slug,
    version: result.version,
    ...(result.isFirstContribution ? { isFirstContribution: true } : {}),
  };
}

async function edit_page(args: Record<string, unknown>, request: Request) {
  const { tagPath, slug, content, title, revisionMessage, metadata, verified, baseVersion, newSlug, editorIds, bannerImage } = args;
  const result = await forwardWrite(`/api/wiki${pagePath(tagPath as string, (slug as string) ?? '')}`, 'PUT', { content, title, revisionMessage, metadata, verified, baseVersion, newSlug, editorIds, bannerImage }, request);
  return {
    edited: true,
    url: pageUrl(result.tagPath as string, result.slug as string),
    version: result.version,
  };
}

async function restore_revision(args: Record<string, unknown>, request: Request) {
  const path = segmentsOf(String(args.path ?? '')).join('/');
  const result = await forwardWrite(`/api/wiki/${path}/history`, 'POST', { revisionId: args.revisionId }, request);
  return { restored: true, url: `${SITE_URL}/${path}`, version: result.version };
}

async function delete_page(args: Record<string, unknown>, request: Request) {
  const path = segmentsOf(String(args.path ?? '')).join('/');
  await forwardWrite(`/api/wiki/${path}`, 'DELETE', undefined, request);
  return { deleted: true, path };
}

// The same multipart POST the editor sends, through the same handler, so its
// size cap, format sniff, re-encode and rate limit apply once.
async function upload_image(raw: Record<string, unknown>, request: Request) {
  signedIn(request);
  const args = readArgs(raw);
  const bytes = Buffer.from(args.str('data').replace(/^data:[^,]*,/, ''), 'base64');
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: args.str('contentType') }), args.str('filename'));
  // In-process, with the agent's own headers: the handler's per-IP limit then
  // counts this agent, not the server's address that every forwarded call shares.
  const headers = new Headers(request.headers);
  headers.delete('content-type');
  headers.delete('content-length');
  const { url } = await answer(await uploadImage(new Request(`${SITE_URL}/api/upload`, { method: 'POST', headers, body: form })));
  return { url };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

async function get_network_activity(raw: Record<string, unknown>) {
  const args = readArgs(raw);
  const from = args.str('from');
  const to = args.str('to');
  if ((from && !ISO_DAY.test(from)) || (to && !ISO_DAY.test(to))) throw new McpToolError('`from` and `to` are dates, YYYY-MM-DD.');
  const all = await getLedgerDayRows(undefined, to);
  // Thirty days by default: three years of rows is a CSV download, not a tool answer.
  const rows = from ? all.filter(r => r.date >= from) : all.slice(-30);
  return {
    scope: 'Radix mainnet, UTC days, user transactions only; feesXrd, burnedXrd and royaltiesXrd in $XRD',
    firstStoredDay: all[0]?.date ?? null,
    rows,
    csv: `${SITE_URL}/api/charts/activity?format=csv${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`,
  };
}

// ========== WIRING ==========

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

export function serverConfig(request: Request): McpServerConfig {
  const handlers: Record<string, Handler> = {
    get_ideas_board,
    get_network_activity,
    get_challenge,
    login,
    create_page: args => create_page(args, request),
    edit_page: args => edit_page(args, request),
    restore_revision: args => restore_revision(args, request),
    delete_page: args => delete_page(args, request),
    upload_image: args => upload_image(args, request),
  };
  return {
    serverInfo: SERVER_INFO,
    instructions: INSTRUCTIONS,
    tools: TOOLS.map(({ name, title, description, inputSchema, annotations, handler }) => ({
      name, title, description, inputSchema, annotations, handler: handler ?? handlers[name]!,
    })),
    resources: RESOURCES,
    prompts: PROMPTS,
    answer: { tool: 'search_wiki', argument: 'query' },
    rateLimit: MCP_RATE_LIMIT,
    docsUrl: `${SITE_URL}/AGENTS.md`,
    onCall: (req, body) => trackMcpCall(req, body, SERVER_INFO.name),
  };
}
