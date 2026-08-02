// src/lib/mcp-tools.ts — The agent-facing tool manifest.
//
// Single source of truth for what an agent can do with the wiki. Consumed by
// the MCP server (`api/mcp` → tools/list) and by the A2A agent card
// (`.well-known/agent.json` → skills), so the two can never disagree.
//
// Read tools are public. Write tools require a ROLA bearer token — the
// challenge-sign-verify bootstrap is the one thing that cannot be expressed as
// a tool (you need the token before you can call one), so it lives in
// /AGENTS.md.

export type McpTool = {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  /** Write tools require `Authorization: Bearer <ROLA JWT>`. */
  auth?: 'rola';
  /** Surfaced as an A2A skill on the agent card. */
  skill?: { id: string; tags: string[]; examples?: string[] };
};

export const TOOLS: McpTool[] = [
  {
    name: 'search_wiki',
    description: 'Search Radix Wiki pages by keyword. Matches against titles and content. Returns titles, URLs, snippets, and update dates.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term (matched against page titles)' },
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
    description: 'Fetch the full text content of a specific Radix Wiki page.',
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
    description: 'List Radix Wiki pages, optionally filtered by tag path.',
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
    description: 'Get the wiki tag hierarchy with page counts per category. Useful for understanding what content exists, and for finding a valid tagPath before writing.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recent_changes',
    description: 'Get recently updated wiki pages. Useful for monitoring new content.',
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
    description: 'Return the entire Radix Wiki as a single text document. Use for comprehensive context or bulk ingestion.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_ideas_board',
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
    name: 'create_page',
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

/** The MCP wire shape — `tools/list` must not carry our annotation fields. */
export const MCP_MANIFEST = TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
