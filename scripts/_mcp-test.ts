/**
 * Exercises every tool on the Radix Wiki MCP server, the HTTP transport edges,
 * and the plain-GET agent surface, and prints a pass/fail table. Read-only:
 * hits the live endpoints over HTTP exactly as an agent would — no DB access.
 *
 *   npm run test:mcp                # against http://localhost:3000
 *   npx tsx scripts/_mcp-test.ts https://radix.wiki
 *
 * The transport half — JSON-RPC client, the CORS/405/202/-32700/batch-cap
 * assertions, version coherence, card parity, conditional GETs — is
 * `wiki-formant/conformance`, shared with the other agent surfaces. It checks
 * the transport, and the transport is `wiki-formant/mcp`. What stays here is
 * this server's own fixtures: which tools it expects and what a good answer
 * from each looks like.
 */
import {
  createTester,
  transportChecks,
  versionCoherence,
  agentCardParity,
  conditionalGetChecks,
} from 'wiki-formant/conformance';
import serverManifest from '../server.json';

const BASE = process.argv[2] ?? process.env.MCP_TEST_BASE ?? 'http://localhost:3000';
const t = createTester({ base: BASE, clientName: 'radix-wiki-mcp-test' });
const { rpc, call, payload, check } = t;
const MCP = t.endpoint;

(async () => {
  const init = await transportChecks(t, 'radix-wiki-mcp-test');

  await versionCoherence(t, serverManifest.version, {
    card: { url: `${BASE}/.well-known/agent-card.json`, at: j => j.version },
    legacyCard: { url: `${BASE}/.well-known/agent.json`, at: j => j.version },
    openapi: { url: `${BASE}/openapi.json`, at: j => (j.info as { version?: string })?.version },
    serverCard: { url: `${MCP}/server-card`, at: j => j.version },
  }, init.result?.serverInfo?.version);

  await agentCardParity(t);

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

  await conditionalGetChecks(t, ['llms.txt', 'llms-index.txt', 'llms-full.txt']);

  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  check('sitemap lists llms.txt', sitemap.includes('/llms.txt') && sitemap.includes('/llms-full.txt') && sitemap.includes('/llms-index.txt'), 'llms.txt + llms-index.txt + llms-full.txt present');

  process.exit(t.summary());
})();
