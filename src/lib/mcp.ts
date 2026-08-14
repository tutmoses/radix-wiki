// src/lib/mcp.ts — minimal Model Context Protocol server over Streamable HTTP
// (JSON-RPC). Protocol: https://modelcontextprotocol.io/specification/2025-03-26
// Transport + dispatch shared shape with caper's src/lib/mcp.ts (which was
// generalised from this server's original route).
//
// Two things here exist purely so a caller that gets it wrong gets it right on
// the retry: `inputSchema` is a typed shape this module actually validates
// against (naming the bad field and enumerating the legal values, rather than
// coercing junk and returning an empty result), and `instructions` rides on
// `initialize` so an agent learns the intended call sequence before it guesses.

import { NextResponse, type NextRequest } from 'next/server';
import { trackMcpCall } from '@/lib/track';

const MCP_PROTOCOL_VERSION = '2025-03-26';

export type ToolParam = {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
  items?: { type: 'string' | 'number' | 'object' };
};

export type ToolSchema = {
  type: 'object';
  properties: Record<string, ToolParam>;
  required?: string[];
};

export interface McpTool {
  name: string;
  description: string;
  inputSchema: ToolSchema;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  read: () => Promise<string | null>;
}

export interface McpServerConfig {
  serverInfo: { name: string; version: string };
  // Server-level usage guide returned by `initialize`. Say which tool to reach
  // for first and what NOT to do; it is the only text an agent sees before the
  // tool list.
  instructions: string;
  tools: McpTool[];
  resources?: McpResource[];
}

// A caller-fixable failure inside a handler (page not found, expired challenge).
// Reported as a tool result with isError so the model sees the text and can
// correct itself, per the spec's split between protocol and execution errors.
export class McpToolError extends Error {
  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type RpcRequest = { jsonrpc: '2.0'; id: string | number | null; method: string; params?: unknown };
type RpcId = string | number | null;

const quote = (list: readonly string[]) => list.map(s => `"${s}"`).join(', ');

function typeOf(v: unknown): string {
  if (Array.isArray(v)) return 'array';
  if (v === null) return 'null';
  return typeof v;
}

const rpcError = (id: RpcId, code: number, message: string, data?: object) => ({
  jsonrpc: '2.0' as const,
  id,
  error: { code, message, ...(data ? { data } : {}) },
});

const toolText = (id: RpcId, text: string, isError = false) => ({
  jsonrpc: '2.0' as const,
  id,
  result: { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) },
});

// Every problem with the call at once, each naming the field and its legal
// values, plus the schema — one retry should be able to fix all of them.
function validateArgs(tool: McpTool, args: Record<string, unknown>): string | null {
  const { properties, required = [] } = tool.inputSchema;
  const allowed = Object.keys(properties);
  const problems: string[] = [];

  for (const key of Object.keys(args)) {
    if (key in properties) continue;
    problems.push(
      allowed.length
        ? `Unknown parameter "${key}". Allowed parameters: ${quote(allowed)}.`
        : `Unknown parameter "${key}". This tool takes no parameters.`,
    );
  }

  for (const key of required) {
    if (args[key] === undefined || args[key] === null) {
      problems.push(`Missing required parameter "${key}". Required: ${quote(required)}.`);
    }
  }

  for (const [key, spec] of Object.entries(properties)) {
    const value = args[key];
    if (value === undefined || value === null) continue;
    const actual = typeOf(value);

    if (spec.type === 'number') {
      // A numeric string is accepted — some clients stringify everything.
      const numeric = actual === 'number' || (actual === 'string' && String(value).trim() !== '' && Number.isFinite(Number(value)));
      if (!numeric) problems.push(`Parameter "${key}" must be a number; received ${actual} (${JSON.stringify(value)}).`);
    } else if (spec.type === 'array') {
      const itemType = spec.items?.type ?? 'string';
      if (actual !== 'array') {
        problems.push(`Parameter "${key}" must be an array of ${itemType}s; received ${actual} (${JSON.stringify(value).slice(0, 120)}).`);
      } else if ((value as unknown[]).some(item => typeOf(item) !== itemType)) {
        problems.push(`Parameter "${key}" must contain only ${itemType}s.`);
      }
    } else if (actual !== spec.type) {
      problems.push(`Parameter "${key}" must be a ${spec.type}; received ${actual} (${JSON.stringify(value).slice(0, 120)}).`);
    } else if (spec.enum && !spec.enum.includes(value as string)) {
      problems.push(`Parameter "${key}" must be one of ${quote(spec.enum)}; received ${JSON.stringify(value)}.`);
    }
  }

  if (!problems.length) return null;
  return [
    `Invalid arguments for ${tool.name}:`,
    ...problems.map(p => `- ${p}`),
    '',
    `Expected schema: ${JSON.stringify(tool.inputSchema)}`,
  ].join('\n');
}

const METHODS = ['initialize', 'ping', 'tools/list', 'tools/call', 'resources/list', 'resources/read'];

