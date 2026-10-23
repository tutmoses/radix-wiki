// ═══════════════════════════════════════════════════════════════════════════
//  RADIX.WIKI STUDIO – data helpers
//  Thin read-only `pg` queries over the wiki's "WikiPage" table so a video can pick a
//  real, currently-live page to film (no on-chain state: the wiki signs nothing). Same Pool pattern as scripts/seed-utils.mjs. Runs under plain `node`,
//  so it loads DATABASE_URL itself (Next auto-loads .env for the dev server; this
//  process does not).
// ═══════════════════════════════════════════════════════════════════════════
import pg from "pg";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;

function dbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const env = readFileSync(resolve(root, ".env"), "utf8");
    const m = env.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
    if (m) return m[1].trim();
  } catch { /* fall through */ }
  throw new Error("DATABASE_URL not set and not found in .env");
}

let _pool;
const pool = () => (_pool ??= new Pool({ connectionString: dbUrl(), max: 1, ssl: { rejectUnauthorized: false } }));
const q = async (sql, params) => (await pool().query(sql, params)).rows;
export const disconnect = () => _pool?.end() ?? Promise.resolve();

// The page named by TOUR_PAGE (`ecosystem/weft-finance`), so a routine can film the
// page it just changed; otherwise a recent content/ecosystem article, which
// leads with an infobox for the Ken Burns shot. Returns
// { tag_path, slug, title } or null.
export async function pickPage() {
  const want = process.env.TOUR_PAGE?.replace(/^\/|\/$/g, "");
  try {
    const [r] = want
      ? await q(`SELECT "tagPath" AS tag_path, slug, title FROM "WikiPage" WHERE "siteId" = '' AND "tagPath" || '/' || slug = $1`, [want])
      : await q(
          `SELECT "tagPath" AS tag_path, slug, title FROM "WikiPage"
             WHERE "siteId" = '' AND ("tagPath" LIKE 'contents/%' OR "tagPath" LIKE 'ecosystem%')
               AND slug <> 'wiki-maintenance-log'
             ORDER BY "updatedAt" DESC LIMIT 1`,
        );
    return r ?? null;
  } catch { return null; }
}
