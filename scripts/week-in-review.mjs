// scripts/week-in-review.mjs — the Radix Week in Review series: nav, index page, prediction ledger.
//
// The series index lives at /blog/week-in-review. Its machine state (the scored
// prediction ledger, and one throughline per recap) is in pages.metadata.state;
// the visible blocks are re-rendered from it, the same shape as maintenance-log.mjs.
//
//   node scripts/week-in-review.mjs read                 # print state JSON
//   node scripts/week-in-review.mjs write '<json>'       # replace state, then sync
//   node scripts/week-in-review.mjs sync [--dry-run]     # rebuild nav + index from the DB
//   node scripts/week-in-review.mjs resolve <name>...    # does this entity have a page?
//
// `sync` is idempotent and safe to run at any time: it compares against what is
// already stored and writes nothing when the rendering is already correct. That
// content-equality guard is the point — a sentinel would only prove a nav block
// exists, not that it says the right thing. The hand-written chain broke silently
// three times (sweeps 202 and 224 found it weeks later) because every anchor in a
// stale nav still resolves 200.

import { config } from 'dotenv';
import { bump } from 'wiki-formant/versioning';
import { uid, cuid, AUTHOR_ID, isLockedPage, esc, meta, withClient } from './seed-utils.mjs';

config({ path: new URL('../.env', import.meta.url) });

const TAG = 'blog';
const INDEX_SLUG = 'week-in-review';
const RECAP_LIKE = 'week-in-review-%';
const INDEX_TITLE = 'Radix Week in Review';

const [mode, ...rest] = process.argv.slice(2);
const DRY = process.argv.includes('--dry-run');
const EN = '\u2013';
const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** The week a recap covers: the seven days ending on its metadata.date. */
function weekLabel(iso) {
  const end = new Date(`${iso}T00:00:00Z`);
  if (isNaN(end)) return null;
  const start = new Date(end.getTime() - 6 * 86400000);
  const [sm, sd, sy] = [start.getUTCMonth(), start.getUTCDate(), start.getUTCFullYear()];
  const [em, ed, ey] = [end.getUTCMonth(), end.getUTCDate(), end.getUTCFullYear()];
  if (sy !== ey) return `${MONTH[sm]} ${sd}, ${sy} ${EN} ${MONTH[em]} ${ed}, ${ey}`;
  // Spaced en dash only when the range crosses a month, per the established labels.
  if (sm !== em) return `${MONTH[sm]} ${sd} ${EN} ${MONTH[em]} ${ed}, ${ey}`;
  return `${MONTH[sm]} ${sd}${EN}${ed}, ${ey}`;
}

// Sentinel for finding an existing nav block. Colon-free on purpose: the visible
// label gained an issue number ("…series, Issue #9:"), and a sentinel carrying the
// old trailing colon stopped matching what sync itself had just written, so every
// run appended a second nav instead of rewriting the first.
const NAV_MARK = 'Radix Week in Review series';
const LEGACY_FOOTER = /is a knowledge and community hub/i;
const FEED_PATH = '/week-in-review.xml';

/** An issue number is a recap's chronological rank among its siblings, so #1 is the
 *  oldest and a published number never moves. src/lib/week-in-review.ts and
 *  src/app/week-in-review.xml/route.ts derive it the same way. */
const issueLabel = (n) => `Issue #${n}`;

/** The scored record, mirroring `scoreline()` in src/lib/week-in-review.ts. Kept off
 *  the individual recaps on purpose: it moves as claims resolve, and stamping it on
 *  every recap would rewrite all of them each sync for a number one click away. */
function scoreline(state) {
  const preds = (state && state.predictions) || [];
  const hit = preds.filter((p) => p.status === 'hit').length;
  const miss = preds.filter((p) => p.status === 'miss').length;
  const open = preds.filter((p) => p.status === 'open').length;
  const scored = hit + miss;
  if (!scored && !open) return 'Predictions are scored against the ledger as they come due.';
  if (!scored) return `${open} prediction${open === 1 ? '' : 's'} open, none scored yet.`;
  const rate = Math.round((hit / scored) * 100);
  return `${hit} of ${scored} predictions hit (${rate}%)${open ? `, ${open} still open` : ''}.`;
}

