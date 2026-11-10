// ═══════════════════════════════════════════════════════════════════════════
//  RADIX.WIKI STUDIO – data helpers
//  Thin read-only queries over the wiki's "WikiPage" table so a video can pick a
//  real, currently-live page to film (no on-chain state: the wiki signs nothing),
//  through wiki-formant's `withClient`, which loads ./.env itself: Next auto-loads
//  it for the dev server, this process does not.
// ═══════════════════════════════════════════════════════════════════════════
import { withClient } from "wiki-formant/scripts";

// The page named by TOUR_PAGE (`ecosystem/weft-finance`), so a routine can film the
// page it just changed; otherwise a recent content/ecosystem article, which
// leads with an infobox for the Ken Burns shot. Returns
// { tag_path, slug, title } or null.
export function pickPage() {
  const want = process.env.TOUR_PAGE?.replace(/^\/|\/$/g, "");
  return withClient(async (c) => {
    const { rows: [r] } = want
      ? await c.query(`SELECT "tagPath" AS tag_path, slug, title FROM "WikiPage" WHERE "siteId" = '' AND "tagPath" || '/' || slug = $1`, [want])
      : await c.query(
          `SELECT "tagPath" AS tag_path, slug, title FROM "WikiPage"
             WHERE "siteId" = '' AND ("tagPath" LIKE 'contents/%' OR "tagPath" LIKE 'ecosystem%')
               AND slug <> 'wiki-maintenance-log'
             ORDER BY "updatedAt" DESC LIMIT 1`,
        );
    return r ?? null;
  });
}
