// scripts/wikilink.mjs — link a tag subtree's prose against the term -> page map.
//
// The wiki's articles are written as standalone documents: blueprint, vault,
// worktop, ROLA, Gateway SDK appear hundreds of times and most never reach the
// article that defines the term. This links them, under Wikipedia's rules:
//
//   - FIRST mention per page only. A page that says "resource" forty times
//     gets one link.
//   - Never inside an existing <a>, <code>, <pre> or a heading. The HTML is
//     walked as a tag/text token stream, so a term inside markup or an
//     attribute is never touched, and no run ships a nested anchor.
//   - Never link a page to itself, and never add a second link to a target the
//     page already reaches. The infobox is its own scope: it is a summary table
//     whose every row is a link, so a page-wide budget left rows plain.
//   - Longest term first, so "Radix dApp Toolkit" beats "Radix Engine".
//
// A term map cannot tell a Radix `component` from a web component, so
// NEGATIVE_CONTEXTS vetoes a match on the text before it and PAGE_TERM_DENY
// drops a term for a page that uses it in a non-Radix sense throughout. Both
// were paid for in false positives; see sweep-360.
//
// Usage:
//   node scripts/wikilink.mjs developers --dry-run --verbose
//   node scripts/wikilink.mjs contents/tech

import { config } from 'dotenv';
import { bump } from 'wiki-formant/versioning';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
import { readFileSync } from 'node:fs';
config();

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
// --contexts prints the prose around each proposed link, so a run is reviewable
// before it writes. A term map's failures are all context failures.
const CONTEXTS = args.includes('--contexts');
const PREFIX = args.find(a => !a.startsWith('--'));
const MAX_PER_PAGE = 14;

if (!PREFIX) {
  console.error('usage: node scripts/wikilink.mjs <tagPath> [--dry-run] [--verbose]');
  process.exit(1);
}

// Apostrophes reach the DB as entities, so any term carrying one matches both.
const AP = "(?:'|&rsquo;|&#8217;|\u2019)";

// [pattern, href] — pattern is matched case-insensitively unless it starts a
// group that pins case. Order is significance order: the first pattern that
// matches a run of text claims it.
const TERMS = [
  [`Radix dApp Toolkit`,                    '/developers/frontend/01-radix-dapp-toolkit'],
  [`Gateway SDK`,                           '/developers/frontend/02-gateway-sdk'],
  [`Radix Engine Toolkit`,                  '/developers/transactions/04-radix-engine-toolkit'],
  [`Radix Engine`,                          '/contents/tech/core-protocols/radix-engine'],
  [`Radix Wallet`,                          '/contents/tech/core-protocols/radix-wallet'],
  [`Radix Connect`,                         '/contents/tech/core-protocols/radix-connect'],
  [`Gateway API`,                           '/contents/tech/core-protocols/radix-gateway-api'],
  [`Core API`,                              '/contents/tech/core-protocols/radix-core-api'],
  [`transaction manifests?`,                '/contents/tech/core-protocols/transaction-manifests'],
  [`manifests?`,                            '/contents/tech/core-protocols/transaction-manifests'],
  [`ROLA`,                                  '/developers/frontend/03-rola-authentication'],
  [`Scrypto`,                               '/contents/tech/core-protocols/scrypto-programming-language'],
  [`Stokenet`,                              '/contents/tech/releases/stokenet'],
  [`blueprints?`,                           '/contents/tech/core-concepts/blueprints-and-packages'],
  [`subintents?`,                           '/contents/tech/core-concepts/subintents-and-pre-authorizations'],
  [`pre-authorizations?`,                   '/contents/tech/core-concepts/subintents-and-pre-authorizations'],
  [`access rules?`,                         '/contents/tech/core-concepts/access-rules-and-auth-zones'],
  [`auth zones?`,                           '/contents/tech/core-concepts/access-rules-and-auth-zones'],
  [`badges?`,                               '/contents/tech/core-concepts/badges'],
  [`vaults?`,                               '/contents/tech/core-concepts/buckets-proofs-and-vaults'],
  [`buckets?`,                              '/contents/tech/core-concepts/buckets-proofs-and-vaults'],
  [`worktop`,                               '/contents/tech/core-concepts/worktop'],
  [`resources?`,                            '/contents/tech/core-concepts/resources'],
  [`components?`,                           '/contents/tech/core-concepts/components'],
  [`smart accounts?`,                       '/contents/tech/core-protocols/smart-accounts'],
  [`access controller`,                     '/contents/tech/core-concepts/access-controller'],
  [`consensus manager`,                     '/contents/tech/core-concepts/consensus-manager'],
  [`transaction processor`,                 '/contents/tech/core-concepts/transaction-processor'],
  [`metadata module`,                       '/contents/tech/core-concepts/metadata-module'],
  [`role assignment module`,                '/contents/tech/core-concepts/role-assignment-module'],
  [`component royalties`,                   '/contents/tech/core-concepts/component-royalties'],
  [`substate model`,                        '/contents/tech/core-concepts/substate-model'],
  [`atomic composability`,                  '/contents/tech/core-concepts/atomic-composability'],
  [`asset-oriented`,                        '/contents/tech/core-concepts/asset-oriented-programming'],
  [`NFTs?`,                                 '/contents/tech/core-protocols/nfts-on-radix'],
  [`personas?`,                             '/contents/tech/core-protocols/personas'],
  [`XRD`,                                   '/contents/tech/core-protocols/xrd-token'],
  [`validator nodes?`,                      '/contents/tech/core-concepts/validator-nodes'],
  [`liquid stake units?`,                   '/contents/tech/core-concepts/liquid-stake-units'],
  [`Cerberus`,                              '/contents/tech/core-protocols/cerberus-consensus-protocol'],
  [`sharding`,                              '/contents/tech/core-concepts/sharding'],
  [`Hyperscale`,                            '/contents/tech/research/hyperscale-rs'],
  [`Xi${AP}an`,                             '/contents/tech/releases/radix-mainnet-xian'],
  [`Babylon`,                               '/contents/tech/releases/radix-mainnet-babylon'],
  [`Olympia`,                               '/contents/tech/releases/radix-mainnet-olympia'],
];

