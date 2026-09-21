import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Repairs the sentence sweep-471-engine-layer-stubs.mjs left half-rewritten.
// The original read "The kernel ... does not change between protocol updates;
// the system layer does, and it carries a version number". Replacing the first
// clause removed the verb that "does" stood in for, so the second clause was
// left pointing at nothing.

const TAG_PATH = 'contents/tech/core-protocols';
const SLUG = 'system-layer';
const DRY = process.argv.includes('--dry-run');

const OLD = '</a>); the system layer does, and it carries a version number saying which set of rules is in force.';
const NEW = '</a>). The system layer changes with nearly every update, and it carries a version number saying which '
  + 'set of rules is in force.';

const MESSAGE = 'Repaired the System Versions opening. The previous revision replaced the clause stating the kernel does not change between protocol updates, which left the following "the system layer does" standing in for a verb that was no longer there. The contrast is now stated outright.';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes('changes with nearly every update')) {
    console.log('  already applied - no write');
    process.exit(0);
  }
  const block = blocks.find(b => typeof b.text === 'string' && b.text.includes(OLD));
  if (!block) throw new Error('the dangling clause was not matched');
  if (block.text.split(OLD).length - 1 !== 1) throw new Error('clause matched more than once');
  block.text = block.text.replace(OLD, NEW);

  const [maj, min, pat] = String(page.version).split('.').map(Number);
  const version = `${maj}.${min}.${pat + 1}`;
  console.log(`  ${DRY ? '[dry] ' : ''}/${TAG_PATH}/${SLUG}  v${page.version} -> v${version}`);
  if (DRY) {
    const i = block.text.indexOf('kernel below this layer');
    console.log('\n' + block.text.slice(i - 10, i + 560).replace(/<[^>]+>/g, ''));
  } else {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID, MESSAGE, now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
