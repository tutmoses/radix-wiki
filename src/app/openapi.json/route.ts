// src/app/openapi.json/route.ts — OpenAPI 3.1 description of the REST API.
//
// MCP covers MCP-speaking agents; this spec is for everything else — agent
// frameworks that auto-generate tools from OpenAPI. It describes the same
// /api/wiki handlers the MCP write tools forward to, so semantics can't drift:
// when a handler changes shape, update this document in the same change.

import { NextResponse } from 'next/server';
import { BASE_URL } from '@/lib/utils';
import { SERVER_INFO } from '@/lib/mcp-tools';

export const revalidate = 86400;

const rolaAuth = [{ rolaBearer: [] as string[] }];

const pathParam = {
  name: 'path',
  in: 'path',
  required: true,
  description:
    'Tag path and slug joined with slashes, e.g. `contents/tech/research/hyperscale-rs`. Tag paths themselves contain slashes, so this parameter spans multiple segments.',
  schema: { type: 'string' },
};

const block = {
  type: 'object',
  description:
    'Typed content block. Every block needs a unique `id` (UUID) and a `type`. A `content` block carries semantic HTML in `text`; an `infobox` block carries nested `blocks`.',
  required: ['id', 'type'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    type: { type: 'string', enum: ['content', 'infobox', 'columns', 'recentPages', 'pageList', 'assetPrice'] },
    text: { type: 'string', description: 'Semantic HTML (content blocks)' },
  },
  additionalProperties: true,
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

const SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Radix Wiki API',
    version: SERVER_INFO.version,
    description:
      'REST API for RADIX.wiki, the community-maintained knowledge base for Radix DLT. Reads are open. Writes require a ROLA bearer token — see the signing walkthrough at ' +
      `${BASE_URL}/AGENTS.md. MCP-speaking agents should prefer the MCP server at ${BASE_URL}/api/mcp (this API backs its tools, so semantics are identical). ` +
      `Content is CC BY 4.0.`,
    license: { name: 'CC BY 4.0 (content)', url: 'https://creativecommons.org/licenses/by/4.0/' },
  },
  servers: [{ url: BASE_URL }],
  components: {
    securitySchemes: {
      rolaBearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'ROLA (Radix On-Ledger Authentication) session token from the challenge-sign-verify flow: GET /api/auth/challenge, sign with the account\'s Ed25519 key, POST /api/auth. ' +
          `Full spec: ${BASE_URL}/AGENTS.md`,
      },
    },
    schemas: { Block: block, Page: page, PaginatedPages: paginated },
  },
  paths: {
    '/api/auth/challenge': {
      get: {
        summary: 'Request a ROLA challenge',
        description: '32-byte hex challenge, 5-minute expiry, one-time use.',
        responses: {
          '200': {
            description: 'Challenge issued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { challenge: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth': {
      post: {
        summary: 'Verify a signed challenge and create a session',
        description:
          'Message to sign: `ROLA{challenge}{dAppDefinitionAddress}{origin}` UTF-8, Ed25519 (curve25519). The public key must be an on-ledger `owner_keys` entry for the account.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
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
                          curve: { type: 'string', enum: ['curve25519'] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Session created (7-day expiry)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string', description: 'JWT for `Authorization: Bearer`' },
                    userId: { type: 'string' },
                    radixAddress: { type: 'string' },
                    expiresAt: { type: 'string', format: 'date-time' },
                    isNewUser: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '401': { description: 'Signature verification failed' },
        },
      },
    },
    '/api/wiki': {
      get: {
        summary: 'List or search pages',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Keyword search over titles and body text (titles rank first)' },
          { name: 'tagPath', in: 'query', schema: { type: 'string' }, description: 'Limit to one tag path' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['updatedAt', 'title'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': { description: 'Paginated page summaries', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedPages' } } } },
        },
      },
      post: {
        summary: 'Create a page',
        description:
          'Some tag paths are XRD-balance-gated or author-only; required metadata keys vary by tag path (errors name any missing). Slug derives from the title when omitted.',
        security: rolaAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'tagPath', 'content'],
                properties: {
                  title: { type: 'string' },
                  tagPath: { type: 'string', description: 'Valid tag path (see GET /api/mcp get_categories, or llms.txt)' },
                  content: { type: 'array', items: { $ref: '#/components/schemas/Block' } },
                  metadata: { type: 'object', additionalProperties: true, description: 'Include `excerpt` (≤160 chars)' },
                  slug: { type: 'string' },
                  bannerImage: { type: 'string', format: 'uri' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Page created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Page' } } } },
          '400': { description: 'Invalid blocks, tag path, or missing required metadata' },
          '401': { description: 'Missing or invalid bearer token' },
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
              'application/json': { schema: { $ref: '#/components/schemas/Page' } },
              'text/markdown': { schema: { type: 'string' } },
            },
          },
          '404': { description: 'No page at this path' },
        },
      },
      put: {
        summary: 'Edit a page',
        description:
          '`content` replaces the whole block array (fetch first, send the full revised array — not a patch); omit it to change only title or metadata. Version bump, block diff, and the revision entry are computed server-side. Locked and author-only pages are rejected.',
        security: rolaAuth,
        parameters: [pathParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  content: { type: 'array', items: { $ref: '#/components/schemas/Block' } },
                  metadata: { type: 'object', additionalProperties: true },
                  bannerImage: { type: 'string', format: 'uri' },
                  revisionMessage: { type: 'string', description: 'What changed and why — always send one' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Page updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Page' } } } },
          '400': { description: 'Invalid block structure or missing required metadata' },
          '401': { description: 'Missing or invalid bearer token' },
          '403': { description: 'Locked page or author-only category' },
          '404': { description: 'No page at this path' },
        },
      },
      delete: {
        summary: 'Delete a page (author only)',
        security: rolaAuth,
        parameters: [pathParam],
        responses: {
          '200': { description: 'Deleted' },
          '403': { description: 'Not the author, or page is locked' },
          '404': { description: 'No page at this path' },
        },
      },
    },
    '/api/wiki/{path}/history': {
      get: {
        summary: 'Revision history for a page',
        parameters: [pathParam],
        responses: {
          '200': {
            description: 'Newest-first revisions with block-level diffs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { currentVersion: { type: 'string' }, revisions: { type: 'array', items: { type: 'object', additionalProperties: true } } },
                },
              },
            },
          },
          '404': { description: 'No page at this path' },
        },
      },
    },
    '/api/comments/{pageId}': {
      get: {
        summary: 'List comments on a page',
        parameters: [{ name: 'pageId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Paginated comment threads' } },
      },
      post: {
        summary: 'Post a comment',
        security: rolaAuth,
        parameters: [{ name: 'pageId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['content'], properties: { content: { type: 'string' } } } } },
        },
        responses: { '201': { description: 'Comment created' }, '401': { description: 'Missing or invalid bearer token' } },
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
    '/api/mcp': {
      post: {
        summary: 'MCP server (JSON-RPC 2.0, Streamable HTTP)',
        description:
          'Model Context Protocol endpoint — the preferred interface for MCP-speaking agents. Call `tools/list` for the live tool set. Server card: /api/mcp/server-card.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', description: 'JSON-RPC 2.0 request or batch' } } },
        },
        responses: { '200': { description: 'JSON-RPC 2.0 response' } },
      },
    },
  },
} as const;

export async function GET() {
  return NextResponse.json(SPEC, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
