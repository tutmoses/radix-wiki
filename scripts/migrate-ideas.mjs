// scripts/migrate-ideas.mjs — Migrate forum + roadmap pages to unified ideas tag path
import pg from 'pg';
import { config } from 'dotenv';
config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });

const CATEGORY_MAP = { '🌐 General': 'Community', '⚖️ Governance': 'Governance', '👾 Developers': 'Tooling' };

async function migrate() {
  const client = await pool.connect();
  try {
    // 1. Migrate forum pages → ideas with status=Discussion
    const forumPages = await client.query("SELECT id, metadata FROM pages WHERE tag_path = 'forum'");
    for (const row of forumPages.rows) {
      const meta = row.metadata || {};
      const newMeta = { ...meta, status: 'Discussion', category: CATEGORY_MAP[meta.category] || 'Community' };
      await client.query("UPDATE pages SET tag_path = 'ideas', metadata = $1 WHERE id = $2", [JSON.stringify(newMeta), row.id]);
    }
    console.log(`Migrated ${forumPages.rowCount} forum pages → ideas`);

    // 2. Migrate roadmap pages → ideas (metadata already has status/priority/quarter/category/owner)
    const roadmapResult = await client.query("UPDATE pages SET tag_path = 'ideas' WHERE tag_path = 'roadmap' RETURNING id");
    console.log(`Migrated ${roadmapResult.rowCount} roadmap pages → ideas`);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
