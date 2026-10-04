// Sweep 532: /ecosystem/xrdegen recorded on 30 July 2026 that xrdegen.com had no DNS record.
// Re-read 4 Oct 2026: the .com registry (whois.verisign-grs.com) returns 'No match for domain
// "XRDEGEN.COM"', so the name has lapsed and is open to anyone. The lead still described the
// platform in the present tense with no hint it is gone; one status sentence added there, and the
// website note re-dated to the registry reading. The GitBook (200) remains the cited record.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'xrdegen';
const SENTINEL = 'Registry (4 October 2026)';
const LEAD_ANCHOR = 'offering traders a secure environment for buying and selling digital assets.</p>';
const LEAD_ADD = '<p>The marketplace is no longer reachable: its domain has lapsed and its walkthrough video has been removed, which is why this page lists the project as dormant. Its <a href="https://xrdegen.gitbook.io/xrdegen" target="_blank" rel="noopener">GitBook documentation</a> is still served, and the description below is drawn from it.</p>';
const NOTE_OLD = /<p><em>Website \(30 July 2026\):.*?<\/em><\/p>/s;
const NOTE_NEW = `<p><em>Website (30 July 2026): <code>xrdegen.com</code> had no DNS record, so the link was removed from this page&#39;s facts table. ${SENTINEL}: the .com registry returns &ldquo;No match&rdquo; for <code>xrdegen.com</code>, so the name has lapsed and anyone can register it. Four defunct Radix projects&#39; domains have already been re-registered as unrelated landing pages; do not treat a future site at that address as the project.</em></p>`;
const DRY = process.argv.includes('--dry-run');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied – no write'); process.exit(0); }

  const lead = blocks.find((b) => b.type === 'content' && b.text?.includes(LEAD_ANCHOR));
  if (!lead) throw new Error('lead anchor not found');
  lead.text = lead.text.replace(LEAD_ANCHOR, LEAD_ANCHOR + LEAD_ADD);
  const noteBlock = blocks.find((b) => b.type === 'content' && NOTE_OLD.test(b.text ?? ''));
  if (!noteBlock) throw new Error('website note not found');
  noteBlock.text = noteBlock.text.replace(NOTE_OLD, NOTE_NEW);

  const version = '2.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 532: lead now says the marketplace is unreachable and the page rests on its GitBook; website note re-dated to 4 Oct 2026, when the .com registry (whois.verisign-grs.com) returned No match for xrdegen.com.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
