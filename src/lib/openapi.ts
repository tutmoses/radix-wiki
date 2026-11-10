// src/lib/openapi.ts — OpenAPI 3.1 description of the REST API.
//
// MCP covers MCP-speaking agents; this spec is for everything else — agent
// frameworks that auto-generate tools from OpenAPI. It describes the same
// /api/wiki handlers the MCP write tools forward to, and their request bodies
// are those tools' own schemas, so a field one takes the other documents.
// When a handler's answer changes shape, update this document in the same change.
//
// A module rather than a route body so anything that needs to quote the spec
// reads the object, the way acuiq2's does.

import { jsonBody, jsonResponse as jsonRes, llmsTxtPath, mcpPath, openApiDocument, toolBody as formantToolBody } from 'wiki-formant/openapi';
import { SITE_URL, WIKI_LICENSE } from '@/lib/site';
import { SERVER_INFO, TOOLS, toolInput } from '@/lib/mcp-tools';
import { BLOCK_SCHEMA } from '@/lib/block-utils';
import { SHARED_PATHS, xrdGates } from '@/lib/tags';
import { UPLOAD } from '@/lib/api';

const rolaAuth = [{ rolaBearer: [] as string[] }];

const PAGE = { $ref: '#/components/schemas/Page' };
const UNAUTH = { description: 'Missing or invalid bearer token' };
const NOT_FOUND = { description: 'No page at this path' };

/** A write tool's arguments as its REST body, less the fields the REST path carries, the block schema once under components. */
const toolBody = (tool: string, inPath: string[] = []) => formantToolBody(toolInput(tool), { inPath, refs: { Block: BLOCK_SCHEMA } });

const pathParam = {
  name: 'path',
  in: 'path',
  required: true,
  description:
    'Tag path and slug joined with slashes, e.g. `contents/tech/research/hyperscale-rs`. Tag paths themselves contain slashes, so this parameter spans multiple segments.',
  schema: { type: 'string' },
};

const page = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    tagPath: { type: 'string' },
    slug: { type: 'string' },
    content: { type: 'array', items: { $ref: '#/components/schemas/Block' } },
    metadata: { type: 'object', additionalProperties: true },
    version: { type: 'string', description: 'Semantic version, bumped server-side per edit' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  additionalProperties: true,
};

const paginated = {
  type: 'object',
  properties: {
    items: { type: 'array', items: { $ref: '#/components/schemas/Page' } },
    total: { type: 'integer' },
    page: { type: 'integer' },
    pageSize: { type: 'integer' },
    totalPages: { type: 'integer' },
  },
};

