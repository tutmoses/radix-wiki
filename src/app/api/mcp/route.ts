// src/app/api/mcp/route.ts — Radix Wiki MCP server (Streamable HTTP transport)
// Protocol: https://modelcontextprotocol.io/specification/2025-03-26

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { BASE_URL, getContentSnippet } from '@/lib/utils';
import { extractText } from '@/lib/content';
import { TAG_HIERARCHY, type TagNode } from '@/lib/tags';
import type { Block } from '@/types/blocks';

export const dynamic = 'force-dynamic';

const PROTOCOL_VERSION = '2025-03-26';
const SERVER_INFO = { name: 'radix-wiki', version: '2.0.0' };

// ========== TOOL MANIFEST ==========

const TOOLS = [
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
  },
  {
    name: 'get_categories',
    description: 'Get the wiki tag hierarchy with page counts per category. Useful for understanding what content exists.',
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
] as const;

// ========== RESOURCES ==========

const RESOURCES = [
  {
    uri: 'radix-wiki://llms.txt',
    name: 'RADIX Wiki LLM Briefing',
    description: 'Narrative briefing document with investment thesis, technical overview, and page index.',
    mimeType: 'text/plain',
  },
  {
    uri: 'radix-wiki://categories',
    name: 'Wiki Categories',
    description: 'Tag hierarchy with descriptions and page counts.',
    mimeType: 'application/json',
  },
];

// ========== DB SELECT SHAPES ==========

const SUMMARY_SELECT = { title: true, tagPath: true, slug: true, content: true, updatedAt: true } as const;
const FULL_SELECT = { ...SUMMARY_SELECT, version: true } as const;

function pageUrl(tagPath: string, slug: string) {
  return `${BASE_URL}/${tagPath}/${slug}`;
}

function summarizePage(p: { title: string; tagPath: string; slug: string; content: unknown; updatedAt: Date }) {
  return {
    title: p.title,
    url: pageUrl(p.tagPath, p.slug),
    tagPath: p.tagPath,
    slug: p.slug,
    snippet: getContentSnippet(p.content),
    updatedAt: p.updatedAt.toISOString().split('T')[0],
  };
}

// ========== TAG HIERARCHY HELPERS ==========

function collectCategoryPaths(nodes: TagNode[], parent = ''): string[] {
  return nodes.filter(n => !n.hidden && n.slug).flatMap(n => {
    const path = parent ? `${parent}/${n.slug}` : n.slug;
    return [path, ...(n.children ? collectCategoryPaths(n.children, path) : [])];
  });
}

function buildCategoryTree(nodes: TagNode[], counts: Map<string, number>, parent = ''): object[] {
  return nodes.filter(n => !n.hidden && n.slug).map(n => {
    const path = parent ? `${parent}/${n.slug}` : n.slug;
    const name = n.name.replace(/^\S+\s/, ''); // strip emoji
    return {
      path,
      name,
      ...(n.description ? { description: n.description } : {}),
      pageCount: counts.get(path) || 0,
      ...(n.children ? { children: buildCategoryTree(n.children, counts, path) } : {}),
    };
  });
}

// ========== TOOL HANDLERS ==========

async function search_wiki(args: { query: string; tagPath?: string; page?: number; pageSize?: number }) {
  const { query, tagPath, page = 1, pageSize = 20 } = args;
  const size = Math.min(pageSize, 50);
  const where = {
    OR: [
      { title: { contains: query, mode: 'insensitive' as const } },
      { content: { string_contains: query } },
    ],
    ...(tagPath ? { tagPath } : {}),
  };
  const [results, total] = await Promise.all([
    prisma.page.findMany({ where, select: SUMMARY_SELECT, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * size, take: size }),
    prisma.page.count({ where }),
  ]);
  return { total, page, pageSize: size, pages: results.map(summarizePage) };
}

async function get_page(args: { tagPath: string; slug: string }) {
  const p = await prisma.page.findUnique({
    where: { tagPath_slug: { tagPath: args.tagPath, slug: args.slug } },
    select: FULL_SELECT,
  });
  if (!p) return null;
  return {
    ...summarizePage(p),
    version: p.version,
    content: extractText((p.content as unknown as Block[]) || []),
  };
}

async function list_pages(args: { tagPath?: string; sort?: string; page?: number; pageSize?: number }) {
  const { tagPath, sort = 'updatedAt', page = 1, pageSize = 20 } = args;
  const size = Math.min(pageSize, 100);
  const where = tagPath ? { tagPath } : {};
  const orderBy = sort === 'title' ? { title: 'asc' as const } : { updatedAt: 'desc' as const };
  const [results, total] = await Promise.all([
    prisma.page.findMany({ where, select: SUMMARY_SELECT, orderBy, skip: (page - 1) * size, take: size }),
    prisma.page.count({ where }),
  ]);
  return { total, page, pageSize: size, pages: results.map(summarizePage) };
}

