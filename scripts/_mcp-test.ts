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
  standardVersionSources,
  agentCardParity,
  annotationChecks,
  conditionalGetChecks,
  descriptorChecks,
  payloadBudget,
  robotsChecks,
  manifestParity,
  rowParity,
  twinParity,
  editReadChecks,
  openapiWriteParity,
  rolaOriginCheck,
} from 'wiki-formant/conformance';
import serverManifest from '../server.json';
import { validateBlocks, blockIssues } from '@/lib/block-utils';
import { describeBlockIssues } from 'wiki-formant/validation';

const BASE = process.argv[2] ?? process.env.MCP_TEST_BASE ?? 'http://localhost:3000';
const t = createTester({ base: BASE, clientName: 'radix-wiki-mcp-test' });
const { rpc, call, payload, check } = t;

(async () => {
  const init = await transportChecks(t, 'radix-wiki-mcp-test');

  await versionCoherence(t, serverManifest.version, standardVersionSources(t, ['/openapi.json', '/.well-known/openapi.json']), init.result?.serverInfo?.version);

  await agentCardParity(t);
  await manifestParity(t, { writeAuth: true });
  await annotationChecks(t, { writes: ['get_challenge', 'login', 'create_page', 'edit_page', 'restore_revision', 'delete_page', 'upload_image', 'send_feedback'] });

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
  const expected = ['search_wiki', 'get_page', 'get_pages', 'list_pages', 'get_categories', 'get_recent_changes', 'get_full_corpus', 'get_ideas_board', 'get_network_activity', 'get_page_history', 'get_challenge', 'login', 'create_page', 'edit_page', 'restore_revision', 'delete_page', 'upload_image', 'send_feedback'];
  check('tools/list', expected.every(n => toolNames.includes(n)), `${toolNames.length} tools: ${toolNames.join(', ')}`);
  // Listed, and invited by `initialize`. Never called: run against production, a call is a real report.
  check('send_feedback invited', toolNames.includes('send_feedback') && (init.result?.instructions ?? '').includes('send_feedback'), 'in tools/list and the initialize instructions');

  const prompts = await rpc('prompts/list');
  check('prompts/list', (prompts.result?.prompts?.length ?? 0) >= 5,
    `${prompts.result?.prompts?.length ?? 0} prompts: ${(prompts.result?.prompts ?? []).map(x => x.name).join(', ')}`);

  const cats = payload(await call('get_categories')) as { categories?: Array<{ path: string }>; totalPages?: number };
  check('get_categories', (cats?.categories?.length ?? 0) > 0, `${cats?.categories?.length} categories, ${cats?.totalPages} pages`);

  const search = payload(await call('search_wiki', { query: 'radix', pageSize: 5 })) as { total?: number; pages?: Array<{ id?: string; tagPath: string; slug: string; url: string; snippet?: string }> };
  const first = search?.pages?.[0];
  check('search_wiki', (search?.total ?? 0) > 0 && !!first?.url, `${search?.total} hits, first="${first?.tagPath}/${first?.slug}"`);

  const page = payload(await call('get_page', { tagPath: first?.tagPath ?? '', slug: first?.slug ?? '' })) as { title?: string; content?: string };
  check('get_page', !!page?.title, `"${page?.title}" ${page?.content?.length ?? 0} chars`);

  // The single-string form every listing already hands back, so an agent that
  // has just read one does not have to split it to call this.
  const byPath = payload(await call('get_page', { path: `${first?.tagPath}/${first?.slug}` })) as { title?: string };
  check('get_page(path)', byPath?.title === page?.title, `path form === tagPath/slug form ("${byPath?.title}")`);
  check('entities decoded', !/&(mdash|ndash|ldquo|rsquo|nbsp);/.test(page?.content ?? ''), 'no literal &mdash;/&nbsp; in extracted text');
  if (first) await twinParity(t, 'get_page is the .md twin', `${first.tagPath}/${first.slug}.md`, page?.content ?? '');

  // What edit_page takes back: the stored blocks, which the write path must accept
  // unchanged. A list block picks pages by id, so rows must carry it.
  await editReadChecks(t, {
    path: 'ecosystem/radix-blue-balls',
    rows: search?.pages,
    validate: blocks => validateBlocks(blocks) || describeBlockIssues(blockIssues(blocks)),
  });
  // This server's edit fields, which it keeps in metadata and edit_page takes as fields.
  const withBlocks = payload(await call('get_page', { path: 'ecosystem/radix-blue-balls', blocks: true })) as { bannerImage?: unknown; editorIds?: unknown };
  check('get_page(blocks) edit fields', typeof withBlocks === 'object' && !!withBlocks && 'bannerImage' in withBlocks && Array.isArray(withBlocks.editorIds), `bannerImage=${JSON.stringify(withBlocks?.bannerImage)}, editorIds=${JSON.stringify(withBlocks?.editorIds)}`);

  // Every field a REST write accepts, the matching tool must take: an edit_page
  // without baseVersion silently overwrote whatever landed in between.
  await openapiWriteParity(t, [['/api/wiki', 'post', 'create_page'], ['/api/wiki/{path}', 'put', 'edit_page'], ['/api/wiki/{path}/history', 'post', 'restore_revision']], `${BASE}/openapi.json`);

  const listed = payload(await call('list_pages', { pageSize: 5 })) as { pages?: unknown[]; total?: number };
  check('list_pages', (listed?.pages?.length ?? 0) > 0, `${listed?.pages?.length} of ${listed?.total}`);

  const recent = payload(await call('get_recent_changes', { days: 30, limit: 5 })) as { pages?: unknown[] };
  check('get_recent_changes', Array.isArray(recent?.pages), `${recent?.pages?.length ?? 0} pages changed in 30d`);

  const ideas = payload(await call('get_ideas_board')) as { columns?: unknown[]; totalCards?: number };
  check('get_ideas_board', Array.isArray(ideas?.columns), `${ideas?.totalCards} cards in ${ideas?.columns?.length} columns`);

  const activity = payload(await call('get_network_activity')) as { rows?: { date: string }[] };
  check('get_network_activity', (activity?.rows?.length ?? 0) > 0, `${activity?.rows?.length ?? 0} days to ${activity?.rows?.at(-1)?.date}`);

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

  // Read-only: with no token the tool refuses before it forwards anything to /api/upload.
  const upload = (list.result?.tools ?? []).find(x => x.name === 'upload_image');
  const uploadArgs = Object.keys((upload?.inputSchema as { properties?: object } | undefined)?.properties ?? {});
  check('upload_image schema', ['data', 'filename', 'contentType'].every(k => uploadArgs.includes(k)) && upload?.annotations?.destructiveHint === false, uploadArgs.join(', ') || 'not listed');
  const unauthedUpload = await call('upload_image', { data: 'iVBORw0KGgo=', filename: 'x.png', contentType: 'image/png' });
  const unauthedUploadText = unauthedUpload.result?.content?.[0]?.text ?? '';
  check('upload_image teaches auth', !!unauthedUpload.result?.isError && unauthedUploadText.includes('get_challenge'), unauthedUploadText.slice(0, 90).replace(/\n/g, ' '));

  const challenge = payload(await call('get_challenge')) as { challenge?: string; sign?: { message?: string; then?: string } };
  check('get_challenge', !!challenge?.challenge && !!challenge?.sign?.message?.includes('blake2b-256'), `challenge=${challenge?.challenge?.slice(0, 12)}… recipe present`);
  await rolaOriginCheck(t);

  const badLogin = await call('login', { challenge: challenge?.challenge ?? 'x', address: 'account_rdx1xxxx', publicKey: '00', signature: '00', curve: 'curve25519' });
  check('login teaches on failure', !!badLogin.result?.isError, JSON.stringify(payload(badLogin)).slice(0, 100));

  // ---- plain-GET surface ---------------------------------------------------
  console.log(`\n=== plain-GET surface ===`);
  const gs = (await (await fetch(`${BASE}/api/wiki?q=radix&pageSize=5`)).json()) as { total?: number; items?: Array<Record<string, unknown>> };
  check('GET /api/wiki?q=', (gs.total ?? 0) > 0 && (gs.items?.length ?? 0) > 0, `${gs.total} hits`);
  rowParity(t, 'search q= row-identity', search?.pages, gs.items);

  if (first) {
    const md = await fetch(`${BASE}/${first.tagPath}/${first.slug}.md`);
    const mdBody = await md.text();
    check(
      '.md twin',
      md.status === 200 && (md.headers.get('content-type') ?? '').includes('text/markdown') && !!md.headers.get('last-modified') && !!md.headers.get('etag'),
      `${md.status} ${md.headers.get('content-type')} etag=${md.headers.get('etag')}`,
    );
    check('.md is real markdown', !/<(Infobox|List|AssetPrice|Column)\b/.test(mdBody) && !mdBody.includes('. $1'), 'no JSX component tags, no $1 artifacts');
  }

  // The plain-GET lane's commonest mistake, and the one an agent that guessed a
  // URL meets. `Page not found` gave it nothing to retry from.
  const guessed = await fetch(`${BASE}/contents/tech/zzz-not-a-page.md`);
  const guessedBody = await guessed.text();
  check('a wrong .md teaches',
    guessed.status === 404 && guessedBody.includes('llms.txt') && guessedBody.includes('zzz-not-a-page'),
    `${guessed.status} ${guessedBody.slice(0, 90)}`);

  // Every surface an agent recrawls, not only the ones that already passed.
  await conditionalGetChecks(t, [
    'llms.txt',
    ...(first ? [`${first.tagPath}/${first.slug}.md`] : []),
  ]);

  // Built from code rather than rows, so an ETag is the whole validator. The
  // default list is the six S10 descriptors, which are this origin's six.
  await descriptorChecks(t);

  await robotsChecks(t, ['/api/mcp', '/llms.txt', '/.well-known/agent-card.json']);

  // A sitemap nominates pages for indexing, and Search Console filed the text
  // indexes under "crawled, currently not indexed", so src/app/sitemap.ts leaves
  // llms.txt out on purpose. Agents find it through robots.txt and the layout.
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  check('sitemap omits llms.txt', !/\/llms\.txt/.test(sitemap), 'no llms.txt row');

  process.exit(t.summary());
})();
