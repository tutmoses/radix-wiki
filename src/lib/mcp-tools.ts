// src/lib/mcp-tools.ts — The agent-facing tool manifest.
//
// Single source of truth for what an agent can do with the wiki. Consumed by
// the MCP server (`api/mcp` → tools/list) and by the A2A agent card
// (`.well-known/agent.json` → skills), so the two can never disagree.
//
// Read tools are public. Write tools require a ROLA bearer token, and the
// challenge-sign-verify bootstrap is itself expressed as tools: get_challenge
// → sign with your own key → login → Bearer token on the Authorization header.
// /AGENTS.md stays the deep reference, but the chain completes in-protocol.

// server.json is the registry publish manifest and the only copy of the
// version that an external system reads, so it owns the number. `initialize`
// and the server card follow it rather than keeping their own.
import serverManifest from '../../server.json';
import type { ToolAnnotations, ToolSchema } from 'wiki-formant/mcp';

/** Reported by `initialize`. `name` is the MCP server id, distinct from the
 *  registry's namespaced `serverManifest.name`. */
export const SERVER_INFO = { name: 'radix-wiki', version: serverManifest.version };

/** Registry identity, for the server card. */

export type McpToolSpec = {
  name: string;
  /** Human-facing label. 2025-06-18 promoted this out of `annotations`. */
  title: string;
  description: string;
  inputSchema: ToolSchema;
  /**
   * Required, not optional. Without these every tool looks alike, so a client
   * deciding what to auto-approve cannot tell `get_page` from `edit_page` —
   * and this manifest shipped eleven tools, four of which write, carrying none.
   */
  annotations: ToolAnnotations;
  /** Write tools require `Authorization: Bearer <ROLA JWT>`. */
  auth?: 'rola';
  /** Surfaced as an A2A skill on the agent card. */
  skill?: { id: string; tags: string[]; examples?: string[] };
};

