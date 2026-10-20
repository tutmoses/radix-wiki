// src/lib/mcp-tools.ts — The agent-facing tool manifest.
//
// Single source of truth for what an agent can do with the wiki. Consumed by
// the MCP server (`api/mcp` → tools/list) and by the A2A agent card
// (`.well-known/agent.json` → skills), so the two can never disagree.
//
// Read tools are public, and are `wiki-formant/wiki-tools`: the same eight
// caper and miow's wikis serve, carrying their own handlers, so this module
// reads the store. Write tools require a ROLA bearer token, and the
// challenge-sign-verify bootstrap is itself expressed as tools: get_challenge
// → sign with your own key → login → Bearer token on the Authorization header.
// /AGENTS.md stays the deep reference, but the chain completes in-protocol.

// server.json is the registry publish manifest and the only copy of the
// version that an external system reads, so it owns the number. `initialize`
// and the server card follow it rather than keeping their own.
import serverManifest from '../../server.json';
import type { McpTool, ToolAnnotations, ToolSchema } from 'wiki-formant/mcp';
import { wikiReadTools } from 'wiki-formant/wiki-tools';
import { SITE_URL } from '@/lib/site';
import { WIKI_READ, toWikiPage, authorsOf } from '@/lib/wiki';
import { corpusSections } from '@/lib/llms';
import { TAG_TREE, SHARED_PATHS, getMetadataKeys, xrdGates } from '@/lib/tags';
import { categoryLabel } from '@/lib/utils';
import { BLOCK_SCHEMA } from '@/lib/block-utils';
import { UPLOAD } from '@/lib/api';

/** Reported by `initialize`. `name` is the MCP server id, distinct from the
 *  registry's namespaced `serverManifest.name`. */
export const SERVER_INFO = { name: 'radix-wiki', version: serverManifest.version };

/** Registry identity, for the server card. */

type McpToolSpec = {
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
  /** The read tools come with theirs, from `wiki-formant/wiki-tools`; the rest are wired in mcp-server.ts. */
  handler?: McpTool['handler'];
};

/** An Ideas board facet's options as the board labels them. */
const ideasOptions = (key: string) =>
  (getMetadataKeys(['ideas']).find(k => k.key === key)?.options ?? []).map(o => categoryLabel(o));

