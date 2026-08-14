/**
 * Exercises every tool on the Radix Wiki MCP server, the HTTP transport edges,
 * and the plain-GET agent surface, and prints a pass/fail table. Read-only:
 * hits the live endpoints over HTTP exactly as an agent would — no DB access.
 *
 *   npm run test:mcp                # against http://localhost:3000
 *   npx tsx scripts/_mcp-test.ts https://radix.wiki
 */
import serverManifest from '../server.json';

const BASE = process.argv[2] ?? process.env.MCP_TEST_BASE ?? 'http://localhost:3000';
const MCP = `${BASE}/api/mcp`;

type Rpc = {
  result?: {
    content?: Array<{ text?: string }>;
    isError?: boolean;
    tools?: Array<{ name: string }>;
    resources?: Array<{ uri: string }>;
    contents?: Array<{ text?: string }>;
    serverInfo?: { version?: string };
    capabilities?: Record<string, unknown>;
    instructions?: string;
  };
  error?: { code: number; message: string; data?: { availableTools?: string[] } };
};

let calls = 0;
async function rpc(method: string, params?: unknown): Promise<Rpc> {
  calls++;
  const res = await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: calls, method, params }),
  });
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 5000));
    return rpc(method, params);
  }
  return (await res.json()) as Rpc;
}

const call = async (name: string, args: Record<string, unknown> = {}) =>
  rpc('tools/call', { name, arguments: args });

