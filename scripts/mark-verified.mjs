// scripts/mark-verified.mjs — Stamp a page's last_verified_at after the wiki
// maintenance sweep cross-checks its facts against sources / the live ledger
// (Phase 2 freshness). This is the concrete tool the (agent-driven) sweep calls
// once it has confirmed a page is current; the render layer clears the synthetic
// "outdated" banner for pages verified within FRESHNESS_MAX_AGE_DAYS.
//
// Usage:
//   node scripts/mark-verified.mjs <tagPath> <slug>     stamp one page
//   node scripts/mark-verified.mjs --all <tagPath>      stamp every page under a tag path
import pg from 'pg';
import { config } from 'dotenv';
config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });

async function main() {
  const [, , a, b] = process.argv;
  const now = new Date().toISOString();
  let res;
  if (a === '--all') {
    if (!b) throw new Error('Usage: node scripts/mark-verified.mjs --all <tagPath>');
    res = await pool.query('UPDATE pages SET last_verified_at = $1 WHERE tag_path = $2 OR tag_path LIKE $3', [now, b, `${b}/%`]);
  } else {
    if (!a || !b) throw new Error('Usage: node scripts/mark-verified.mjs <tagPath> <slug>');
    res = await pool.query('UPDATE pages SET last_verified_at = $1 WHERE tag_path = $2 AND slug = $3', [now, a, b]);
  }
  console.log(`Stamped last_verified_at on ${res.rowCount} page(s).`);
  await pool.end();
}

main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
