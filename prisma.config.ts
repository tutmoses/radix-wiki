import path from 'node:path';
import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';

dotenv.config();

// Prefer DIRECT_URL: this file is read only by the Prisma CLI, and every CLI
// operation that connects (db push, migrate diff, studio) needs a direct
// session-mode connection. Supabase's pooled PgBouncer endpoint on 6543 (what
// DATABASE_URL points at) cannot serve those and hangs rather than failing.
// The app runtime never loads this file — it builds its adapter from
// DATABASE_URL — so preferring the direct URL here leaves request-path pooling
// untouched, and makes the "temporarily edit DATABASE_URL to :5432" dance in
// CLAUDE.md unnecessary for any repo that sets DIRECT_URL.
//
// Fall back to a placeholder so `prisma generate` (which only reads the schema
// and never connects) can run where neither is set, such as a Vercel preview
// build. CLI operations that actually connect fail loudly against it, which is
// the intended behaviour when both are missing.
//
// Paths are resolved against this file, not the cwd, so the CLI works from a
// subdirectory.
export default defineConfig({
  schema: path.join(import.meta.dirname, 'prisma', 'schema.prisma'),
  migrations: {
    path: path.join(import.meta.dirname, 'prisma', 'migrations'),
  },
  datasource: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
});
