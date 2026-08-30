/**
 * Run 331 (ecosystem rotation, staleness head).
 *
 * /ecosystem/acuiq had never been verified and its corpus figures were the
 * marketing round numbers the site stopped publishing: "7,000+ symptoms,
 * 400+ acupoints ... 200+ treatment protocols". The project now publishes an
 * exact census on its own About page - 5,242 entries, 773 catalogued points,
 * 14,237 indexed symptom terms - and splits every entry by evidence kind, two
 * of those kinds being weaker than "derived from case studies" implied. The
 * privacy claim was also too strong: llms.txt says searches ARE tallied by
 * symptom, with no visitor attached, which is not "no stored user data".
 *
 * The page also missed the thing that changed since July: AcuiQ grew a full
 * agent surface - an MCP server with six tools, an A2A agent card, OpenAPI
 * 3.1, markdown twins, IIIF atlas tiles and a CC BY 4.0 grant - all probed
 * live on 30 August 2026. That is the same standard this wiki documents under
 * /developers/ai-agents, so it belongs on the page and cross-links there.
 *
 * CONFLICT OF INTEREST, disclosed per /policy/conflict-of-interest: AcuiQ is
 * built by the same operator as this wiki. Every figure below is quoted from
 * the subject's own published pages and every endpoint was probed live; the
 * "Relationship to Radix" section's negative finding (still no component, no
 * token, no wallet integration) is restated rather than softened.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'acuiq';
const SENTINEL = '5,242 entries';
const DRY = process.argv.includes('--dry-run');

const replacements = [
  // 1. The privacy claim, corrected to what the project actually says.
  [`no login, no accounts, and, per the site's own description, no stored user data (<a href="https://acuiq.com/llms.txt" target="_blank" rel="noopener">acuiq.com/llms.txt</a>).`,
   `no login, no account and no cookies. The project does not claim to store nothing: its own agent-discovery document states that searches are tallied by symptom with no visitor attached (<a href="https://acuiq.com/llms.txt" target="_blank" rel="noopener">acuiq.com/llms.txt</a>), which is a per-symptom counter rather than a per-person record.`],

  // 2. The corpus figures, replaced with the published census.
  [`<p>The platform maps symptoms to protocols by fuzzy matching against a database the project describes as 7,000+ symptoms, 400+ acupoints across 14 meridians, and 200+ treatment protocols derived from case studies.`,
   `<p>The platform resolves a query to symptom concepts, expands it over synonyms and narrower terms, and matches by text similarity. The corpus is published as an exact census rather than a round number: as of 30 August 2026 the project's <a href="https://acuiq.com/about" target="_blank" rel="noopener">About &amp; Method</a> page records <strong>5,242 entries linking symptoms to points, drawn from 773 catalogued points across 14,237 indexed symptom terms</strong>. Each entry is labelled with the kind of evidence behind it, and the split matters more than the total: 3,842 are study-reported and carry a DOI or article link, 1,066 come from clinical texts, compiled prescription sets or individual case reports, 332 are taken from acupuncture websites rather than the literature, and 2 lost their source in extraction. The page says the last two classes rank below the first and are being pruned.`],

  // 3. Products - name the two dedicated product URLs.
  [`<p>Both products are available directly from symptom and protocol pages on acuiq.com.</p>`,
   `<p>Both are sold through Stripe and have their own pages &ndash; <a href="https://acuiq.com/buy/press-needles" target="_blank" rel="noopener">/buy/press-needles</a> and <a href="https://acuiq.com/buy/treatment-guide" target="_blank" rel="noopener">/buy/treatment-guide</a> &ndash; and are also reachable from symptom and protocol pages. The project states it does not recommend a product for a symptom.</p>`],

  // 4. Research output - the second essay, with its figures.
  [`An example is <em>"TF4 Is Not a Point"</em>, which documents that acupuncture point codes are published without a namespace, so a code written under one standard and read under another resolves to a different location.</p>`,
   `Two essays are published. <em>"TF4 Is Not a Point"</em> documents that acupuncture point codes are published without a namespace, so a code written under one standard and read under another resolves to a different location: across 48,579 point references extracted from the literature, 37 resolved silently to the wrong point (<a href="https://acuiq.com/research/codes-are-not-identifiers" target="_blank" rel="noopener">acuiq.com/research/codes-are-not-identifiers</a>). <em>"Nothing in This Literature Ever Fails"</em> audits the evidence base the matcher is built on and reports against its own database: 541 protocols derived from animal research, 1,034 more that cannot be verified at all, and 31 point pages that forbade the condition they treated (<a href="https://acuiq.com/research/nothing-ever-fails" target="_blank" rel="noopener">acuiq.com/research/nothing-ever-fails</a>). An index and an RSS feed are published at <a href="https://acuiq.com/research" target="_blank" rel="noopener">acuiq.com/research</a>.</p>`],

  // 5. Re-date the Radix-relationship finding to this run's check.
  [`<p>AcuiQ is listed in this directory as a project of a Radix-ecosystem team, not as a deployed Radix application. As of July 2026 it runs entirely on conventional web infrastructure: there is no Radix component, no token, and no wallet integration, and the public site does not reference Radix or blockchain anywhere.</p>`,
   `<p>AcuiQ is listed in this directory as a project of a Radix-ecosystem team, not as a deployed Radix application. The finding is unchanged on a re-check of 30 August 2026: it runs entirely on conventional web infrastructure, there is no Radix component, no token and no wallet integration, and the words <em>Radix</em>, <em>blockchain</em>, <em>wallet</em> and <em>crypto</em> do not appear on either the home page or the About page. Its only machine-facing payment path is a Stripe checkout link returned by an agent tool, which the project is explicit is opened by a human.</p>`],

  // 6. External links - the agent-surface entry points.
  [`<li><a href="https://acuiq.com/llms.txt" target="_blank" rel="noopener">llms.txt – AI agent discovery document</a></li></ul>`,
   `<li><a href="https://acuiq.com/about" target="_blank" rel="noopener">About &amp; Method &ndash; what the database holds, and how results rank</a></li><li><a href="https://acuiq.com/llms.txt" target="_blank" rel="noopener">llms.txt &ndash; AI agent discovery document</a></li><li><a href="https://acuiq.com/.well-known/openapi.json" target="_blank" rel="noopener">OpenAPI 3.1 specification</a></li><li><a href="https://acuiq.com/.well-known/agent-card.json" target="_blank" rel="noopener">A2A agent card</a></li></ul>`],
];

// New section, inserted before External Links as its own block.
const AGENT_SECTION = `<h2>Agent surface</h2>
<p>Since the July 2026 entry above, AcuiQ has published a machine-facing layer alongside the human site, and it is the part of the project most likely to interest a Radix developer. The pattern is the one this wiki documents under <a href="/developers/ai-agents/radix-context" rel="noopener">AI agents</a>: a discovery document, a spec-correct <a href="/developers/ai-agents/ai-agents-and-x402" rel="noopener">Model Context Protocol</a> server, and a parallel machine-readable copy of every page. All of the endpoints below were probed on 30 August 2026 and returned 200.</p>
<ul>
<li><strong>MCP server</strong> &ndash; JSON-RPC 2.0 over streamable HTTP at <a href="https://acuiq.com/api/mcp" target="_blank" rel="noopener">acuiq.com/api/mcp</a>, announcing itself as <code>acuiq</code> 1.1.0 on protocol version 2025-03-26, rate-limited to 200 requests per minute per IP and requiring no key. It exposes six tools: <code>search_symptoms</code>, <code>search_protocols</code>, <code>get_meridians</code>, <code>get_symptom_detail</code>, <code>get_point</code> and <code>create_checkout</code>. The first five are annotated read-only; the sixth returns a Stripe Checkout URL for a person to open, so the agent never handles payment data.</li>
<li><strong>Discovery documents</strong> &ndash; an <a href="https://acuiq.com/llms.txt" target="_blank" rel="noopener">llms.txt</a> index and a full-content <a href="https://acuiq.com/llms-full.txt" target="_blank" rel="noopener">llms-full.txt</a> export, an <a href="https://acuiq.com/.well-known/agent-card.json" target="_blank" rel="noopener">A2A agent card</a>, an <a href="https://acuiq.com/.well-known/openapi.json" target="_blank" rel="noopener">OpenAPI 3.1 specification</a> and an <a href="https://acuiq.com/.well-known/mcp.json" target="_blank" rel="noopener">MCP manifest</a>.</li>
<li><strong>Markdown twins</strong> &ndash; every symptom and acupoint page serves the same data as markdown at <code>/symptoms/{slug}.md</code> and <code>/points/{code}.md</code>.</li>
<li><strong>Image and data endpoints</strong> &ndash; the acupoint atlas is served as <a href="https://iiif.io/api/image/3.0/" target="_blank" rel="noopener">IIIF Image API 3</a> level-0 tiles, and an ISO/WFAS auricular code crosswalk is published as a standalone <a href="https://acuiq.com/data/auricular-crosswalk-v1.json" target="_blank" rel="noopener">JSON file under CC BY 4.0</a>.</li>
</ul>
<p>The licence is declared in the discovery document rather than left implicit: AcuiQ-authored content &ndash; the compilation, the prose, the research essays and the ear and scalp-line plates &ndash; is released under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> and may be ingested into retrieval and training corpora, with attribution at dataset level. The body diagrams are excluded from the grant, and the grant is stated to cover the compilation rather than the underlying findings, which remain the cited sources' claims.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const hits = new Set();
  const apply = (text) => {
    let out = text;
    for (const [from, to] of replacements) {
      if (out.includes(from)) { out = out.split(from).join(to); hits.add(from.slice(0, 40)); }
    }
    return out;
  };
  for (const b of blocks) {
    if (typeof b.text === 'string') b.text = apply(b.text);
    for (const n of b.blocks || []) if (typeof n.text === 'string') n.text = apply(n.text);
  }
  const missed = replacements.filter(([from]) => !hits.has(from.slice(0, 40)));
  if (missed.length) {
    for (const [from] of missed) console.error('   MISS:', from.slice(0, 110));
    throw new Error('aborting rather than writing a partial edit');
  }

  const extIdx = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes('<h2>External Links</h2>'));
  if (extIdx < 0) throw new Error('External Links block not found');
  blocks.splice(extIdx, 0, { id: uid(), type: 'content', text: AGENT_SECTION });

  const version = '2.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${JSON.stringify(page.content).length} -> ${JSON.stringify(blocks).length} B`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'First verification of this page. Replaces the stale round-number corpus claim (7,000+ symptoms / 400+ acupoints / 200+ protocols) with the census the project now publishes at acuiq.com/about - 5,242 entries, 773 points, 14,237 symptom terms - and its evidence-kind split, two classes of which are weaker than the old wording implied. Corrects "no stored user data" to what llms.txt actually says (searches tallied by symptom, no visitor attached). Adds the second research essay and a new Agent surface section covering the MCP server, discovery documents, markdown twins, IIIF tiles and the CC BY 4.0 grant, all probed live on 30 Aug 2026. Re-dates the Relationship to Radix finding, which is unchanged: still no component, token or wallet integration. CONFLICT OF INTEREST disclosed per /policy/conflict-of-interest - AcuiQ is built by the same operator as this wiki; every figure is quoted from the subject’s own published pages and the unfavourable findings are restated, not softened.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