async function get_categories() {
  const paths = collectCategoryPaths(TAG_HIERARCHY);
  const counts = await prisma.page.groupBy({ by: ['tagPath'], _count: true });
  const countMap = new Map(counts.map(c => [c.tagPath, c._count]));
  return { categories: buildCategoryTree(TAG_HIERARCHY, countMap), totalPages: counts.reduce((s, c) => s + c._count, 0) };
}

async function get_recent_changes(args: { days?: number; limit?: number }) {
  const days = Math.min(args.days || 7, 30);
  const limit = Math.min(args.limit || 20, 50);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const pages = await prisma.page.findMany({
    where: { updatedAt: { gte: since } },
    select: SUMMARY_SELECT,
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });
  return { days, count: pages.length, pages: pages.map(summarizePage) };
}

async function get_full_corpus() {
  const pages = await prisma.page.findMany({
    select: FULL_SELECT,
    where: { tagPath: { not: '' }, slug: { not: '' } },
    orderBy: { updatedAt: 'desc' },
  });
  const sections = pages.map(p => {
    const body = extractText((p.content as unknown as Block[]) || []);
    const snippet = getContentSnippet(p.content);
    return `## ${p.title}\n\nURL: ${pageUrl(p.tagPath, p.slug)}\nUpdated: ${p.updatedAt.toISOString().split('T')[0]}\n${snippet ? `Summary: ${snippet}\n` : ''}\n${body}`;
  });
  return [`# Radix Wiki — Full Content\n\n> ${pages.length} pages, generated ${new Date().toISOString().split('T')[0]}`, ...sections].join('\n\n');
}

// ========== RESOURCE HANDLERS ==========

async function readResource(uri: string): Promise<string | null> {
  switch (uri) {
    case 'radix-wiki://llms.txt': {
      const res = await fetch(`${BASE_URL}/llms.txt`);
      return res.ok ? res.text() : null;
    }
    case 'radix-wiki://categories': {
      const data = await get_categories();
      return JSON.stringify(data, null, 2);
    }
    default:
      return null;
  }
}

// ========== JSON-RPC DISPATCH ==========

type RpcRequest = { jsonrpc: '2.0'; id: string | number | null; method: string; params?: unknown };

async function handleRpc(req: RpcRequest): Promise<object | null> {
  const { id, method, params } = req;
  const p = (params ?? {}) as Record<string, unknown>;

  try {
    switch (method) {
      case 'initialize':
        return { jsonrpc: '2.0', id, result: { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {}, resources: {} }, serverInfo: SERVER_INFO } };

      case 'notifications/initialized':
        return null; // notifications have no response

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };

      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: TOOLS } };

      case 'resources/list':
        return { jsonrpc: '2.0', id, result: { resources: RESOURCES } };

      case 'resources/read': {
        const { uri } = p as { uri: string };
        const content = await readResource(uri);
        if (!content) return { jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown resource: ${uri}` } };
        const mimeType = RESOURCES.find(r => r.uri === uri)?.mimeType || 'text/plain';
        return { jsonrpc: '2.0', id, result: { contents: [{ uri, mimeType, text: content }] } };
      }

      case 'tools/call': {
        const { name, arguments: args = {} } = p as { name: string; arguments?: Record<string, unknown> };
        let data: unknown;

        switch (name) {
          case 'search_wiki':       data = await search_wiki(args as Parameters<typeof search_wiki>[0]);             break;
          case 'get_page':          data = await get_page(args as Parameters<typeof get_page>[0]);                   break;
          case 'list_pages':        data = await list_pages(args as Parameters<typeof list_pages>[0]);               break;
          case 'get_categories':    data = await get_categories();                                                   break;
          case 'get_recent_changes': data = await get_recent_changes(args as Parameters<typeof get_recent_changes>[0]); break;
          case 'get_full_corpus':   data = await get_full_corpus();                                                  break;
          default: return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } };
        }

        if (data === null) {
          return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'Not found.' }], isError: true } };
        }
        const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } };
      }

      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
  } catch (err) {
    console.error('[MCP]', method, err);
    return { jsonrpc: '2.0', id, error: { code: -32603, message: 'Internal error' } };
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json() as RpcRequest | RpcRequest[];
  const isBatch = Array.isArray(body);
  const responses = (await Promise.all((isBatch ? body : [body]).map(handleRpc))).filter(Boolean);
  return NextResponse.json(isBatch ? responses : (responses[0] ?? null));
}
