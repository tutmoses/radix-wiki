// scripts/sweep-359-developers-wikilinks.mjs
//
// Wikilinks the whole `developers` subtree against a term -> page map. The
// tutorials were written as standalone documents: "blueprint", "vault",
// "ROLA", "Gateway SDK" appear hundreds of times across 34 pages and almost
// none of them reach the article that defines the term.
//
// Rules, which are Wikipedia's:
//   - FIRST mention per page only. A page that says "resource" forty times
//     gets one link.
//   - Never inside an existing <a>, <code>, <pre> or a heading. The HTML is
//     walked as a tag/text token stream so a term inside markup or an
//     attribute is never touched.
//   - Never link a page to itself, and never add a second link to a target the
//     page already links to.
//   - Longest term first, so "Radix dApp Toolkit" wins over "Radix Engine"
//     wins over "Radix".
//
// Usage: node scripts/sweep-359-developers-wikilinks.mjs [--dry-run] [--verbose]

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const PREFIX = 'developers';
const MAX_PER_PAGE = 14;

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
const NO_LINK_TAGS = new Set(['a', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

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
    parts[i] = part.replace(matcher, (match) => {
      if (added.length >= budget) return match;
      const href = resolve(match);
      if (!href || claimed.has(href)) return match;
      claimed.add(href);
      added.push({ text: match, href });
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

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  const { rows } = await client.query(
    `SELECT id, tag_path, slug, title, version, content FROM pages
     WHERE tag_path = $1 OR tag_path LIKE $2 ORDER BY tag_path, slug`, [PREFIX, `${PREFIX}/%`]);

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

    const [maj, min, patch] = page.version.split('.').map(Number);
    const version = `${maj}.${min}.${patch + 1}`;
    console.log(`  ${DRY ? '[dry] ' : ''}${path.padEnd(48)} v${page.version} -> v${version}  +${added.length}`);
    if (VERBOSE) for (const a of added) console.log(`        ${a.text.padEnd(26)} -> ${a.href}`);

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
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
