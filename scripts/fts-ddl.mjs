// scripts/fts-ddl.mjs — create the `pages.search_tsv` full-text column + GIN index.
//
// Idempotent; safe to re-run. Run this BEFORE declaring `searchTsv` in
// schema.prisma, never after — see the ordering note below.
//
// Two facts about this column that are not obvious and cost real time:
//
//   1. `prisma db push` DROPS the column if it is not declared in schema.prisma
//      (`ALTER TABLE "pages" DROP COLUMN "search_tsv"`), and DROPS THE INDEX if
//      that is not declared either. Hence both the `Unsupported("tsvector")?`
//      field and the `@@index([searchTsv], type: Gin)` line in the schema.
//   2. Push must never CREATE the column either. Prisma emits a PLAIN
//      `ADD COLUMN "search_tsv" tsvector` with no generation expression, which
//      stays empty forever and fails silently. Prisma cannot express
//      `GENERATED ALWAYS AS`, so the column has to be made here first.
//   3. With both declared, `migrate diff` still emits one statement:
//      `ALTER COLUMN "search_tsv" DROP DEFAULT` — Prisma reads the generation
//      expression as a default and wants it gone. Postgres REFUSES it
//      (SQLSTATE 42601, "is a generated column"), so push fails loudly rather
//      than silently breaking the column. Verified on a scratch table. That
//      error is the expected outcome, not a problem to fix.
//
// Connection: BOTH ports run DDL fine — an earlier note here claimed PgBouncer
// on :6543 could not, and that was wrong (CREATE/DROP TABLE both succeed on
// 6543). What genuinely needs :5432 is PRISMA INTROSPECTION:
// `prisma migrate diff --from-config-datasource` hangs forever on 6543 and
// returns immediately on 5432. `db.<ref>.supabase.co` is IPv6-only and returns
// EHOSTUNREACH from a dev machine. Always set connectionTimeoutMillis —
// without it a bad route HANGS instead of erroring.

import pg from 'pg';
import { config } from 'dotenv';
import { searchTsvSql } from 'wiki-formant/search';
config();

const url = process.env.DATABASE_URL.replace(':6543', ':5432').replace(/\?.*$/, '');
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
await c.connect();
const q = (s) => c.query(s).then(r => r.rows);

// Title at weight A, prose at weight B, so a title hit outranks a body hit
// inside the full-text tier as well as across tiers. The expression comes from
// the package because `searchPageIds` reads it from there too, and the two must
// agree exactly or the literal tier and the full-text tier disagree about what
// counts as prose.
const GENERATED = searchTsvSql();

// This used to skip whenever the column existed, which made the script
// idempotent about the column and blind to its EXPRESSION — a changed prose
// expression re-ran clean and changed nothing, leaving the stale one in the
// database with no signal. That is exactly the state this repo was in when the
// JSON-punctuation fix landed in the package. Rebuild instead: the column is
// derived data, regenerated from `content`, so dropping it loses nothing, and
// DROP+ADD in one transaction means no reader sees the table without it.
// Postgres normalises the stored expression (adds casts, reformats), so
// comparing it to this string can only produce false rebuilds — an
// unconditional rebuild on a hand-run script is cheaper than a lying compare.
await q('BEGIN');
await q(`ALTER TABLE pages DROP COLUMN IF EXISTS search_tsv`);
await q(`ALTER TABLE pages ADD COLUMN search_tsv tsvector
    GENERATED ALWAYS AS (${GENERATED}
    ) STORED`);
await q('COMMIT');
console.log('rebuilt generated column search_tsv');
await q(`CREATE INDEX IF NOT EXISTS pages_search_tsv_idx ON pages USING GIN (search_tsv)`);
console.log('GIN index present');

console.table(await q(`select column_name, data_type, is_generated from information_schema.columns
  where table_name='pages' and column_name='search_tsv'`));
console.table(await q(`select count(*)::int pages, count(*) filter (where search_tsv is null)::int null_tsv from pages`));
await c.end();