export const TOOLS: McpToolSpec[] = [
  ...wikiReadTools({
    ...WIKI_READ,
    tree: TAG_TREE,
    noun: 'the Radix Wiki',
    corpusTitle: 'Radix Wiki — Full Content',
    label: node => categoryLabel(node.name),
    // The sections /llms-full.txt is made of, so the tool and the file agree byte for byte.
    corpus: corpusSections,
    // edit_page takes the banner and co-editors as fields, though they are stored in metadata.
    forEdit: page => { const { bannerImage, editorIds } = toWikiPage(page); return { bannerImage, editorIds }; },
    authors: async ids => new Map([...await authorsOf(ids)].map(([id, a]) => [id, a.displayName ?? ''])),
    skills: {
      search_wiki: {
        id: 'search',
        tags: ['search', 'radix', 'blockchain', 'wiki', 'scrypto', 'defi'],
        examples: ['Search for Cerberus consensus', 'Find pages about Scrypto', 'What is Xi\'an sharding?'],
      },
      get_page: {
        id: 'read',
        tags: ['read', 'content', 'article', 'documentation'],
        examples: ['Read the Radix Engine overview', 'Get the Xi\'an roadmap page'],
      },
    },
  }),
  {
    name: 'get_ideas_board',
    title: 'Ideas pipeline',
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    description: `Get the RADIX Wiki Ideas Pipeline kanban: community proposals and Radix DAO tasks grouped into status columns (${ideasOptions('status').join(' → ')}), each card carrying its working group, category, priority, and assignee. Use this to follow DAO / project progress.`,
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: `Filter to one category: ${ideasOptions('category').join(', ')}` },
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
    name: 'get_network_activity',
    title: 'Radix network activity',
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    description:
      'Daily Radix mainnet activity, one row per UTC day since Babylon (28 September 2023): transactions, active accounts, new accounts, '
      + 'components and resources created, NFTs minted, and fees, $XRD burned and royalties in $XRD. Summed from the Gateway transaction stream; counts cover user transactions only. '
      + 'Narrow with from/to. The same rows chart at /charts and download at /api/charts/activity?format=csv.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'First day, YYYY-MM-DD (default: 30 days before the last stored day)' },
        to: { type: 'string', description: 'Last day, YYYY-MM-DD (default: the last stored day)' },
      },
    },
    skill: {
      id: 'network-activity',
      tags: ['radix', 'on-chain', 'analytics', 'transactions', 'xrd'],
      examples: ['How many transactions did Radix process last week?', 'How much XRD was burned in September 2026?', 'Did activity recover after the August 2026 halt?'],
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
    description: `Create a new Radix Wiki page. Requires a ROLA bearer token; see ${SITE_URL}/AGENTS.md for the challenge-sign-verify flow. Call get_categories first for a valid tagPath. Needs a wallet holding at least ${xrdGates('create')}, a balance check that spends nothing. Earns contribution points.`,
    auth: 'rola',
    inputSchema: {
      type: 'object',
      properties: {
        tagPath: { type: 'string', description: 'Tag path the page lives under (e.g. "contents/tech/core-concepts")' },
        title: { type: 'string', description: 'Page title' },
        content: {
          type: 'array',
          description: 'Array of typed blocks. Start with an infobox, hyperlink every assertion to its source, no inline styles.',
          items: BLOCK_SCHEMA,
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
    description: `Edit an existing Radix Wiki page. Requires a ROLA bearer token; see ${SITE_URL}/AGENTS.md. Read the page with get_page and \`blocks: true\`, send the full revised block array, and pass its \`version\` as baseVersion: an edit made after someone else's is refused rather than written over it, so read again and reapply. The version bump, block-level diff, and revision entry are computed server-side. Needs a wallet holding at least ${xrdGates('edit')}. Locked and author-only pages are rejected. Earns contribution points.`,
    auth: 'rola',
    inputSchema: {
      type: 'object',
      properties: {
        tagPath: { type: 'string', description: 'Tag path of the page to edit' },
        slug: { type: 'string', description: 'Slug of the page to edit' },
        baseVersion: { type: 'string', description: 'The `version` get_page returned, which this edit starts from' },
        content: { type: 'array', description: 'The full revised block array (not a patch). Omit to change only the title or metadata.', items: BLOCK_SCHEMA },
        title: { type: 'string', description: 'New title' },
        revisionMessage: { type: 'string', description: 'What changed and why — shown in the page history. Always send one.' },
        metadata: { type: 'object', description: 'Replacement metadata object: the whole `metadata` get_page returns with `blocks: true`, revised' },
        bannerImage: { type: 'string', description: 'Banner image URL; an empty string removes it' },
        newSlug: { type: 'string', description: 'Move the page to this slug (an article only)' },
        editorIds: { type: 'array', description: 'User ids who may co-edit an author-only page. Applied only when the author sends it.' },
        verified: { type: 'boolean', description: 'True when you checked the page\'s facts against its sources: stamps lastVerifiedAt. Send it alone to stamp without an edit.' },
      },
      required: ['tagPath', 'slug', 'baseVersion'],
    },
    skill: {
      id: 'edit',
      tags: ['write', 'edit', 'contribute', 'revision'],
      examples: ['Fix a dead link on the Cerberus page', 'Add a section to the Scrypto overview'],
    },
  },
  {
    name: 'restore_revision',
    title: 'Restore a revision',
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    description: 'Make an earlier revision the current page, written as a new revision. Requires a ROLA bearer token and passes the same gates as edit_page. Take the revision `id` from get_page_history.',
    auth: 'rola',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The page\'s whole path' },
        revisionId: { type: 'string', description: 'The revision `id` from get_page_history' },
      },
      required: ['path', 'revisionId'],
    },
  },
  {
    name: 'delete_page',
    title: 'Delete a page',
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    description: `Delete an article with its history and comments. Requires a ROLA bearer token. Its author may delete it; on a shared board (${[...SHARED_PATHS].join(', ')}), so may anyone who clears the bar to edit it. Locked pages, hub articles and the homepage cannot be deleted.`,
    auth: 'rola',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'The page\'s whole path' } },
      required: ['path'],
    },
  },
  {
    name: 'upload_image',
    title: 'Upload an image',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    description: `Upload an image and get back the URL the editor stores: put it in a content block as \`<img src="…" alt="…">\`, or pass it to create_page or edit_page as bannerImage. Requires a ROLA bearer token, as create_page does. Send the file base64-encoded, at most ${UPLOAD.maxBytes / 1024 / 1024} MB, as ${new Intl.ListFormat('en', { type: 'disjunction' }).format(Object.values(UPLOAD.formats))}. The format is read from the bytes, not from contentType or the name; the image is stored as WebP at most ${UPLOAD.maxWidth}px wide, without its metadata.`,
    auth: 'rola',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'The image file, base64-encoded; a `data:` URL prefix is accepted' },
        filename: { type: 'string', description: 'File name, e.g. "validator-map.png"' },
        contentType: { type: 'string', description: 'MIME type, e.g. "image/png"' },
      },
      required: ['data', 'filename', 'contentType'],
    },
    skill: {
      id: 'upload',
      tags: ['write', 'image', 'upload', 'contribute'],
      examples: ['Add a diagram to a wiki page', 'Set a banner image on a page'],
    },
  },
];