export const SPEC = openApiDocument({
  title: 'Radix Wiki API',
  version: SERVER_INFO.version,
  description:
    'REST API for RADIX.wiki, the community-maintained knowledge base for Radix DLT. Reads are open. Writes require a ROLA bearer token — see the signing walkthrough at ' +
    `${SITE_URL}/AGENTS.md. MCP-speaking agents should prefer the MCP server at ${SITE_URL}/api/mcp (this API backs its tools, so semantics are identical). ` +
    // The API itself carries no grant; `info.license` is the content's, so
    // the description says which half it covers.
    `Content is licensed under the ${WIKI_LICENSE.name} (${WIKI_LICENSE.spdx}).`,
  license: WIKI_LICENSE,
  siteUrl: SITE_URL,
}, {
  '/api/auth/challenge': {
    get: {
      summary: 'Request a ROLA challenge',
      description: '32-byte hex challenge, 5-minute expiry, one-time use.',
      responses: {
        '200': jsonRes('Challenge issued', {
          type: 'object',
          properties: { challenge: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' } },
        }),
      },
    },
  },
  '/api/auth': {
    post: {
      summary: 'Verify a signed challenge and create a session',
      description:
        'Sign the blake2b-256 hash of `R` (ASCII) + the challenge (hex-decoded) + one byte holding the length of the dAppDefinitionAddress + that address (UTF-8) + the origin (UTF-8), with Ed25519 (curve25519), and hex-encode the signature. The public key must be an on-ledger `owner_keys` entry for the account.',
      requestBody: jsonBody({
        type: 'object',
        required: ['accounts', 'signedChallenge'],
        properties: {
          accounts: {
            type: 'array',
            items: { type: 'object', required: ['address'], properties: { address: { type: 'string' }, label: { type: 'string' } } },
          },
          signedChallenge: {
            type: 'object',
            required: ['challenge', 'address', 'proof'],
            properties: {
              challenge: { type: 'string' },
              address: { type: 'string' },
              proof: {
                type: 'object',
                required: ['publicKey', 'signature', 'curve'],
                properties: {
                  publicKey: { type: 'string', description: 'Hex Ed25519 public key' },
                  signature: { type: 'string', description: 'Hex Ed25519 signature' },
                  curve: { type: 'string', enum: ['curve25519', 'secp256k1'] },
                },
              },
            },
          },
        },
      }),
      responses: {
        '200': jsonRes('Session created (7-day expiry)', {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'JWT for `Authorization: Bearer`. Omitted for a browser request (one carrying `Sec-Fetch-Site`), which is authenticated by the httpOnly session cookie instead.' },
            userId: { type: 'string' },
            radixAddress: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
            isNewUser: { type: 'boolean' },
          },
        }),
        '401': { description: 'Signature verification failed' },
      },
    },
  },
  '/api/wiki': {
    get: {
      summary: 'List or search pages',
      parameters: [
        { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Keyword search over titles and body text (titles rank first). Returns the same result rows as the MCP search_wiki tool.' },
        { name: 'tagPath', in: 'query', schema: { type: 'string' }, description: 'Limit to one tag path' },
        { name: 'sort', in: 'query', schema: { type: 'string', enum: ['updatedAt', 'title'] } },
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: {
        '200': jsonRes('Paginated results: page rows for listings, each with a one-line `snippet` in place of its blocks (read a page whole at /api/wiki/{path}); with `q`, summary rows (title, url, tagPath, slug, snippet, updatedAt) identical to MCP search_wiki', { $ref: '#/components/schemas/PaginatedPages' }),
      },
    },
    post: {
      summary: 'Create a page',
      description:
        `Needs a wallet holding at least ${xrdGates('create')}, a balance check that spends nothing. Some tag paths are author-only; required metadata keys vary by tag path (errors name any missing). Slug derives from the title when omitted.`,
      security: rolaAuth,
      requestBody: toolBody('create_page'),
      responses: {
        '201': jsonRes('Page created', PAGE),
        '400': { description: 'Invalid blocks, tag path, or missing required metadata' },
        '401': UNAUTH,
        '403': { description: 'Balance-gated or author-only path' },
      },
    },
  },
  '/api/wiki/{path}': {
    get: {
      summary: 'Fetch a page',
      description: 'Send `Accept: text/markdown` (or append `?format=text`, or `.md` to the HTML page URL) for a markdown render instead of block JSON.',
      parameters: [pathParam],
      responses: {
        '200': {
          description: 'The page',
          content: {
            'application/json': { schema: PAGE },
            'text/markdown': { schema: { type: 'string' } },
          },
        },
        '404': NOT_FOUND,
      },
    },
    put: {
      summary: 'Edit a page',
      description:
        `\`content\` replaces the whole block array (fetch first, send the full revised array, not a patch); omit it to change only title or metadata. Version bump, block diff, and the revision entry are computed server-side. Needs a wallet holding at least ${xrdGates('edit')}. Locked and author-only pages are rejected.`,
      security: rolaAuth,
      parameters: [pathParam],
      requestBody: toolBody('edit_page', ['tagPath', 'slug']),
      responses: {
        '200': jsonRes('Page updated', PAGE),
        '400': { description: 'Invalid block structure or missing required metadata' },
        '401': UNAUTH,
        '403': { description: 'Locked page or author-only category' },
        '404': NOT_FOUND,
        '409': { description: 'The page moved on since `baseVersion`: fetch it again and reapply the edit' },
      },
    },
    delete: {
      summary: 'Delete a page',
      description: `The author may delete their page. On a shared board (${[...SHARED_PATHS].join(', ')}) the page belongs to the board, so anyone who clears the bar to edit it may delete it too. Locked pages, hub articles and the homepage cannot be deleted.`,
      security: rolaAuth,
      parameters: [pathParam],
      responses: {
        '200': { description: 'Deleted' },
        '403': { description: 'Not the author off a shared board, under the edit balance, or page is locked' },
        '404': NOT_FOUND,
      },
    },
  },
  '/api/wiki/{path}/history': {
    get: {
      summary: 'Revision history for a page',
      parameters: [pathParam],
      responses: {
        '200': jsonRes('Newest-first revisions with block-level diffs', {
          type: 'object',
          properties: { currentVersion: { type: 'string' }, revisions: { type: 'array', items: { type: 'object', additionalProperties: true } } },
        }),
        '404': NOT_FOUND,
      },
    },
    post: {
      summary: 'Restore a revision',
      description: 'Makes an earlier revision the current page, as a new revision. The same gates as an edit: balance, locked pages, author-only categories.',
      security: rolaAuth,
      parameters: [pathParam],
      requestBody: toolBody('restore_revision', ['path']),
      responses: {
        '200': jsonRes('Restored', { type: 'object', properties: { success: { type: 'boolean' }, version: { type: 'string' } } }),
        '401': UNAUTH,
        '403': { description: 'Locked page or author-only category' },
        '404': NOT_FOUND,
      },
    },
  },
  '/api/upload': {
    post: {
      summary: 'Upload an image',
      description: `Returns the URL to use in a page's HTML or as its bannerImage. At most ${UPLOAD.maxBytes / 1024 / 1024} MB, the whole request included, as ${Object.values(UPLOAD.formats).join(', ')}, read from the bytes; stored as WebP at most ${UPLOAD.maxWidth}px wide, without its metadata.`,
      security: rolaAuth,
      requestBody: {
        required: true,
        content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } } },
      },
      responses: {
        '200': jsonRes('Stored', { type: 'object', properties: { url: { type: 'string', format: 'uri' } } }),
        '400': { description: 'No file, too large, or not an accepted image' },
        '401': UNAUTH,
        '429': { description: 'Too many uploads' },
      },
    },
  },
  '/api/comments': {
    get: {
      summary: 'List comments on a page',
      parameters: [{ name: 'pageId', in: 'query', required: true, schema: { type: 'string' }, description: 'The page\'s `id`, as GET /api/wiki/{path} returns it' }],
      responses: { '200': { description: 'Paginated comments, oldest first; a reply names its `parentId`' } },
    },
    post: {
      summary: 'Post a comment',
      security: rolaAuth,
      requestBody: jsonBody({
        type: 'object',
        required: ['pageId', 'content'],
        properties: { pageId: { type: 'string' }, content: { type: 'string', maxLength: 5000 }, parentId: { type: 'string', description: 'The comment this replies to' } },
      }),
      responses: { '201': { description: 'Comment created' }, '401': UNAUTH },
    },
  },
  '/api/leaderboard': {
    get: {
      summary: 'Top contributors by points',
      responses: { '200': { description: 'Paginated contributors with point totals' } },
    },
  },
  '/api/users/{id}/stats': {
    get: {
      summary: 'One contributor\'s stats and point breakdown',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { '200': { description: 'Stats, points, and breakdown' }, '404': { description: 'Unknown user' } },
    },
  },
  '/llms.txt': llmsTxtPath('Index of every page, by category (plain text)'),
  '/api/mcp': mcpPath(TOOLS.map(t => t.name), { note: 'The preferred interface for MCP-speaking agents. Server card: /api/mcp/server-card.' }),
}, {
  securitySchemes: {
    rolaBearer: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'ROLA (Radix On-Ledger Authentication) session token from the challenge-sign-verify flow: GET /api/auth/challenge, sign with the account\'s Ed25519 key, POST /api/auth. ' +
        `Full spec: ${SITE_URL}/AGENTS.md`,
    },
  },
  schemas: { Block: BLOCK_SCHEMA, Page: page, PaginatedPages: paginated },
});