export const TOOLS: McpToolSpec[] = [
  {
    name: 'search_wiki',
    title: 'Search the wiki',
    description:
      'Keyword search across Radix Wiki titles and page text — the first call when you know what you are looking for. '
      + 'Returns a page of results, each with its title, URL, tagPath, slug, a matched snippet and the date it was last updated. '
      + 'The tagPath and slug identify the page every read tool accepts. Narrow with tagPath when a term is common; page through with page/pageSize. '
      + 'When you do not yet know what exists, call get_categories first.',
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term (matched against page titles and body text)' },
        tagPath: { type: 'string', description: 'Limit results to a tag path (e.g. "contents/tech/core-concepts")' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 20, max 50)' },
      },
      required: ['query'],
    },
    skill: {
      id: 'search',
      tags: ['search', 'radix', 'blockchain', 'wiki', 'scrypto', 'defi'],
      examples: ['Search for Cerberus consensus', 'Find pages about Scrypto', 'What is Xi\'an sharding?'],
    },
  },
  {
    name: 'get_page',
    title: 'Read a page',
    description:
      'Read one page in full: its extracted text, current version number, update date and declared metadata. '
      + 'Takes the tagPath and slug that every listing returns — not a URL and not a title. '
      + 'A wrong pair is answered with the tools that find a right one rather than an empty result. '
      + 'For the whole article set at once use get_full_corpus, and for a page as markdown fetch its URL with `.md` appended.',
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        tagPath: { type: 'string', description: 'Tag path (e.g. "contents/tech/core-concepts")' },
        slug: { type: 'string', description: 'Page slug (e.g. "utxo-model")' },
      },
      required: ['tagPath', 'slug'],
    },
    skill: {
      id: 'read',
      tags: ['read', 'content', 'article', 'documentation'],
      examples: ['Read the Radix Engine overview', 'Get the Xi\'an roadmap page'],
    },
  },
  {
    name: 'list_pages',
    title: 'List pages',
    description:
      'Browse the wiki by tag path rather than by keyword — every page under a branch, newest first by default. '
      + 'Returns the same rows as search_wiki (title, URL, tagPath, slug, snippet, updatedAt) plus a pagination envelope carrying totalPages, hasMore and nextPage. '
      + 'Omit tagPath to walk the whole wiki; pass one from get_categories to stay inside a branch. Sort by title for an A-Z pass.',
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        tagPath: { type: 'string', description: 'Filter by tag path prefix (e.g. "developers")' },
        sort: { type: 'string', enum: ['title', 'updatedAt'], description: 'Sort order (default "updatedAt")' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 20, max 100)' },
      },
    },
    skill: { id: 'list', tags: ['list', 'browse', 'categories'] },
  },
  {
    name: 'get_categories',
    title: 'List categories',
    description:
      'The wiki tag hierarchy as a tree, each node carrying its path, name, description and page count. '
      + 'The cheapest way to orient before searching, and the only way to find a valid tagPath before create_page. '
      + 'Costs one call and a few kilobytes; prefer it to listing pages to find out what exists.',
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recent_changes',
    title: 'Recent changes',
    description:
      'Pages edited within the last N days, newest first — what to poll when you are watching the wiki rather than reading it. '
      + 'Same row shape as list_pages. Look back at most 30 days and take at most 50 rows; for anything older, list_pages sorted by updatedAt.',
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Look back N days (default 7, max 30)' },
        limit: { type: 'number', description: 'Max results (default 20, max 50)' },
      },
    },
  },
  {
    name: 'get_full_corpus',
    title: 'Whole corpus',
    description:
      'Every article as one plain-text document, for bulk ingestion rather than reading. '
      + 'This is megabytes and far larger than a context window — take it only when you are indexing the wiki, never to answer a single question. '
      + 'Search or list first; the same corpus is also served, cacheably and with an ETag, at /llms-full.txt.',
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_ideas_board',
    title: 'Ideas pipeline',
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    description: 'Get the RADIX Wiki Ideas Pipeline kanban — community proposals and Radix DAO tasks grouped into status columns (Discussion → Proposed → Approved → In Progress → Testing → Done), each card carrying its working group, category, priority, and assignee. Use this to follow DAO / project progress.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter to one category: Governance, Protocol, Tooling, Ecosystem, or Community' },
        workingGroup: { type: 'string', description: 'Filter by working group name substring, e.g. "Treasury", "Legal", "NetOps"' },
      },
    },
    skill: {
      id: 'ideas-board',
      tags: ['kanban', 'ideas', 'dao', 'governance', 'progress'],
      examples: ['Show the Radix DAO task board', 'Which Governance working group tasks are in progress?', 'What DAO tasks is Daffy assigned?'],
    },
  },
  {
    name: 'get_challenge',
    title: 'Start a login',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    description:
      'Step 1 of writing to the wiki: a single-use ROLA challenge (5-minute expiry). ' +
      'The response spells out the exact recipe for the message your Ed25519 key must sign. ' +
      'You always sign with your OWN key — nothing here custodies anything. Takes no parameters.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'login',
    title: 'Exchange a signed proof for a token',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    description:
      'Step 2: exchange the signed ROLA proof for a 7-day Bearer token — the same verification the human wallet flow runs. ' +
      'Send the returned token as an HTTP `Authorization: Bearer <token>` header on every later create_page / edit_page call; tool arguments never carry it.',
    inputSchema: {
      type: 'object',
      properties: {
        challenge: { type: 'string', description: 'The challenge from get_challenge' },
        address: { type: 'string', description: 'Your account address (virtual account of the signing key; its public key must be an on-ledger owner_keys entry)' },
        publicKey: { type: 'string', description: 'Ed25519 public key, hex' },
        signature: { type: 'string', description: 'Signature over the ROLA message, hex' },
        curve: { type: 'string', enum: ['curve25519', 'secp256k1'], description: 'Signing curve (Ed25519 = "curve25519")' },
      },
      required: ['challenge', 'address', 'publicKey', 'signature', 'curve'],
    },
  },
  {
    name: 'create_page',
    title: 'Create a page',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    description: 'Create a new Radix Wiki page. Requires a ROLA bearer token — see https://radix.wiki/AGENTS.md for the challenge-sign-verify flow. Call get_categories first for a valid tagPath. Some paths are balance-gated (blog needs 50,000 XRD). Earns contribution points.',
    auth: 'rola',
    inputSchema: {
      type: 'object',
      properties: {
        tagPath: { type: 'string', description: 'Tag path the page lives under (e.g. "contents/tech/core-concepts")' },
        title: { type: 'string', description: 'Page title' },
        content: {
          type: 'array',
          description: 'Array of typed blocks. Each needs a unique `id` (UUID) and a `type`. A `content` block carries semantic HTML in `text`; an `infobox` block carries nested `blocks`. Start with an infobox, hyperlink every assertion to its source, no inline styles.',
          items: { type: 'object' },
        },
        metadata: { type: 'object', description: 'Key-value metadata for the page, including `excerpt` (one sentence, ≤160 chars). Some tag paths require specific keys — the error names any that are missing.' },
        slug: { type: 'string', description: 'URL slug (derived from the title when omitted)' },
        bannerImage: { type: 'string', description: 'Banner image URL' },
      },
      required: ['tagPath', 'title', 'content'],
    },
    skill: {
      id: 'write',
      tags: ['write', 'create', 'contribute'],
      examples: ['Create a wiki page for a new Radix dApp', 'Document a Scrypto pattern on the wiki'],
    },
  },
  {
    name: 'edit_page',
    title: 'Edit a page',
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    description: 'Edit an existing Radix Wiki page. Requires a ROLA bearer token — see https://radix.wiki/AGENTS.md. Fetch the page with get_page first and send the full revised block array; the version bump, block-level diff, and revision entry are computed server-side. Locked and author-only pages are rejected. Earns contribution points.',
    auth: 'rola',
    inputSchema: {
      type: 'object',
      properties: {
        tagPath: { type: 'string', description: 'Tag path of the page to edit' },
        slug: { type: 'string', description: 'Slug of the page to edit' },
        content: { type: 'array', description: 'The full revised block array (not a patch). Omit to change only the title or metadata.', items: { type: 'object' } },
        title: { type: 'string', description: 'New title' },
        revisionMessage: { type: 'string', description: 'What changed and why — shown in the page history. Always send one.' },
        metadata: { type: 'object', description: 'Replacement metadata object' },
      },
      required: ['tagPath', 'slug'],
    },
    skill: {
      id: 'edit',
      tags: ['write', 'edit', 'contribute', 'revision'],
      examples: ['Fix a dead link on the Cerberus page', 'Add a section to the Scrypto overview'],
    },
  },
];