async function handleRpc(req: RpcRequest, config: McpServerConfig): Promise<object | null> {
  const { id, method, params } = req;
  const p = (params ?? {}) as Record<string, unknown>;
  const resources = config.resources ?? [];

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: { tools: {}, ...(resources.length ? { resources: {} } : {}) },
            serverInfo: config.serverInfo,
            instructions: config.instructions,
          },
        };

      case 'notifications/initialized':
        return null; // notifications have no response

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };

      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: config.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) } };

      case 'resources/list':
        return { jsonrpc: '2.0', id, result: { resources: resources.map(({ uri, name, description, mimeType }) => ({ uri, name, description, mimeType })) } };

      case 'resources/read': {
        const { uri } = p as { uri: string };
        const resource = resources.find(r => r.uri === uri);
        const content = resource ? await resource.read() : null;
        if (content == null) {
          const uris = resources.map(r => r.uri);
          return rpcError(id, -32602, `Unknown resource "${uri}". This server exposes: ${uris.length ? quote(uris) : 'no resources'}.`, { availableResources: uris });
        }
        return { jsonrpc: '2.0', id, result: { contents: [{ uri, mimeType: resource!.mimeType, text: content }] } };
      }

      case 'tools/call': {
        const { name, arguments: rawArgs = {} } = p as { name?: string; arguments?: unknown };
        const names = config.tools.map(t => t.name);
        const tool = name ? config.tools.find(t => t.name === name) : undefined;
        if (!tool) {
          const lead = name ? `Unknown tool "${name}".` : `Missing "name" in params.`;
          return rpcError(id, -32602, `${lead} This server exposes: ${quote(names)}.`, { availableTools: names });
        }
        if (typeOf(rawArgs) !== 'object') {
          return toolText(id, `"arguments" must be an object; received ${typeOf(rawArgs)}. Expected schema: ${JSON.stringify(tool.inputSchema)}`, true);
        }
        const args = rawArgs as Record<string, unknown>;
        const invalid = validateArgs(tool, args);
        if (invalid) return toolText(id, invalid, true);

        try {
          const data = await tool.handler(args);
          return toolText(id, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
        } catch (err) {
          if (!(err instanceof McpToolError)) throw err;
          return toolText(id, JSON.stringify({ error: err.message, ...err.details }, null, 2), true);
        }
      }

      default:
        return rpcError(id, -32601, `Method not found: "${method}". This server implements: ${quote(METHODS)}.`, { supportedMethods: METHODS });
    }
  } catch (err) {
    console.error('[MCP]', method, err);
    return rpcError(id, -32603, 'Internal error');
  }
}

// The per-request rate limiter charges one token per HTTP request, before the
// body is parsed — so an unbounded JSON-RPC batch would let a single token fan
// out into many concurrent handler executions (each its own DB query). Cap the
// batch so the amplification factor is bounded.
const MAX_BATCH = 20;

export async function handleMcp(
  body: RpcRequest | RpcRequest[],
  config: McpServerConfig,
): Promise<object | object[] | null> {
  const isBatch = Array.isArray(body);
  if (isBatch && body.length > MAX_BATCH) {
    return rpcError(
      null,
      -32600,
      `Batch too large: ${body.length} requests (max ${MAX_BATCH}). Split into smaller batches.`,
    );
  }
  const responses = (await Promise.all((isBatch ? body : [body]).map(r => handleRpc(r, config)))).filter(Boolean) as object[];
  return isBatch ? responses : (responses[0] ?? null);
}

// ---------------------------------------------------------------------------
// HTTP transport. This is a public, anonymous server, so `*` is the correct
// CORS posture (the spec's Origin-validation MUST exists to protect localhost
// servers from DNS rebinding — the opposite situation). The allow-headers list
// matters more than it looks: MCP clients preflight with `Accept` and
// `Mcp-Protocol-Version`, and one missing entry fails the preflight, not the
// POST.

const MCP_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Max-Age': '86400',
} as const;

export function withMcpCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(MCP_CORS)) res.headers.set(k, v);
  return res;
}

export function mcpOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: MCP_CORS });
}

// Streamable HTTP lets a server decline the SSE leg by answering GET with 405.
// Next's automatic 405 carries no CORS headers, so a browser client couldn't
// even read the refusal — answer it ourselves, and say what to do instead.
export function mcpGet(): NextResponse {
  return NextResponse.json(
    rpcError(null, -32600, 'This server speaks JSON-RPC over POST only (no SSE stream). Send your request as an HTTP POST. Docs: https://radix.wiki/AGENTS.md'),
    { status: 405, headers: { ...MCP_CORS, Allow: 'POST, OPTIONS' } },
  );
}

export async function mcpResponse(request: NextRequest, config: McpServerConfig): Promise<NextResponse> {
  let body: RpcRequest | RpcRequest[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, 'Parse error: request body is not valid JSON.'), {
      status: 400,
      headers: MCP_CORS,
    });
  }
  trackMcpCall(request, config.serverInfo.name, body);
  const result = await handleMcp(body, config);
  // Notification-only input produces no response bodies; the spec requires a
  // bare 202 there, not a 200 with a JSON `null`.
  if (result == null || (Array.isArray(result) && !result.length)) {
    return new NextResponse(null, { status: 202, headers: MCP_CORS });
  }
  return NextResponse.json(result, { headers: MCP_CORS });
}