/** Foot nav for one recap. Carries the previous week's excerpt, so an unchained
 *  page is visible to a reader rather than only to a link checker. */
function navHtml(prev, next, issue) {
  const parts = [];
  if (prev) parts.push(`<a href="/blog/${prev.slug}" rel="noopener">← Previous: ${esc(prev.label)}</a>`);
  if (next) parts.push(`<a href="/blog/${next.slug}" rel="noopener">Next: ${esc(next.label)} →</a>`);
  parts.push(`<a href="/blog/${INDEX_SLUG}" rel="noopener">All recaps</a>`);
  // The feed was reachable only by browser auto-discovery, which is no route at all
  // for a reader who wants the series in a reader or forwarded to their mail.
  parts.push(`<a href="${FEED_PATH}" rel="noopener">Subscribe</a>`);
  const mark = issue ? `${NAV_MARK}, ${issueLabel(issue)}:` : `${NAV_MARK}:`;
  const nav = `<hr><p><strong>${mark}</strong> ${parts.join(' \u00b7 ')}</p>`;
  // The serial-continuity line the competitor opens with. It belongs at the foot: the
  // Essay preset needs the opening to land on the week, not on a summary of last week.
  const previously = prev?.excerpt ? `<p><em>Previously:</em> ${esc(prev.excerpt)}</p>` : '';
  return nav + previously;
}

async function loadRecaps(client) {
  const { rows } = await client.query(
    `SELECT id, slug, title, version, content, metadata FROM pages
      WHERE tag_path = $1 AND slug LIKE $2 ORDER BY slug`,
    [TAG, RECAP_LIKE],
  );
  const recaps = [];
  for (const r of rows) {
    const date = meta(r).date;
    const label = date ? weekLabel(date) : null;
    if (!label) { console.warn(`  skip ${r.slug} — no usable metadata.date`); continue; }
    recaps.push({ ...r, date, label, excerpt: meta(r).excerpt || '' });
  }
  return recaps.sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
}

// ---------------------------------------------------------------- index page

