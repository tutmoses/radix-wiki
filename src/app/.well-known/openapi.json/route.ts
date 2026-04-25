// src/app/.well-known/openapi.json/route.ts — OpenAPI 3.1 specification

import { NextResponse } from 'next/server';
import { BASE_URL } from '@/lib/utils';

const SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'RADIX Wiki API',
    version: '1.0.0',
    description: 'REST API and MCP server for the Radix DLT ecosystem knowledge base. Read endpoints are public; write endpoints require ROLA authentication.',
    contact: { name: 'RADIX Wiki', url: BASE_URL },
    license: { name: 'CC-BY-4.0', identifier: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  },
  servers: [{ url: BASE_URL }],
  paths: {
    '/api/wiki': {
      get: {
        operationId: 'listPages',
        summary: 'List or search wiki pages',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search term (title match)' },
          { name: 'tagPath', in: 'query', schema: { type: 'string' }, description: 'Filter by tag path' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['title', 'updatedAt'] }, description: 'Sort order' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Paginated page list', content: { 'application/json': { schema: { $ref: '#/components/schemas/PageList' } } } } },
      },
    },
    '/api/wiki/{tagPath}/{slug}': {
      get: {
        operationId: 'getPage',
        summary: 'Get a wiki page. Supports Accept: text/markdown for plain text output.',
        parameters: [
          { name: 'tagPath', in: 'path', required: true, schema: { type: 'string' }, description: 'Tag path (e.g. contents/tech/core-concepts)' },
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' }, description: 'Page slug' },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['text'] }, description: 'Set to "text" for markdown output' },
        ],
        responses: {
          '200': { description: 'Page content (JSON or markdown based on Accept header)' },
          '404': { description: 'Page not found' },
        },
      },
    },
    '/api/wiki/{tagPath}/{slug}/history': {
      get: {
        operationId: 'getPageHistory',
        summary: 'Get revision history for a page',
        parameters: [
          { name: 'tagPath', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Revision history with diffs' } },
      },
    },
    '/api/comments/{pageId}': {
      get: {
        operationId: 'getComments',
        summary: 'Get comments for a page',
        parameters: [{ name: 'pageId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Comment threads' } },
      },
    },
    '/api/leaderboard': {
      get: {
        operationId: 'getLeaderboard',
        summary: 'Get top contributors ranked by points',
        responses: { '200': { description: 'Leaderboard entries' } },
      },
    },
    '/api/mcp': {
      post: {
        operationId: 'mcpServer',
        summary: 'Model Context Protocol (MCP) server — JSON-RPC 2.0 endpoint with 6 tools and 2 resources',
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '200': { description: 'JSON-RPC response' } },
      },
    },
    '/llms.txt': {
      get: {
        operationId: 'getLlmsTxt',
        summary: 'LLM briefing document — narrative overview + page index',
        responses: { '200': { description: 'Plain text briefing', content: { 'text/plain': {} } } },
      },
    },
    '/llms-full.txt': {
      get: {
        operationId: 'getLlmsFullTxt',
        summary: 'Full text corpus of all wiki pages',
        responses: { '200': { description: 'Plain text corpus', content: { 'text/plain': {} } } },
      },
    },
  },
  components: {
    schemas: {
      PageSummary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          slug: { type: 'string' },
          tagPath: { type: 'string' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      PageList: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/PageSummary' } },
          total: { type: 'integer' },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
        },
      },
    },
    securitySchemes: {
      rola: {
        type: 'http',
        scheme: 'bearer',
        description: 'JWT token obtained via ROLA (Radix On-Ledger Authentication). See AGENTS.md for the challenge-sign-verify flow.',
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(SPEC, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
