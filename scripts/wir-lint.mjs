// scripts/wir-lint.mjs — the Week in Review's preflight.
//
// Nine issues were published before anyone measured them, and the measurements were
// unflattering: internal links fell from 15 a week to 4, two of sixteen block types
// were ever used, H2 casing flipped between issues, and the recurring rubrics that
// make a series legible did not exist. None of that is visible while writing, and
// all of it is countable. This is the count, run before publishing and again after.
//
//   node scripts/wir-lint.mjs <slug>          # lint a published recap
//   node scripts/wir-lint.mjs --file <json>   # lint a draft block array
//   node scripts/wir-lint.mjs --all           # every recap, newest first
//
// Exits non-zero if any REQUIRED check fails. Advisories print and do not fail:
// a rule that blocks a true story from shipping is worse than the drift it prevents.

import pg from 'pg';
import fs from 'node:fs';
import { config } from 'dotenv';

config({ path: new URL('../.env', import.meta.url) });

const TAG = 'blog';
const RECAP_LIKE = 'week-in-review-%';

const argOf = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : null; };
const args = process.argv.slice(2);

// ---------------------------------------------------------------- thresholds
//
// Every number here was set from the measured corpus, not from taste. The link
// floor is the March issues' worst week; the budgets are the point at which a
// rubric stops being scannable.
const RULES = {
  minInternalLinks: 8,      // distinct wiki articles, series furniture excluded
  minOutboundLinks: 12,
  maxTelegramShare: 0.45,   // t.me rots and is unreadable to non-members
  minSections: 4,
  rubricBudget: 260,        // words in any single non-essay rubric
  minFigures: 1,
};

// Rubrics the series commits to. `required` ones are the spine; the rest are
// dropped silently on a week that has nothing for them, which is the whole point
// of having them named.
const RUBRICS = [
  { id: 'ledger-table', label: 'The week on the ledger', match: /<h2[^>]*>\s*The week on the ledger/i, required: true },
  { id: 'ledger', label: 'The ledger', match: /<h2[^>]*>\s*The ledger\b/i, required: false },
  { id: 'concept', label: 'This week on the wiki', match: /<h2[^>]*>\s*This week on the wiki/i, required: true },
  { id: 'everything', label: 'Everything else this week', match: /Everything else this week/i, required: true },
  { id: 'next', label: 'What to watch', match: /<h2[^>]*>\s*What to watch/i, required: true },
  { id: 'corrections', label: 'Corrections', match: /<h2[^>]*>\s*Corrections/i, required: true },
  { id: 'sources', label: 'Sources', match: /<h2[^>]*>\s*Sources|"type":"references"/i, required: true },
];

// ---------------------------------------------------------------- extraction

const stripTags = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const words = (s) => (s ? s.split(/\s+/).filter(Boolean).length : 0);

/** Flatten every HTML-bearing field in the block tree, in document order. */
function htmlOf(blocks) {
  const out = [];
  const atomic = (b) => {
    if (!b) return;
    if (typeof b.text === 'string') out.push(b.text);
    if (b.type === 'references') for (const i of b.items || []) out.push(`${i.text}${i.url ? `<a href="${i.url}"></a>` : ''}`);
    if (b.type === 'linkGrid') for (const g of b.groups || []) for (const l of g.links || []) out.push(`<a href="${l.href}">${l.label}</a>`);
    if (b.type === 'testimonial') out.push(`<blockquote>${b.quote}</blockquote>`);
    if (b.type === 'stats') for (const i of b.items || []) out.push(`${i.label} ${i.value}`);
    // A pageList is a link into the corpus even though it stores ids, not hrefs.
    if (b.type === 'pageList') for (const id of b.pageIds || []) out.push(`<a href="/page/${id}"></a>`);
  };
  for (const b of blocks || []) {
    if (b.type === 'infobox') (b.blocks || []).forEach(atomic);
    else if (b.type === 'columns') (b.columns || []).forEach((c) => (c.blocks || []).forEach(atomic));
    else atomic(b);
  }
  return out;
}

function analyse(blocks) {
  const parts = htmlOf(blocks);
  const html = parts.join('\n');
  const json = JSON.stringify(blocks);

  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  // Series furniture is navigation, not a citation of the wiki's own corpus.
  const FURNITURE = /^\/blog\/week-in-review|^\/week-in-review\.xml$/;
  const internal = [...new Set(hrefs.filter((h) => h.startsWith('/') && !h.startsWith('//') && !FURNITURE.test(h)))];
  const outbound = hrefs.filter((h) => /^https?:/i.test(h));
  const outboundUniq = [...new Set(outbound)];
  const telegram = outbound.filter((h) => /(^|\/\/)(t\.me|telegram\.)/i.test(h));

  const h2 = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => stripTags(m[1]));
  const h3 = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) => stripTags(m[1]));

  const types = new Set();
  for (const b of blocks || []) {
    types.add(b.type);
    if (b.type === 'infobox') (b.blocks || []).forEach((s) => types.add(s.type));
    if (b.type === 'columns') (b.columns || []).forEach((c) => (c.blocks || []).forEach((s) => types.add(s.type)));
  }

  return {
    html, json, internal, outbound: outboundUniq, telegramCount: telegram.length, outboundTotal: outbound.length,
    h2, h3, types,
    wordCount: words(stripTags(html)),
    figures: (html.match(/data-graphic=|<svg|<img /gi) || []).length,
    quotes: (html.match(/<blockquote/gi) || []).length,
  };
}

// ---------------------------------------------------------------- checks

