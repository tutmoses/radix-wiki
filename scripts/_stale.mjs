import pg from 'pg';
import { config } from 'dotenv';
config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();
const { rows } = await c.query(`
  select slug, version, metadata->>'status' as status,
         to_char(coalesce(last_verified_at, updated_at),'YYYY-MM-DD') as verified,
         to_char(updated_at,'YYYY-MM-DD') as updated,
         length(content::text) as chars
  from pages where tag_path like 'ecosystem%' and slug <> ''
  order by coalesce(last_verified_at, updated_at) asc limit 18`);
for (const r of rows) console.log(r.verified, r.updated, (r.status||'').padEnd(16), String(r.chars).padStart(6), r.slug, 'v'+r.version);
c.release(); await pool.end();
