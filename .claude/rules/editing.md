# Editing wiki pages

How a script creates or edits a page in radix.wiki's production database.

## Seeding Wiki Pages

To create pages programmatically (bypassing API auth), write `scripts/seed-<name>.ts` with a `pages` array and pass it to `insertPages(pages, defaultTagPath, revisionMessage)` from `scripts/wiki-utils.ts`. It checks existence per page (idempotent), honours `LOCKED_PAGES`, and writes each page and its first revision through the store. The scripts that stay are `wiki-utils.ts` (this wiki's helpers over `wiki-formant/scripts`) and `seed-infographics.mjs` (the deploy the infographics routine calls every time); every other `seed-*` is deleted once its page is verified.

```javascript
import { uid, insertPages } from './wiki-utils.ts';

const pages = [
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'page-slug',
    title: 'Page Title',
    metadata: { excerpt: 'One-sentence excerpt (≤160 chars).' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table>...</table>' }] },
      { id: uid(), type: 'content', text: '<h2>Introduction</h2><p>...</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li>...</li></ul>' },
    ],
  },
];
await insertPages(pages, 'contents/tech/core-concepts', 'Initial page');
```

- **Block IDs:** every block and nested block gets `uid()`. `'content'` carries an HTML string in `text`; `'infobox'` carries `blocks: AtomicBlock[]`.
- **Columns:** `WikiPage` has no `excerpt` column; the excerpt lives at `metadata.excerpt` (the `/blog.xml` feed reads it).
- **Tag paths** must exist in `TAG_HIERARCHY`.
- **Author:** `AUTHOR_ID` from `wiki-utils.ts` (Hydrate); its `writeRevision` signs every revision with it.

### Content quality standards
- **Voice** — `radix-studio/VOICE.md` §4 Essay
- **Infobox first** — every page starts with an infobox block containing a `<table>` with key-value metadata
- **Section structure** — Introduction → 2-3 body sections → External Links (all `<h2>`)
- **Hyperlinked assertions** — every factual claim links to its source (`<a href="..." target="_blank" rel="noopener">`)
- **Internal cross-links** — link to other wiki pages via relative paths (e.g., `<a href="/contents/tech/core-protocols/radix-engine" rel="noopener">`)
- **Block boundaries** — each conceptual section gets its own content block (200-800 words each)
- **No inline styles** — semantic HTML only (`<h2>`, `<h3>`, `<ul>`, `<ol>`, `<table>`, `<code>`, `<strong>`, `<em>`)
- **Excerpt** — ≤160 chars, one sentence, no markdown, stored at `metadata.excerpt`

## Editing an Existing Page

Seeding creates; **most script work edits**. This is the dominant operation in `scripts/` and has its own recipe — do not reach for `insertPages()` to change a page that already exists.

Write `scripts/sweep-<run>-<topic>.ts` (a sweep edit) or `scripts/update-<area>-<n>.ts` (a one-off fix), import the shared helpers, and follow the read → guard → mutate → write shape below. Read with `readPage` and write through `writeRevision` (`wiki-formant/scripts`', signed by Hydrate), which is the app's own store; never hand-write SQL against `WikiPage` or `WikiRevision`. Node 24 runs a `.ts` script as is.

Neither kind is committed; the revision row is the record. An `update-*` script is one-time: run it, verify the edit through the API, and delete it in the same session. `sweep-*` scripts are gitignored (`.gitignore` → `/scripts/sweep-*.{mjs,ts}`): wiki-sweep leaves them on disk, untracked.

```javascript
import { uid, isLockedPage, withClient, readPage, writeRevision } from './wiki-utils.ts';

const DRY = process.argv.includes('--dry-run');

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const page = await readPage(client, TAG_PATH, SLUG);
  if (!page) throw new Error('page not found');

  const blocks = JSON.parse(JSON.stringify(page.content));          // deep clone, never mutate in place
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {              // idempotency guard
    console.log('  already applied — no write');
    return;
  }
  // ...splice / replace / rewrite blocks; new blocks get id: uid()

  // Bumps the stored version by `change` and writes the page and its revision in one
  // statement, refused (409) if the page moved since `readPage`; `verified: true`
  // also stamps lastVerifiedAt.
  const version = await writeRevision(client, page, blocks,
    { change: 'minor', message: 'What changed and why, with the source.', dry: DRY });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
```

### Non-negotiables
- **Inspect the DB first, not the live page.** The live site serves ISR/CDN cache (`revalidate = 86400`; `withClient` invalidates the `wiki` tag after a run that wrote, and the first visit after that still gets the stale copy), so a browser load or `WebFetch` can show content the DB has already moved past — and `wiki-sweep` may have applied your fix hours ago. `readPage` (or `/api/wiki/<tagPath>/<slug>/history`) before planning any edit.
- **Respect `LOCKED_PAGES`.** `isLockedPage()` in `src/lib/tags.ts` only guards the app/API write path; a direct-DB script bypasses it silently. `insertPages()` calls it for you; **update scripts must call it themselves**.
- **Every content change writes a revision.** `writeRevision` does it; pass `change` ∈ `major`/`minor`/`patch` and a `message`. An unaudited edit is invisible in history.
- **Idempotency guard before the write.** Check for a sentinel the edit introduces and exit clean if it's there. The guard makes an accidental second run harmless; it is not a reason to keep the script.
- **`--dry-run` on anything non-trivial**, printing the before/after version and what would change.
- **Diagnose from the first run's captured output.** Never re-run a write script just to re-read its error — the write applies again.
- **Bump the version** to match the change: `patch` for a link/typo fix, `minor` for a new or rewritten section, `major` for a restructure.

### Traps
- **`&nbsp;` (U+00A0) in auto-generated prose.** Ecosystem pages generated in bulk carry non-breaking spaces, often right before an inline `<a>`. A `.replace()` written with a normal space silently no-ops and the script still exits 0. Dump codepoints (`[...seg].map(c => c.charCodeAt(0))`) when a match fails, or target a substring with no space in it.
- **Exit 0 ≠ edit landed.** Verify the specific change through `/api/wiki/<tagPath>/<slug>` (uncached JSON), not the rendered page. To check the render, cache-bust with `?v=` and reload 2–3× to force ISR regeneration.
- **This is the live production DB** (Supabase). Every write is public the instant it runs.

### Freshness stamps
`freshnessBanner` from `wiki-formant/freshness` shows a synthetic "outdated" banner on any page whose `lastVerifiedAt` (falling back to `updatedAt`) is older than `DEFAULT_MAX_AGE_DAYS` (180). When a sweep confirms a page's facts are still current **without** needing an edit, stamp it rather than leaving the banner up:

```bash
npx mark-verified <tagPath> <slug> --invalidate wiki    # one page
npx mark-verified --all <tagPath> --invalidate wiki     # every page under a tag path
```
