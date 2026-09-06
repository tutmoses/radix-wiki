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
  annotationChecks,
  conditionalGetChecks,
  descriptorChecks,
  payloadBudget,
  robotsChecks,
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
    openapiWellKnown: { url: `${BASE}/.well-known/openapi.json`, at: j => (j.info as { version?: string })?.version },
    mcpManifest: { url: `${BASE}/.well-known/mcp.json`, at: j => j.version },
    serverCard: { url: `${MCP}/server-card`, at: j => j.version },
  }, init.result?.serverInfo?.version);

  await agentCardParity(t);
  await annotationChecks(t, { writes: ['get_challenge', 'login', 'create_page', 'edit_page'] });

  // The three calls an agent makes before anything else. One page with a
  // 327 KB blob in its metadata column put all three over 350 KB — roughly
  // 90k tokens — and every assertion below still passed, because none of them
  // weighed the answer.
  // Everything else a caller can invoke with no arguments is weighed
  // automatically — which is how the 3.3 MB `get_full_corpus` that took no
  // parameters sat outside this list for as long as it did.
  await payloadBudget(t, [
    { name: 'search_wiki', args: { query: 'radix' } },
    { name: 'get_page', args: { path: 'ecosystem/radix-blue-balls' } },
    // Bulk ingestion is deliberately larger than a read: `maxChars` defaults to
    // 200k and the envelope around it has to fit too.
    { name: 'get_full_corpus', maxBytes: 260_000 },
  ]);

  // ---- tools ---------------------------------------------------------------
  console.log(`\n=== tools ===`);
  const list = await rpc('tools/list');
  const toolNames = (list.result?.tools ?? []).map(t => t.name);
  const expected = ['search_wiki', 'get_page', 'list_pages', 'get_categories', 'get_recent_changes', 'get_full_corpus', 'get_ideas_board', 'get_challenge', 'login', 'create_page', 'edit_page'];
  check('tools/list', expected.every(n => toolNames.includes(n)), `${toolNames.length} tools: ${toolNames.join(', ')}`);

  const prompts = await rpc('prompts/list');
  check('prompts/list', (prompts.result?.prompts?.length ?? 0) >= 5,
    `${prompts.result?.prompts?.length ?? 0} prompts: ${(prompts.result?.prompts ?? []).map(x => x.name).join(', ')}`);

  const cats = payload(await call('get_categories')) as { categories?: Array<{ path: string }>; totalPages?: number };
  check('get_categories', (cats?.categories?.length ?? 0) > 0, `${cats?.categories?.length} categories, ${cats?.totalPages} pages`);

  const search = payload(await call('search_wiki', { query: 'radix', pageSize: 5 })) as { total?: number; pages?: Array<{ tagPath: string; slug: string; url: string; snippet?: string }> };
  const first = search?.pages?.[0];
  check('search_wiki', (search?.total ?? 0) > 0 && !!first?.url, `${search?.total} hits, first="${first?.tagPath}/${first?.slug}"`);

  const page = payload(await call('get_page', { tagPath: first?.tagPath ?? '', slug: first?.slug ?? '' })) as { title?: string; content?: string };
  check('get_page', !!page?.title, `"${page?.title}" ${page?.content?.length ?? 0} chars`);

  // The single-string form every listing already hands back, so an agent that
  // has just read one does not have to split it to call this.
  const byPath = payload(await call('get_page', { path: `${first?.tagPath}/${first?.slug}` })) as { title?: string };
  check('get_page(path)', byPath?.title === page?.title, `path form === tagPath/slug form ("${byPath?.title}")`);
  check('entities decoded', !/&(mdash|ndash|ldquo|rsquo|nbsp);/.test(page?.content ?? ''), 'no literal &mdash;/&nbsp; in extracted text');

  const listed = payload(await call('list_pages', { pageSize: 5 })) as { pages?: unknown[]; total?: number };
  check('list_pages', (listed?.pages?.length ?? 0) > 0, `${listed?.pages?.length} of ${listed?.total}`);

  const recent = payload(await call('get_recent_changes', { days: 30, limit: 5 })) as { pages?: unknown[] };
  check('get_recent_changes', Array.isArray(recent?.pages), `${recent?.pages?.length ?? 0} pages changed in 30d`);

  const ideas = payload(await call('get_ideas_board')) as { columns?: unknown[]; totalCards?: number };
  check('get_ideas_board', Array.isArray(ideas?.columns), `${ideas?.totalCards} cards in ${ideas?.columns?.length} columns`);

  const size = payload(await call('get_full_corpus', { sizeOnly: true })) as { characters?: number; totalPages?: number; branches?: unknown[] };
  check('get_full_corpus(sizeOnly)', (size?.characters ?? 0) > 10_000 && Array.isArray(size?.branches),
    `${size?.totalPages} pages, ${(size?.characters ?? 0).toLocaleString()} chars, ${size?.branches?.length} branches`);

  const slice = payload(await call('get_full_corpus', { maxChars: 20_000 })) as { document?: string; truncated?: boolean; nextSkip?: number; includedPages?: number };
  const bounded = (slice?.document?.length ?? 0) <= 21_000 && slice?.truncated === true && typeof slice?.nextSkip === 'number';
  check('get_full_corpus(bounded)', bounded,
    `${(slice?.document?.length ?? 0).toLocaleString()} chars for maxChars=20,000, ${slice?.includedPages} pages, nextSkip=${slice?.nextSkip}`);

  const resumed = payload(await call('get_full_corpus', { maxChars: 20_000, skip: slice?.nextSkip ?? 0 })) as { skip?: number; document?: string };
  check('get_full_corpus(resumes)', resumed?.skip === slice?.nextSkip && resumed?.document !== slice?.document, `skip=${resumed?.skip} returns a different slice`);

  const res = await rpc('resources/read', { uri: 'radix-wiki://categories' });
  check('resources/read', !!res.result?.contents?.[0]?.text, `categories resource ${(res.result?.contents?.[0]?.text ?? '').length} chars`);

  // ---- teaching errors -----------------------------------------------------
  console.log(`\n=== teaching errors ===`);
  const nought = payload(await call('search_wiki', { query: 'zzzqqqnotathing' })) as { total?: number; note?: string };
  check('nought hits teach', nought?.total === 0 && !!nought?.note, nought?.note?.slice(0, 80) ?? 'no note on an empty result');
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
      md.status === 200 && (md.headers.get('content-type') ?? '').includes('text/markdown') && !!md.headers.get('last-modified') && !!md.headers.get('etag'),
      `${md.status} ${md.headers.get('content-type')} etag=${md.headers.get('etag')}`,
    );
    check('.md is real markdown', !/<(Infobox|RecentPages|PageList|AssetPrice|Column)/.test(mdBody) && !mdBody.includes('. $1'), 'no JSX component tags, no $1 artifacts');
  }

  // The plain-GET lane's commonest mistake, and the one an agent that guessed a
  // URL meets. `Page not found` gave it nothing to retry from.
  const guessed = await fetch(`${BASE}/contents/tech/zzz-not-a-page.md`);
  const guessedBody = await guessed.text();
  check('a wrong .md teaches',
    guessed.status === 404 && guessedBody.includes('llms-index.txt') && guessedBody.includes('zzz-not-a-page'),
    `${guessed.status} ${guessedBody.slice(0, 90)}`);

  // Every surface an agent recrawls, not only the ones that already passed.
  await conditionalGetChecks(t, [
    'llms.txt',
    'llms-index.txt',
    'llms-full.txt',
    ...(first ? [`${first.tagPath}/${first.slug}.md`] : []),
  ]);

  // Built from code rather than rows, so an ETag is the whole validator.
  await descriptorChecks(t, [
    '.well-known/agent-card.json',
    '.well-known/agent.json',
    '.well-known/openapi.json',
    'openapi.json',
    '.well-known/mcp.json',
    'api/mcp/server-card',
  ]);

  // Three depths that shared one ETag between them would pass every check
  // above and still not move when only one of them changed.
  const tags = await Promise.all(
    ['llms.txt', 'llms-index.txt', 'llms-full.txt'].map(p =>
      fetch(`${BASE}/${p}`).then(r => r.headers.get('etag')),
    ),
  );
  check('llms depths have distinct ETags', new Set(tags).size === 3, tags.join(' '));

  await robotsChecks(t, ['/api/mcp', '/llms.txt', '/.well-known/agent-card.json']);

  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  check('sitemap lists llms.txt', sitemap.includes('/llms.txt') && sitemap.includes('/llms-full.txt') && sitemap.includes('/llms-index.txt'), 'llms.txt + llms-index.txt + llms-full.txt present');

  process.exit(t.summary());
})();
