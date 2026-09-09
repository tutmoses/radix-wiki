// Rewrites every page that referred to the Community section, so no link or
// sentence on the wiki depends on it. Two passes:
//
//   A. prose that described the section, or deferred a fact to a profile
//   B. a blanket unlink of any remaining /community anchor, name kept as text
//
// Run with --dry-run first.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
import { bump } from 'wiki-formant/versioning';
config();

const DRY = process.argv.includes('--dry-run');
const GOVERNANCE = '/contents/tech/core-concepts/radix-governance';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

/** Every block that carries prose, including the ones nested in an infobox or a column. */
function* prose(blocks) {
  for (const b of blocks) {
    if (typeof b.text === 'string') yield b;
    if (Array.isArray(b.blocks)) yield* prose(b.blocks);
    if (Array.isArray(b.columns)) for (const c of b.columns) yield* prose(c.blocks || []);
  }
}

async function write(page, blocks, changeType, message) {
  const version = bump(page.version, changeType);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.tag_path}/${page.slug || '(hub)'} — v${page.version} -> v${version}`);
  if (DRY) return;
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, changeType, AUTHOR_ID, message, now]);
  await client.query('COMMIT');
}

async function load(tagPath, slug) {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, tag_path, slug, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
  if (!rows.length) throw new Error(`page not found: ${tagPath}/${slug}`);
  return rows[0];
}

/** All prose on the page as one string — JSON.stringify escapes hrefs and hides them. */
const allText = (blocks) => [...prose(blocks)].map((b) => b.text).join('\n');

/** One exact substitution, loud when the find-string has drifted. */
function sub(blocks, find, repl) {
  const hits = [...prose(blocks)].filter((b) => b.text.includes(find));
  if (hits.length !== 1) throw new Error(`expected 1 block to contain "${find.slice(0, 70)}…", found ${hits.length}`);
  const b = hits[0];
  const n = b.text.split(find).length - 1;
  if (n !== 1) throw new Error(`expected 1 occurrence, found ${n}: ${find.slice(0, 70)}…`);
  b.text = b.text.replace(find, repl);
}

async function rewrite({ tagPath, slug, changeType, message, sentinel, apply }) {
  const page = await load(tagPath, slug);
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (allText(blocks).includes(sentinel)) {
    console.log(`  ${tagPath}/${slug || '(hub)'}: already applied — no write`);
    return;
  }
  apply(blocks);
  if (!allText(blocks).includes(sentinel)) throw new Error(`${tagPath}/${slug}: edit did not take`);
  await write(page, blocks, changeType, message);
}

try {
  console.log('Pass A — prose that named the section\n');

  // Notability: the standard for a biography, now that the section is gone.
  await rewrite({
    tagPath: 'policy', slug: 'notability', changeType: 'minor',
    sentinel: 'does not keep biographies of living participants',
    message: 'Rewrote the People guideline for the retirement of the Community section: biographies are kept only for figures inseparable from the project’s history.',
    apply: (b) => sub(b,
      `<a href="/community" class="link">Community</a> is a curated set of such biographies, not a directory of everyone with a wallet.`,
      `This wiki does not keep biographies of living participants in the ecosystem. The Community section that held them was retired in September 2026; a person is documented through the pages about the work they did, and gets an article of their own only where they are inseparable from the project&rsquo;s own history.`),
  });

  // Conflict of interest: the conflict outlived the section it named.
  await rewrite({
    tagPath: 'policy', slug: 'conflict-of-interest', changeType: 'minor',
    sentinel: 'the conflict travels with the work',
    message: 'The biographies bullet named a section that no longer exists. The conflict it described now attaches to pages about a contributor’s own work.',
    apply: (b) => sub(b,
      `<li><strong>Biographies</strong> under <a href="/community" class="link">Community</a> – where the subject edits their own entry.</li>`,
      `<li><strong>Pages about a contributor&rsquo;s own work</strong> – where the editor is the author, maintainer or operator of the thing the page documents. This wiki no longer keeps standalone biographies of living contributors, but their work has pages, and the conflict travels with the work.</li>`),
  });

  // No original research: the worked example outlived the page it cited.
  await rewrite({
    tagPath: 'policy', slug: 'no-original-research', changeType: 'patch',
    sentinel: `this wiki&rsquo;s account of the <a href="${GOVERNANCE}"`,
    message: 'Re-pointed the quorum worked example at Radix Governance, which now carries the recomputation.',
    apply: (b) => sub(b,
      `An earlier version of <a href="/community/daffy" class="link">Daffy&rsquo;s page</a> reported the May 2026 governance votes as falling short of the 671,470,000 XRD quorum written into each.`,
      `An earlier version of this wiki&rsquo;s account of the <a href="${GOVERNANCE}" class="link">May 2026 governance votes</a> reported them as falling short of the 671,470,000 XRD quorum written into each.`),
  });

  // Two pages deferred the recomputation to a profile; it lives on Radix Governance now.
  await rewrite({
    tagPath: 'ecosystem', slug: 'radix-accountability-council', changeType: 'patch',
    sentinel: `(the recomputation is on <a href="${GOVERNANCE}"`,
    message: 'Re-pointed the quorum recomputation at Radix Governance, which now carries it.',
    apply: (b) => sub(b,
      `(the recomputation is on <a href="/community/daffy" rel="noopener">Daffy's page</a>)`,
      `(the recomputation is on <a href="${GOVERNANCE}" rel="noopener">Radix Governance</a>)`),
  });

  await rewrite({
    tagPath: 'ideas', slug: 'dao-governance-app-consultation-v2', changeType: 'patch',
    sentinel: `dated 9 August on <a href="${GOVERNANCE}"`,
    message: 'Re-pointed the quorum recomputation at Radix Governance, which now carries it.',
    apply: (b) => sub(b,
      `the fuller recomputation dated 9 August on <a href="/community/daffy" rel="noopener">Daffy's page</a>`,
      `the fuller recomputation dated 9 August on <a href="${GOVERNANCE}" rel="noopener">Radix Governance</a>`),
  });

  // GenkiPool pointed at a companion profile that is going away.
  await rewrite({
    tagPath: 'ecosystem', slug: 'genkipool', changeType: 'patch',
    sentinel: 'a native Rust SDK for Radix.</p>',
    message: 'Dropped the pointer to a separate GENKI community profile; the Community section is retired and this page is the whole record.',
    apply: (b) => sub(b,
      ` (The wiki also has a separate <a href="/community/genki" rel="noopener">GENKI community profile</a>; this page covers the platform and developer tooling.)</p>`,
      `</p>`),
  });

  // The 2023 retrospective listed the surviving directories.
  await rewrite({
    tagPath: 'blog', slug: 'a-year-in-review-2023', changeType: 'patch',
    sentinel: 'The surviving directory is',
    message: 'The Community section joined the jobs board and talent pool in being retired; the retrospective’s note of what survived is updated.',
    apply: (b) => sub(b,
      `The jobs board and talent pool described here no longer exist &mdash; both sections were removed and their paths now 404. The surviving directories are <a href="/ecosystem" rel="noopener">Ecosystem</a> and <a href="/community" rel="noopener">Community</a>`,
      `The jobs board and talent pool described here no longer exist &mdash; both sections were removed and their paths now 404, as was the Community directory in September 2026. The surviving directory is <a href="/ecosystem" rel="noopener">Ecosystem</a>`),
  });

  // ── Pass B: unlink whatever is left, keeping the words.
  console.log('\nPass B — blanket unlink\n');
  const ANCHOR = /<a\s[^>]*href="\/community(?:\/[^"]*)?"[^>]*>(.*?)<\/a>/gis;
  const { rows: rest } = await client.query(
    `SELECT id, tag_path, slug, title, version, content FROM pages
      WHERE content::text LIKE '%/community%' AND tag_path <> 'community' ORDER BY tag_path, slug`);
  for (const page of rest) {
    if (isLockedPage(page.tag_path, page.slug)) { console.log(`  SKIP (locked) ${page.tag_path}/${page.slug}`); continue; }
    const blocks = JSON.parse(JSON.stringify(page.content));
    let n = 0;
    for (const b of prose(blocks)) {
      b.text = b.text.replace(ANCHOR, (_m, inner) => { n++; return inner; });
    }
    if (!n) { console.log(`  ${page.tag_path}/${page.slug || '(hub)'}: no anchors left`); continue; }
    // Only internal hrefs matter: plenty of external URLs contain the word.
    if (allText(blocks).includes('href="/community')) {
      throw new Error(`${page.tag_path}/${page.slug}: an internal /community link survived the unlink`);
    }
    await write(page, blocks, 'patch',
      `Unlinked ${n} reference${n === 1 ? '' : 's'} to the retired Community section. The names stay in the text; the pages they pointed at are gone.`);
  }
  console.log(DRY ? '\ndry run complete — nothing written' : '\nrewrites complete');
} finally {
  client.release();
  await pool.end();
}