function lint(name, blocks) {
  const a = analyse(blocks);
  const fail = [];
  const warn = [];
  const note = [];

  const req = (ok, msg) => (ok ? null : fail.push(msg));
  const adv = (ok, msg) => (ok ? null : warn.push(msg));

  // --- the wiki funnel. The blog exists to feed the corpus; when it stops linking
  // inward it is a newsletter that happens to be hosted on a wiki.
  req(a.internal.length >= RULES.minInternalLinks,
    `internal wiki links ${a.internal.length} < ${RULES.minInternalLinks} (series furniture excluded)`);
  req(a.outbound.length >= RULES.minOutboundLinks,
    `distinct outbound sources ${a.outbound.length} < ${RULES.minOutboundLinks}`);

  // --- sourcing balance. A recap sourced mostly from Telegram cannot be checked by
  // a reader who is not in the channel, and the links die with the message.
  const share = a.outboundTotal ? a.telegramCount / a.outboundTotal : 0;
  adv(share <= RULES.maxTelegramShare,
    `Telegram is ${Math.round(share * 100)}% of outbound links (max ${Math.round(RULES.maxTelegramShare * 100)}%) — quote load-bearing claims in full so they survive the link`);

  // --- the rubrics
  for (const r of RUBRICS) {
    const present = r.match.test(a.html) || r.match.test(a.json);
    if (r.required) req(present, `missing rubric: ${r.label}`);
    else if (!present) note.push(`optional rubric absent: ${r.label}`);
  }

  // --- structure
  req(a.h2.length >= RULES.minSections, `only ${a.h2.length} <h2> sections (min ${RULES.minSections})`);
  req(a.figures >= RULES.minFigures, 'no figure — every issue ships illustrated');

  // Casing drifted between issues (sentence case in one, Title Case in the next).
  // Pick one per issue; mixed casing inside one page is the actual defect.
  const titleCased = a.h2.filter((h) => /\s/.test(h) && h.split(/\s+/).slice(1).filter((w) => /^[A-Z]/.test(w) && w.length > 3).length >= 2);
  adv(titleCased.length === 0 || titleCased.length === a.h2.length,
    `mixed <h2> casing: ${titleCased.length} of ${a.h2.length} are Title Case — pick one`);

  // --- typography absolutes from VOICE.md §7
  req(!/—/.test(a.html), 'em dash present (VOICE.md: en dash, every surface)');
  req(!/ /.test(a.html.replace(/&nbsp;/g, '')), 'literal U+00A0 present');

  // --- block vocabulary. Two of sixteen types were ever used; the rubrics above
  // have first-class blocks and a hand-rolled <ul> of sources is the tell.
  adv(a.types.has('references'), 'sources are hand-rolled HTML — use a `references` block');
  adv(a.quotes > 0 || a.types.has('testimonial'), 'no quotation — a week with no voice but the editor\'s is unusual');
  adv(a.types.has('linkGrid'), '`Everything else` is prose — a `linkGrid` block groups it and stays scannable');

  // --- budgets: a rubric that outgrows its box stops being a rubric.
  const sections = [...a.html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi)];
  for (const [, head, body] of sections) {
    const label = stripTags(head);
    const rubric = RUBRICS.find((r) => r.match.test(`<h2>${label}</h2>`));
    if (rubric && words(stripTags(body)) > RULES.rubricBudget) {
      warn.push(`rubric over budget: "${label}" ${words(stripTags(body))}w > ${RULES.rubricBudget}w`);
    }
  }

  return { name, a, fail, warn, note };
}

function report({ name, a, fail, warn, note }) {
  const status = fail.length ? 'FAIL' : warn.length ? 'warn' : 'ok';
  console.log(`\n${name}  [${status}]`);
  console.log(`  ${a.wordCount} words · ${a.h2.length} h2 · ${a.h3.length} h3 · ${a.internal.length} wiki links · ` +
    `${a.outbound.length} sources (${a.telegramCount}/${a.outboundTotal} telegram) · ${a.figures} figure(s) · ` +
    `${a.quotes} quote(s) · blocks: ${[...a.types].sort().join(', ')}`);
  for (const f of fail) console.log(`  FAIL  ${f}`);
  for (const w of warn) console.log(`  warn  ${w}`);
  for (const n of note) console.log(`  note  ${n}`);
  return fail.length;
}

// ---------------------------------------------------------------- entry

const file = argOf('--file');
if (file) {
  const blocks = JSON.parse(fs.readFileSync(file, 'utf8'));
  process.exit(report(lint(file, Array.isArray(blocks) ? blocks : blocks.content)) ? 1 : 0);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
let failures = 0;
try {
  const all = args.includes('--all');
  const slug = args.find((x) => !x.startsWith('--'));
  if (!all && !slug) {
    console.error('Usage: node scripts/wir-lint.mjs <slug> | --all | --file <blocks.json>');
    process.exit(1);
  }
  const { rows } = all
    ? await client.query(`SELECT slug, content FROM pages WHERE tag_path = $1 AND slug LIKE $2 ORDER BY slug DESC`, [TAG, RECAP_LIKE])
    : await client.query(`SELECT slug, content FROM pages WHERE tag_path = $1 AND slug = $2`, [TAG, slug]);
  if (!rows.length) { console.error(`No recap found${slug ? ` for ${slug}` : ''}.`); process.exit(2); }
  for (const r of rows) failures += report(lint(r.slug, r.content)) ? 1 : 0;
  console.log(`\n${rows.length} recap(s), ${failures} failing.`);
} finally {
  client.release();
  await pool.end();
}
process.exitCode = failures ? 1 : 0;