function renderIndex(state, recaps) {
  const preds = state.predictions || [];
  const open = preds.filter((p) => p.status === 'open');
  const done = preds.filter((p) => p.status === 'hit' || p.status === 'miss');
  const hits = done.filter((p) => p.status === 'hit').length;
  const rate = done.length ? `${Math.round((hits / done.length) * 100)}%` : '—';
  const since = preds.length ? preds.map((p) => p.recorded).sort()[0] : '—';

  const row = (cells, tag = 'td') => `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join('')}</tr>`;
  const table = (heads, rows) =>
    `<table><tbody>${row(heads, 'th')}${rows.join('')}</tbody></table>`;

  const openRows = open
    .sort((a, b) => String(a.due).localeCompare(String(b.due)))
    .map((p) => row([esc(p.claim), esc(p.who || ''), esc(p.due || ''), esc(p.check || ''), esc(p.recorded || '')]));

  const doneRows = done
    .sort((a, b) => String(b.resolved || '').localeCompare(String(a.resolved || '')))
    .slice(0, 25)
    .map((p) => row([
      esc(p.claim),
      esc(p.due || ''),
      p.status === 'hit' ? '<strong>Hit</strong>' : 'Miss',
      esc(p.evidence || ''),
      esc(p.resolvedIn || ''),
    ]));
  const hidden = Math.max(0, done.length - 25);

  const voided = preds.filter((p) => p.status === 'void');

  // Newest first, each recap carrying the issue number it was published under.
  const numbered = recaps.map((r, i) => ({ ...r, issue: i + 1 })).reverse();

  const recapRow = (r) => {
    const html = JSON.stringify(r.content || []);
    const internal = (html.match(/href=\\?"\/(?!\/)/g) || []).length;
    const outbound = (html.match(/href=\\?"https?:/g) || []).length;
    return row([
      `<a href="/blog/${r.slug}" rel="noopener">#${r.issue}</a>`,
      esc(r.label),
      esc(r.title.replace(/^Radix Week in Review:\s*/, '')),
      esc((state.throughlines || {})[r.slug] || r.excerpt || ''),
      `${internal} / ${outbound}`,
    ]);
  };

  // Grouped by the month a week ended in. A flat table of one row per week stops
  // scanning at about twenty; months give the archive a shape that keeps growing.
  const months = [];
  for (const r of numbered) {
    const d = new Date(`${r.date}T00:00:00Z`);
    const key = `${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    const group = months.find((m) => m.key === key);
    if (group) group.rows.push(recapRow(r));
    else months.push({ key, rows: [recapRow(r)] });
  }
  const recapHeads = ['#', 'Week', 'Title', 'What it was about', 'Links (wiki / out)'];

  return [
    { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text:
      `<table><tbody>` +
      `<tr><th>Latest</th><td>${recaps.length ? esc(issueLabel(recaps.length)) : '\u2014'}</td></tr>` +
      `<tr><th>Recaps</th><td>${recaps.length}</td></tr>` +
      `<tr><th>Open predictions</th><td>${open.length}</td></tr>` +
      `<tr><th>Resolved</th><td>${done.length}</td></tr>` +
      `<tr><th>Hit rate</th><td>${rate}</td></tr>` +
      `<tr><th>Tracking since</th><td>${esc(since)}</td></tr>` +
      `<tr><th>Feed</th><td><a href="${FEED_PATH}" rel="noopener">RSS</a></td></tr>` +
      `</tbody></table>` }] },
    { id: uid(), type: 'content', text:
      `<p>Every week the Radix Week in Review records what the ecosystem said would happen, ` +
      `with a date by which it should have happened and the check that will settle it. ` +
      `When the date arrives the claim is scored against the ledger, the repository or the source, ` +
      `and the result is kept here whichever way it went. Nothing is removed from this page ` +
      `because it turned out badly, and nothing is recorded that has no date and no check.</p>` },
    { id: uid(), type: 'content', text:
      `<h2>Open predictions</h2>` +
      (openRows.length
        ? table(['Claim', 'Who', 'Due by', 'How it gets checked', 'Recorded'], openRows)
        : '<p>Nothing outstanding.</p>') },
    { id: uid(), type: 'content', text:
      `<h2>Resolved</h2>` +
      (doneRows.length
        ? table(['Claim', 'Due by', 'Outcome', 'Evidence', 'Scored in'], doneRows) +
          (hidden ? `<p>${hidden} older resolved ${hidden === 1 ? 'claim is' : 'claims are'} held in the page state.</p>` : '')
        : '<p>Nothing scored yet.</p>') +
      (voided.length
        ? `<h3>Withdrawn</h3><ul>${voided.map((p) => `<li>${esc(p.claim)} ${EN} ${esc(p.evidence || 'no longer decidable')}</li>`).join('')}</ul>`
        : '') },
    { id: uid(), type: 'content', text:
      `<h2>Every recap</h2>` +
      `<p>${esc(scoreline(state))} The series is published every Sunday and carried in full by ` +
      `<a href="${FEED_PATH}" rel="noopener">its own feed</a>.</p>` +
      (months.length
        ? months.map((m) => `<h3>${esc(m.key)}</h3>${table(recapHeads, m.rows)}`).join('')
        : '<p>None yet.</p>') },
  ];
}

// ---------------------------------------------------------------- operations

async function readIndex(client) {
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG, INDEX_SLUG],
  );
  return rows[0] || null;
}

/** Reuse block ids positionally so the app's block diff reads as modified, not replaced. */
function keepIds(next, prev) {
  return next.map((b, i) => {
    const old = prev?.[i];
    if (!old || old.type !== b.type) return b;
    if (b.type === 'infobox') {
      return { ...b, id: old.id, blocks: (b.blocks || []).map((sb, j) => (old.blocks?.[j] ? { ...sb, id: old.blocks[j].id } : sb)) };
    }
    return { ...b, id: old.id };
  });
}

const textOf = (blocks) => JSON.stringify((blocks || []).map((b) => b.text ?? (b.blocks || []).map((s) => s.text)));

/** Postgres jsonb does not preserve key order, so a round-tripped state never matches
 *  a raw JSON.stringify of the same object. Compare canonically or every run rewrites. */
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

async function sync(client, stateOverride) {
  const recaps = await loadRecaps(client);
  if (!recaps.length) { console.error('No recaps found.'); return; }

  let wrote = 0, ok = 0;

  // ---- per-recap nav
  for (let i = 0; i < recaps.length; i++) {
    const r = recaps[i];
    const prev = recaps[i - 1];
    const next = recaps[i + 1];
    // recaps[i] is issue i+1, so its neighbours are issues i and i+2.
    const html = navHtml(
      prev && { slug: prev.slug, label: `${issueLabel(i)}, ${prev.label}`, excerpt: prev.excerpt },
      next && { slug: next.slug, label: `${issueLabel(i + 2)}, ${next.label}` },
      i + 1,
    );
    if (/\u00a0/.test(html.replace(/&nbsp;/g, ''))) throw new Error(`literal U+00A0 in nav for ${r.slug}`);

    if (isLockedPage(TAG, r.slug)) { console.warn(`  SKIP ${r.slug} — locked`); continue; }

    const blocks = JSON.parse(JSON.stringify(r.content || []));
    const navAt = blocks.reduce((acc, b, i) =>
      (typeof b.text === 'string' && b.text.includes(NAV_MARK) ? [...acc, i] : acc), []);
    const at = navAt.length ? navAt[0] : -1;
    // A page should carry exactly one nav. Drop any extra, newest first so the
    // earlier indices stay valid.
    const dupes = navAt.slice(1);
    for (const i of [...dupes].reverse()) blocks.splice(i, 1);
    let action;
    if (at >= 0) {
      if (!dupes.length && blocks[at].text === html) { ok++; console.log(`  ${r.slug}  nav ok`); continue; }
      blocks[at] = { ...blocks[at], text: html };
      action = dupes.length ? `nav rewritten, ${dupes.length} duplicate(s) removed` : 'nav rewritten';
    } else {
      // Three older recaps carry a legacy site-footer block; the nav belongs above it.
      const footer = blocks.findIndex((b) => typeof b.text === 'string' && LEGACY_FOOTER.test(b.text));
      const pos = footer >= 0 ? footer : blocks.length;
      blocks.splice(pos, 0, { id: uid(), type: 'content', text: html });
      action = footer >= 0 ? 'nav added (above legacy footer)' : 'nav added';
    }

    // The index counts each recap's links straight out of its content, and
    // loadRecaps read that content before this loop rewrote it. Hand the new
    // blocks forward or the index renders last run's counts and needs a second
    // pass to settle.
    r.content = blocks;

    const version = bump(r.version, 'patch');
    console.log(`  ${DRY ? '[dry] ' : ''}${r.slug}  v${r.version} -> v${version}  ${action}`);
    if (DRY) {
      const plain = (h) => h.replace(/<\/(p|h\d|li)>/g, ' ').replace(/<[^>]+>/g, '').replace(/&middot;/g, '\u00b7')
        .replace(/&nbsp;/g, ' ').replace(/&rarr;/g, '\u2192').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
      if (at >= 0) console.log(`        was: ${plain(r.content[at].text)}`);
      console.log(`        now: ${plain(html)}`);
    }
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content = $1, version = $2, updated_at = $3 WHERE id = $4',
        [json, version, now, r.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,'patch',$6,$7,$8)`,
        [cuid(), r.id, json, r.title, version, AUTHOR_ID,
         'Rebuild the series navigation from the published recaps', now]);
      await client.query('COMMIT');
    }
    wrote++;
  }

  // ---- index page
  const existing = await readIndex(client);
  const state = stateOverride ?? (existing ? (meta(existing).state ?? {}) : {});
  const content = renderIndex(state, recaps);

  if (!existing) {
    console.log(`  ${DRY ? '[dry] ' : ''}${INDEX_SLUG}  page created (v1.0.0)`);
    if (!DRY) {
      const now = new Date().toISOString();
      const id = cuid();
      const json = JSON.stringify(content);
      const metadata = JSON.stringify({
        excerpt: 'Every Radix Week in Review, and a scored record of what the ecosystem predicted.',
        state,
      });
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO pages (id, slug, title, content, tag_path, metadata, version, author_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'1.0.0',$7,$8,$8)`,
        [id, INDEX_SLUG, INDEX_TITLE, json, TAG, metadata, AUTHOR_ID, now]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,'1.0.0','major',$5,$6,$7)`,
        [cuid(), id, json, INDEX_TITLE, AUTHOR_ID, 'Create the Week in Review series index and prediction ledger', now]);
      await client.query('COMMIT');
    }
    wrote++;
  } else {
    const same = textOf(content) === textOf(existing.content) &&
      canonical(state) === canonical(meta(existing).state ?? {});
    if (same) {
      console.log(`  ${INDEX_SLUG}  no change`);
      ok++;
    } else {
      const version = bump(existing.version, 'minor');
      console.log(`  ${DRY ? '[dry] ' : ''}${INDEX_SLUG}  v${existing.version} -> v${version}  index rebuilt`);
      if (!DRY) {
        const now = new Date().toISOString();
        const json = JSON.stringify(keepIds(content, existing.content));
        const metadata = JSON.stringify({ ...meta(existing), state });
        await client.query('BEGIN');
        await client.query('UPDATE pages SET content = $1, metadata = $2, version = $3, updated_at = $4 WHERE id = $5',
          [json, metadata, version, now, existing.id]);
        await client.query(
          `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
           VALUES ($1,$2,$3,$4,$5,'minor',$6,$7,$8)`,
          [cuid(), existing.id, json, existing.title, version, AUTHOR_ID,
           'Update the series index and prediction ledger', now]);
        await client.query('COMMIT');
      }
      wrote++;
    }
  }

  console.log(`${DRY ? '[dry] ' : ''}Done. ${wrote} page(s) to write, ${ok} already correct.`);
}

/** Does this thing already have a page? The recap's internal links fell from 15 to 4
 *  because names that HAVE pages were written as plain text. */
async function resolve(client, names) {
  let hit = 0;
  for (const name of names) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { rows } = await client.query(
      `SELECT tag_path, slug, title,
              CASE WHEN slug = $1 THEN 'slug'
                   WHEN lower(title) = lower($2) THEN 'title'
                   WHEN title ILIKE $4 THEN 'prefix'
                   ELSE 'contains' END AS kind
         FROM pages
        WHERE slug = $1 OR lower(title) = lower($2) OR title ILIKE $3
        ORDER BY 4, length(title) LIMIT 3`,
      [slug, name, `%${name}%`, `${name}%`],
    );
    if (!rows.length) { console.log(`  ${name}  ->  MISS`); continue; }
    // Only an exact slug or title match is safe to paste unread; anything looser is a
    // candidate for a human to confirm. "Scrypto" contains-matches "Academia Scrypto".
    const exact = rows.filter((r) => r.kind === 'slug' || r.kind === 'title');
    if (exact.length) hit++;
    for (const r of (exact.length ? exact : rows)) {
      const path = r.slug ? `/${r.tag_path}/${r.slug}` : `/${r.tag_path}`;
      const mark = r.kind === 'slug' || r.kind === 'title' ? '' : `  [${r.kind} match — confirm]`;
      console.log(`  ${name}  ->  ${path}   "${r.title}"${mark}`);
      if (!mark) console.log(`      <a href="${path}" rel="noopener">${name}</a>`);
    }
  }
  console.log(`${hit} hit / ${names.length - hit} miss`);
}

await withClient(async (client) => {
  if (mode === 'read') {
    const row = await readIndex(client);
    if (!row) { console.error('Index page not found. Run: node scripts/week-in-review.mjs sync'); process.exit(2); }
    process.stdout.write(JSON.stringify(meta(row).state ?? {}, null, 2) + '\n');
  } else if (mode === 'sync') {
    await sync(client);
  } else if (mode === 'write') {
    const payload = rest.find((a) => !a.startsWith('--'));
    if (!payload) throw new Error('write requires a JSON state argument');
    await sync(client, JSON.parse(payload));
  } else if (mode === 'resolve') {
    const names = rest.filter((a) => !a.startsWith('--'));
    if (!names.length) throw new Error('resolve requires at least one name');
    await resolve(client, names);
  } else {
    console.error('Usage: node scripts/week-in-review.mjs <read|write|sync|resolve> [json|names] [--dry-run]');
    process.exit(1);
  }
});