function payload(r: Rpc): unknown {
  const text = r.result?.content?.[0]?.text;
  if (text == null) return r.error ? { _error: r.error } : r.result;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const results: Array<{ tool: string; ok: boolean; note: string }> = [];
function check(tool: string, ok: boolean, note: string) {
  results.push({ tool, ok, note });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${tool.padEnd(24)} ${note}`);
}

(async () => {
  console.log(`\n=== MCP server  ${MCP} ===`);
  const init = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'radix-wiki-mcp-test', version: '1' } });
  check('initialize', !!init.result?.serverInfo && !!init.result?.instructions, JSON.stringify(init.result?.serverInfo ?? init.error));

  // ---- HTTP transport conformance ----------------------------------------
  console.log(`\n=== transport ===`);
  const opt = await fetch(MCP, { method: 'OPTIONS' });
  check(
    'OPTIONS preflight',
    opt.status === 204 &&
      opt.headers.get('access-control-allow-origin') === '*' &&
      (opt.headers.get('access-control-allow-headers') ?? '').includes('Mcp-Protocol-Version'),
    `${opt.status} ACAO=${opt.headers.get('access-control-allow-origin')}`,
  );

  const get = await fetch(MCP);
  check(
    'GET→405',
    get.status === 405 && get.headers.get('access-control-allow-origin') === '*',
    `${get.status} Allow=${get.headers.get('allow')} ACAO=${get.headers.get('access-control-allow-origin')}`,
  );

  const notif = await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });
  const notifBody = await notif.text();
  check('notification→202', notif.status === 202 && notifBody === '', `${notif.status} body="${notifBody}"`);

  const bad = await fetch(MCP, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not json' });
  const badJson = (await bad.json()) as Rpc;
  check('parse error→400', bad.status === 400 && badJson.error?.code === -32700, `${bad.status} code=${badJson.error?.code}`);

  const over = await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Array.from({ length: 21 }, (_, i) => ({ jsonrpc: '2.0', id: i, method: 'ping' }))),
  });
  const overJson = (await over.json()) as Rpc;
  check('batch cap (21)', overJson.error?.code === -32600, `code=${overJson.error?.code}: ${(overJson.error?.message ?? '').slice(0, 80)}`);

  const caps = init.result?.capabilities ?? {};
  check('capabilities honest', 'tools' in caps && 'resources' in caps, JSON.stringify(caps));

  const cardJson = (await (await fetch(`${BASE}/.well-known/agent-card.json`)).json()) as { version?: string };
  const legacyCardJson = (await (await fetch(`${BASE}/.well-known/agent.json`)).json()) as { version?: string };
  const apiV = ((await (await fetch(`${BASE}/openapi.json`)).json()) as { info?: { version?: string } }).info?.version;
  const serverCardV = ((await (await fetch(`${MCP}/server-card`)).json()) as { version?: string }).version;
  const initV = init.result?.serverInfo?.version;
  check(
    'version coherence',
    [initV, cardJson.version, legacyCardJson.version, apiV, serverCardV].every(v => v === serverManifest.version),
    `server.json=${serverManifest.version} init=${initV} card=${cardJson.version} legacy=${legacyCardJson.version} openapi=${apiV} serverCard=${serverCardV}`,
  );
  check('agent card parity', JSON.stringify(cardJson) === JSON.stringify(legacyCardJson), 'agent.json === agent-card.json');

  // ---- tools ---------------------------------------------------------------
  console.log(`\n=== tools ===`);
  const list = await rpc('tools/list');
  const toolNames = (list.result?.tools ?? []).map(t => t.name);
  const expected = ['search_wiki', 'get_page', 'list_pages', 'get_categories', 'get_recent_changes', 'get_full_corpus', 'get_ideas_board', 'get_challenge', 'login', 'create_page', 'edit_page'];
  check('tools/list', expected.every(n => toolNames.includes(n)), `${toolNames.length} tools: ${toolNames.join(', ')}`);

  const cats = payload(await call('get_categories')) as { categories?: Array<{ path: string }>; totalPages?: number };
  check('get_categories', (cats?.categories?.length ?? 0) > 0, `${cats?.categories?.length} categories, ${cats?.totalPages} pages`);

  const search = payload(await call('search_wiki', { query: 'radix', pageSize: 5 })) as { total?: number; pages?: Array<{ tagPath: string; slug: string; url: string; snippet?: string }> };
  const first = search?.pages?.[0];
  check('search_wiki', (search?.total ?? 0) > 0 && !!first?.url, `${search?.total} hits, first="${first?.tagPath}/${first?.slug}"`);

  const page = payload(await call('get_page', { tagPath: first?.tagPath ?? '', slug: first?.slug ?? '' })) as { title?: string; content?: string };
  check('get_page', !!page?.title, `"${page?.title}" ${page?.content?.length ?? 0} chars`);
  check('entities decoded', !/&(mdash|ndash|ldquo|rsquo|nbsp);/.test(page?.content ?? ''), 'no literal &mdash;/&nbsp; in extracted text');

  const listed = payload(await call('list_pages', { pageSize: 5 })) as { pages?: unknown[]; total?: number };
  check('list_pages', (listed?.pages?.length ?? 0) > 0, `${listed?.pages?.length} of ${listed?.total}`);

  const recent = payload(await call('get_recent_changes', { days: 30, limit: 5 })) as { pages?: unknown[] };
  check('get_recent_changes', Array.isArray(recent?.pages), `${recent?.pages?.length ?? 0} pages changed in 30d`);

  const ideas = payload(await call('get_ideas_board')) as { columns?: unknown[]; totalCards?: number };
  check('get_ideas_board', Array.isArray(ideas?.columns), `${ideas?.totalCards} cards in ${ideas?.columns?.length} columns`);

  const corpus = payload(await call('get_full_corpus')) as string;
  check('get_full_corpus', typeof corpus === 'string' && corpus.length > 10_000, `${(corpus?.length ?? 0).toLocaleString()} chars`);

  const res = await rpc('resources/read', { uri: 'radix-wiki://categories' });
  check('resources/read', !!res.result?.contents?.[0]?.text, `categories resource ${(res.result?.contents?.[0]?.text ?? '').length} chars`);

  // ---- teaching errors -----------------------------------------------------
  console.log(`\n=== teaching errors ===`);
  const missing = await call('search_wiki', {});
  const missingText = missing.result?.content?.[0]?.text ?? '';
  check('arg validation', !!missing.result?.isError && missingText.includes('"query"') && missingText.includes('Expected schema'), missingText.split('\n')[0] ?? '');

  const badTool = await call('no_such_tool', {});
  check('unknown tool', badTool.error?.code === -32602 && (badTool.error?.message ?? '').includes('search_wiki'), `${badTool.error?.code}: ${(badTool.error?.message ?? '').slice(0, 80)}`);

  const bogus = await call('get_page', { tagPath: 'definitely/not', slug: 'a-page' });
  check('get_page(404)', !!bogus.result?.isError, JSON.stringify(payload(bogus)).slice(0, 100));

  // ---- write bootstrap -----------------------------------------------------
  console.log(`\n=== write bootstrap ===`);
  const unauthed = await call('create_page', { tagPath: 'ecosystem', title: 'x', content: [{}] });
  const unauthedText = unauthed.result?.content?.[0]?.text ?? '';
  check('write tools teach auth', !!unauthed.result?.isError && unauthedText.includes('get_challenge'), unauthedText.slice(0, 90).replace(/\n/g, ' '));

  const challenge = payload(await call('get_challenge')) as { challenge?: string; sign?: { message?: string; then?: string } };
  check('get_challenge', !!challenge?.challenge && !!challenge?.sign?.message?.includes('blake2b-256'), `challenge=${challenge?.challenge?.slice(0, 12)}… recipe present`);

  const badLogin = await call('login', { challenge: challenge?.challenge ?? 'x', address: 'account_rdx1xxxx', publicKey: '00', signature: '00', curve: 'curve25519' });
  check('login teaches on failure', !!badLogin.result?.isError, JSON.stringify(payload(badLogin)).slice(0, 100));

  // ---- plain-GET surface ---------------------------------------------------
  console.log(`\n=== plain-GET surface ===`);
  const gs = (await (await fetch(`${BASE}/api/wiki?q=radix&pageSize=5`)).json()) as { total?: number; items?: Array<Record<string, unknown>> };
  check('GET /api/wiki?q=', (gs.total ?? 0) > 0 && (gs.items?.length ?? 0) > 0, `${gs.total} hits`);
  const rowsMatch = JSON.stringify(gs.items?.[0]) === JSON.stringify(search?.pages?.[0]);
  check('search q= row-identity', rowsMatch, rowsMatch ? 'GET rows === search_wiki rows' : `GET=${JSON.stringify(gs.items?.[0]).slice(0, 80)} MCP=${JSON.stringify(search?.pages?.[0]).slice(0, 80)}`);

  if (first) {
    const md = await fetch(`${BASE}/${first.tagPath}/${first.slug}.md`);
    const mdBody = await md.text();
    check(
      '.md twin',
      md.status === 200 && (md.headers.get('content-type') ?? '').includes('text/markdown') && !!md.headers.get('last-modified'),
      `${md.status} ${md.headers.get('content-type')} last-modified=${!!md.headers.get('last-modified')}`,
    );
    check('.md is real markdown', !/<(Infobox|RecentPages|PageList|AssetPrice|Column)/.test(mdBody) && !mdBody.includes('. $1'), 'no JSX component tags, no $1 artifacts');
  }

  for (const path of ['llms.txt', 'llms-index.txt', 'llms-full.txt']) {
    const fresh = await fetch(`${BASE}/${path}`);
    const etag = fresh.headers.get('etag');
    const revalidated = etag ? await fetch(`${BASE}/${path}`, { headers: { 'If-None-Match': etag } }) : null;
    check(`${path} 304`, !!etag && revalidated?.status === 304, `etag=${etag} revalidate=${revalidated?.status}`);
  }

  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  check('sitemap lists llms.txt', sitemap.includes('/llms.txt') && sitemap.includes('/llms-full.txt') && sitemap.includes('/llms-index.txt'), 'llms.txt + llms-index.txt + llms-full.txt present');

  const failed = results.filter(r => !r.ok);
  console.log(`\n──────── ${results.length - failed.length}/${results.length} passed, ${calls} JSON-RPC calls ────────`);
  for (const f of failed) console.log(`FAILED: ${f.tool} — ${f.note}`);
  process.exit(failed.length ? 1 : 0);
})();
