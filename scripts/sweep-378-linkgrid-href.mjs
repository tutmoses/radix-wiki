// scripts/sweep-378-linkgrid-href.mjs — repair linkGrid links stored as `url`.
//
// `LinkGridLink` is `{ label, href }`. Five Week in Review issues stored their
// links as `{ id, label, url }` instead: the `ReferenceItem` shape, which the
// `grid()` helper in scripts/_apply.mjs was copied from and which differs by one
// field name. Nothing complained. `LinkGridView` DROPS a link whose href fails
// `safeLinkHref` rather than rendering it inert, so each of those pages rendered
// its "Everything else this week" rubric as group headings with no pills, and
// `linkGridToMarkdown` dropped them from the .md twin the same way.
//
// The app's `validateBlocks` requires `urlCheck(l.href)` and would have refused
// this content. It only landed because a direct-DB writer never calls it.
//
//   node scripts/sweep-378-linkgrid-href.mjs --dry-run
//   node scripts/sweep-378-linkgrid-href.mjs
//
// Idempotent: a page whose links already carry a usable href is not rewritten.

import { config } from 'dotenv';
import { bump } from 'wiki-formant/versioning';
import { safeLinkHref } from 'wiki-formant/validation';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const MESSAGE =
  'Repair the linkGrid links, which were stored under `url` where LinkGridLink is '
  + '{ label, href }. The renderer drops a link with no usable href, so the group '
  + 'headings were showing with no pills beneath them and the markdown twin lost '
  + 'them too. Field renamed in place; no link target changed.';

/** Every linkGrid in a block tree, nested ones included, with a printable path. */
function* linkGrids(blocks) {
  for (const [i, b] of (blocks || []).entries()) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'linkGrid') yield [b, `[${i}]`];
    if (b.type === 'infobox') for (const [n, j] of (b.blocks || []).entries().map(([j, n]) => [n, j]))
      if (n?.type === 'linkGrid') yield [n, `[${i}].blocks[${j}]`];
    if (b.type === 'columns') for (const [ci, c] of (b.columns || []).entries())
      for (const [j, n] of (c?.blocks || []).entries())
        if (n?.type === 'linkGrid') yield [n, `[${i}].columns[${ci}].blocks[${j}]`];
  }
}

/**
 * Rewrite `url` to `href` on every link that needs it. Mutates `blocks` (already
 * a clone) and returns what it did. A link with neither field usable cannot be
 * repaired by renaming and is reported instead of guessed at.
 */
function repair(blocks) {
  const fixed = [];
  const unrepairable = [];
  for (const [grid, path] of linkGrids(blocks)) {
    for (const [gi, g] of (grid.groups || []).entries()) {
      for (const [li, l] of (g?.links || []).entries()) {
        if (!l || typeof l !== 'object') { unrepairable.push(`${path}.groups[${gi}].links[${li}] is not an object`); continue; }
        if (safeLinkHref(l.href)) continue;                       // already good
        if (!safeLinkHref(l.url)) {
          unrepairable.push(`${path}.groups[${gi}].links[${li}] "${l.label ?? '(no label)'}" `
            + `has fields {${Object.keys(l).sort().join(', ')}} and no usable url to rename`);
          continue;
        }
        l.href = l.url;
        delete l.url;
        fixed.push(`${g.heading} / ${l.label}  ->  ${l.href}`);
      }
    }
  }
  return { fixed, unrepairable };
}

await withClient(async (client) => {
  const { rows } = await client.query(
    `SELECT id, tag_path, slug, title, version, content FROM pages
      WHERE content::text LIKE '%"linkGrid"%' ORDER BY tag_path, slug`);
  console.log(`${rows.length} page(s) carry a linkGrid.\n`);

  let touched = 0, clean = 0;
  const blocked = [];

  for (const page of rows) {
    const label = `${page.tag_path}/${page.slug || '(hub)'}`;
    const blocks = JSON.parse(JSON.stringify(page.content));      // deep clone, never mutate in place
    const { fixed, unrepairable } = repair(blocks);

    if (unrepairable.length) {                                    // never guess at a link target
      blocked.push(`${label}\n    ` + unrepairable.join('\n    '));
      continue;
    }
    if (!fixed.length) { clean++; continue; }                     // idempotency guard
    if (isLockedPage(page.tag_path, page.slug)) {
      blocked.push(`${label} — LOCKED (LOCKED_PAGES in src/lib/tags.ts), ${fixed.length} link(s) left unrepaired`);
      continue;
    }

    assertLinkShapes(blocks, label);                              // the repair must satisfy the write-path guard
    const version = bump(page.version, 'patch');                  // a data-shape repair, not a content change
    touched++;
    console.log(`${DRY ? '[dry] ' : ''}${label}  v${page.version} -> v${version}  (${fixed.length} link(s))`);
    for (const f of fixed) console.log(`        ${f}`);

    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4',
        [json, version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,'patch',$6,$7,$8)`,
        [cuid(), page.id, json, page.title, version, AUTHOR_ID, MESSAGE, now]);
      await client.query('COMMIT');
    }
    console.log('');
  }

  console.log(`\n${DRY ? '[dry] would touch' : 'touched'}: ${touched}   already correct: ${clean}   blocked: ${blocked.length}`);
  for (const b of blocked) console.log(`  BLOCKED  ${b}`);
  if (blocked.length) process.exitCode = 1;
});
