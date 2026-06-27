// ═══════════════════════════════════════════════════════════════════════════
//  RADIX.WIKI STUDIO — data helpers
//  Thin read-only `pg` queries over the wiki's pages table so a video can pick a
//  real, currently-live page/category to film (no on-chain state — the wiki signs
//  nothing). Same Pool pattern as scripts/seed-utils.mjs. Runs under plain `node`,
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

// The most-populated category (best for a category-grid shot). Falls back to
// 'ecosystem' if the DB is unreachable so the tour still runs.
export async function pickCategory() {
  try {
    const [r] = await q(
      `SELECT tag_path FROM pages WHERE tag_path <> '' GROUP BY tag_path ORDER BY COUNT(*) DESC, MAX(updated_at) DESC LIMIT 1`,
    );
    return r?.tag_path ?? "ecosystem";
  } catch { return "ecosystem"; }
}

// A recent content/ecosystem article — these always lead with an infobox, ideal
// for the Ken Burns focal shot. Returns { tag_path, slug, title } or null.
export async function pickPage() {
  try {
    const [r] = await q(
      `SELECT tag_path, slug, title FROM pages
         WHERE tag_path LIKE 'contents/%' OR tag_path LIKE 'ecosystem%'
         ORDER BY updated_at DESC LIMIT 1`,
    );
    return r ?? null;
  } catch { return null; }
}