// Terms are never linked inside these, nor inside any tag or attribute.
// `svg` matters as much as `code`: several articles embed a kit-rendered figure
// whose <text> nodes are ordinary prose to a tokenizer, and an <a> inside an
// <svg><text> is not a link, it is a broken graphic.
const NO_LINK_TAGS = new Set(['a', 'code', 'pre', 'svg', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

// A term map cannot tell a Radix `component` from a web component, or a Radix
// `resource` from the HTTP resource an x402 client requests. Each pattern is
// tested against the ~40 characters preceding a candidate match, plus the match
// itself; a hit vetoes the link. Every entry here is a false positive this pass
// actually produced and sweep 360 had to undo.
// Tested against the text around a candidate — roughly 200 characters before it,
// the match, and 60 after — so a veto can key on either side of the word.
const NEGATIVE_CONTEXTS = [
  /(?:requests?|returns?|serves?|fetch(?:es)?|delivers?) (?:a|the) resources?\b/i, // an HTTP resource
  /\bweb components?\b/i,                                            // a custom element
  /Hardware Requirements[\s\S]{0,40}Resource/i,                      // a spec table's row label
  /(?:crates\.io|docs\.rs|shields\.io|README)[\s\S]{0,30}badges?\b/i, // build badges
  /\ban ID badge\b/i,                                                // the physical-badge analogy
  /instead of the manifest\b/i,                                      // the dApp-definition JSON
  /\ballocating resources?\b/i,                                      // the economics sense
  /(?:essential|key|core|critical|integral|software) components?\b/i, // "a key component of X"
  /components? of (?:a|the) (?:system|DeFi|DeSci|ecosystem)/i,       // ditto, from the other side
  /\bshared resources?\b/i,                                          // a treasury, IP, trademarks
  /\bresources? gap\b/i,                                             // a funding gap
  /(?:network|organisation|organization)(?:'|&rsquo;|\u2019)?s resources?\b/i, // an attacker's compute
  /\bbanks and vaults\b/i,                                           // the kind with a steel door
  /(?:offers?|provides?|is) an? blueprint for\b/i,                   // the metaphor
  /\bcomponents? must rely on\b/i,                                   // a distributed-systems component
  /(?:strengths|weaknesses)[\s\S]{0,80}NFTs?\b/i,                    // another chain's NFT activity
  /\bcomput(?:ational|ing) resources?\b/i,                            // CPU and RAM
  /\bmore than a badge\b/i,                                          // the metaphor
  /\b(?:S3|Spaces|tenant|storage|object)\s+buckets?\b/i,             // object storage
  /\bbuckets? that now returns\b/i,                                  // ditto, from the other side
  /\bblock manifests?\b/i,                                           // a block's substate list
  /\bcomponents? are necessary\b/i,                                  // "what components are necessary"
];

/** Vetoes keyed on the text *preceding* a match only, where a trailing window would misfire. */
const NEGATIVE_PREFIXES = [
  /[a-z0-9]-$/,   // the tail of a hyphenated name: radixdlt-[rola], radix-[SubIntents]
];

// Pages that use a term in a non-Radix sense throughout, where vetoing one
// context just moves the mistake to the next sentence. The x402 article is about
// HTTP: every "resource" on it is the thing a 402 response gates.
const PAGE_TERM_DENY = {
  'developers/ai-agents/ai-agents-and-x402': ['/contents/tech/core-concepts/resources'],
  'developers/infrastructure/01-running-a-node': ['/contents/tech/core-concepts/resources'],
  // A 2018 research page about a decentralised Twitter: every "component" and
  // "resource" on it is the ordinary computing word.
  // A general distributed-systems article: "component" is the ordinary word
  // throughout, and vetoing one context only moves the link to the next sentence.
  'contents/tech/core-concepts/trust-boundary': ['/contents/tech/core-concepts/components'],
  'contents/tech/research/cassandra': [
    '/contents/tech/core-concepts/components',
    '/contents/tech/core-concepts/resources',
  ],
};

const matcher = new RegExp(`\\b(?:${TERMS.map(([p]) => p).join('|')})\\b`, 'gi');
const resolve = (text) => {
  for (const [pattern, href] of TERMS) {
    if (new RegExp(`^(?:${pattern})$`, 'i').test(text)) return href;
  }
  return null;
};

/**
 * Walks `html` as a tag/text token stream and links the first occurrence of any
 * term whose target is not in `claimed`. Mutates `claimed`; returns the new HTML
 * and what it linked.
 */
function linkify(html, claimed, budget) {
  const parts = html.split(/(<[^>]+>)/);
  const open = [];
  const added = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith('<')) {
      const tag = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/.exec(part);
      if (!tag || !NO_LINK_TAGS.has(tag[2].toLowerCase())) continue;
      if (tag[1]) { const at = open.lastIndexOf(tag[2].toLowerCase()); if (at >= 0) open.splice(at, 1); }
      else if (!part.endsWith('/>')) open.push(tag[2].toLowerCase());
      continue;
    }
    if (open.length || !part.trim() || added.length >= budget) continue;
    parts[i] = part.replace(matcher, (match, offset) => {
      if (added.length >= budget) return match;
      const href = resolve(match);
      if (!href || claimed.has(href)) return match;
      // Joined from the start rather than a fixed token count: splitting on a
      // capture group puts an empty string between adjacent tags, so "six tokens
      // back" reached only <table> and the Hardware-Requirements veto never fired.
      const before = (parts.slice(0, i).join('') + part.slice(0, offset)).slice(-200);
      const after = (part.slice(offset + match.length) + parts.slice(i + 1).join('')).slice(0, 60);
      if (NEGATIVE_PREFIXES.some(re => re.test(before))) return match;
      if (NEGATIVE_CONTEXTS.some(re => re.test(before + match + after))) return match;
      claimed.add(href);
      const plain = (str) => str.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ');
      added.push({ text: match, href, context: `${plain(before).slice(-75)}[${match}]${plain(after)}` });
      return `<a href="${href}" rel="noopener">${match}</a>`;
    });
  }
  return { html: parts.join(''), added };
}

/** A nested <a> is invalid HTML and renders as a broken link, so no output ships without this. */
function assertNoNestedAnchors(html, where) {
  let depth = 0;
  for (const m of html.matchAll(/<(\/?)a\b[^>]*>/gi)) {
    depth += m[1] ? -1 : 1;
    if (depth > 1) throw new Error(`nested <a> produced in ${where}`);
  }
}

/** Text-bearing blocks, flattened out of infoboxes and columns. */
function textBlocks(blocks) {
  const out = [];
  const walk = (list) => list?.forEach(b => {
    if (b.type === 'infobox') return walk(b.blocks);
    if (b.type === 'columns') return b.columns?.forEach(c => walk(c.blocks));
    if (typeof b.text === 'string') out.push(b);
  });
  walk(blocks);
  return out;
}

/**
 * The infobox is its own link scope. It is a summary table whose every row is
 * already a link into the wiki — "Scrypto", "Radix Engine", "Stokenet" all
 * appear in the body too — so a shared once-per-page budget let the body claim
 * a term and leave the matching infobox row as the one plain cell in the table.
 */
function scopes(blocks) {
  const infobox = blocks.filter(b => b.type === 'infobox');
  const body = blocks.filter(b => b.type !== 'infobox');
  return [textBlocks(infobox), textBlocks(body)].filter(list => list.length);
}

/** Internal hrefs already present in a scope, so no target is linked twice within it. */
const claimedIn = (blocks) => new Set(
  blocks.flatMap(b => [...b.text.matchAll(/href="(\/[^"]+)"/g)].map(m => m[1])));

await withClient(async (client) => {
  // Hidden tag paths are wiki-internal surfaces, and the maintenance log under
  // contents/tech/operations is re-rendered from metadata.state on every sweep —
  // linking its prose is work the next run silently throws away.
  const hidden = [...readFileSync(new URL('../src/lib/tags.ts', import.meta.url), 'utf8')
    .matchAll(/slug: '([^']+)'[^}]*hidden: true/g)].map(m => m[1]);
  const { rows } = (await client.query(
    `SELECT id, tag_path, slug, title, version, content FROM pages
     WHERE tag_path = $1 OR tag_path LIKE $2 ORDER BY tag_path, slug`, [PREFIX, `${PREFIX}/%`]))
    .rows.filter(r => !hidden.some(h => r.tag_path === h || r.tag_path.endsWith(`/${h}`)))
    .reduce((acc, r) => (acc.rows.push(r), acc), { rows: [] });

  let touched = 0, totalLinks = 0, skippedLocked = 0;
  const now = new Date().toISOString();

  for (const page of rows) {
    const path = `/${page.tag_path}${page.slug ? `/${page.slug}` : ''}`;
    if (isLockedPage(page.tag_path, page.slug)) { skippedLocked++; continue; }

    const blocks = JSON.parse(JSON.stringify(page.content));
    const added = [];
    for (const scope of scopes(blocks)) {
      // Seeded with what the scope already links, plus the page's own path:
      // no self-links, no second link to a target already reached from here.
      const claimed = claimedIn(scope);
      claimed.add(path);
      for (const href of PAGE_TERM_DENY[`${page.tag_path}/${page.slug}`] ?? []) claimed.add(href);
      for (const block of scope) {
        const budget = MAX_PER_PAGE - added.length;
        if (budget <= 0) break;
        const out = linkify(block.text, claimed, budget);
        assertNoNestedAnchors(out.html, `${path} block ${block.id}`);
        block.text = out.html;
        added.push(...out.added);
      }
    }

    if (!added.length) continue;
    touched++; totalLinks += added.length;

    const version = bump(page.version, 'patch');
    console.log(`  ${DRY ? '[dry] ' : ''}${path.padEnd(48)} v${page.version} -> v${version}  +${added.length}`);
    if (VERBOSE) for (const a of added) console.log(`        ${a.text.padEnd(26)} -> ${a.href}`);
    if (CONTEXTS) for (const a of added) console.log(`        [${a.text}] …${a.context}…`);

    if (DRY) continue;
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       `Wikilink first mentions of ${added.length} Radix terms (${added.map(a => a.text).join(', ')}).`, now]);
    await client.query('COMMIT');
  }

  console.log(`\n  ${DRY ? '[dry] ' : ''}${totalLinks} links across ${touched}/${rows.length} pages${skippedLocked ? `, ${skippedLocked} locked` : ''}`);
});
