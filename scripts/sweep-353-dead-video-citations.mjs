import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 353. scripts/check-links.mjs only ever resolved YouTube through oEmbed when the
// video arrived as an iframe. Cited as an ANCHOR — youtu.be/<id> or watch?v=<id> — a
// deleted or private video answers 303/200 and reads as healthy. Fifty-five distinct
// video ids were cited that way across the corpus; resolving all of them through
// oEmbed on 2 September 2026 found seven a reader cannot watch: four removed
// ("Video unavailable") and three set private by their owner. The checker now probes
// the anchor form too; this removes the seven citations it can no longer vouch for.
const DRY = process.argv.includes('--dry-run');
const NOTE_DATE = '2 September 2026';

const EDITS = [
  {
    tagPath: 'ecosystem', slug: 'xrdegen', changeType: 'patch',
    find: '<p><a href="https://youtu.be/FhSy_RZdyyY">https://youtu.be/FhSy_RZdyyY</a></p>',
    replace: '',
    note: `<em>Video (${NOTE_DATE}): the platform walkthrough this page linked, <code>youtu.be/FhSy_RZdyyY</code>, has been removed from YouTube and answers &ldquo;Video unavailable&rdquo;. The link has been dropped. The project&#39;s <a href="https://xrdegen.gitbook.io/xrdegen" target="_blank" rel="noopener">GitBook documentation</a>, which every citation above rests on, is still served.</em>`,
    noteAfter: 'xrdegen.com</code> has no DNS record at all',
  },
  {
    tagPath: 'contents/tech/core-concepts', slug: 'decentralized-science-desci', changeType: 'patch',
    find: '<p><a target="_blank" rel="noopener noreferrer nofollow" class="link" href="https://youtu.be/QInIDUDf_YQ?t=3797">Video</a></p>',
    replace: '<p>-</p>',
  },
  {
    tagPath: 'contents/history', slug: 'european-blockchain-convention-2024', changeType: 'patch',
    find: ' (<a target="_blank" rel="noopener noreferrer" href="https://youtu.be/TeXUSQhRYJ8?si=fquuf7pmDvuSLXhB">part one</a>, <a target="_blank" rel="noopener noreferrer" href="https://youtu.be/LAX_iMiiJRs?si=JIMQ8YD66S1qQNb7">part two</a>)',
    replace: '; the two-part recording of that session this page cited was removed from YouTube and both halves answered &ldquo;Video unavailable&rdquo; when re-checked on ' + NOTE_DATE,
  },
  {
    tagPath: 'ecosystem', slug: 'ice', changeType: 'patch',
    find: '<p><a href="https://youtu.be/T55DUn6QLgQ" target="_blank" rel="noopener">ICE demo video</a></p>',
    replace: `<p><em>The demo video this page linked, <code>youtu.be/T55DUn6QLgQ</code>, was set to private by its owner and cannot be watched; checked ${NOTE_DATE}.</em></p>`,
  },
  {
    tagPath: 'ecosystem', slug: 'farbocoin', changeType: 'patch',
    find: '<p><a href="https://youtu.be/-7CzzNjvA2o">https://youtu.be/-7CzzNjvA2o</a></p>',
    replace: `<p><em>The project video this page linked, <code>youtu.be/-7CzzNjvA2o</code>, was set to private by its owner and cannot be watched; checked ${NOTE_DATE}.</em></p>`,
  },
  {
    tagPath: 'ecosystem', slug: 'dogecube', changeType: 'patch',
    find: '<p><a href="https://youtu.be/R8BSE2MzqR8">https://youtu.be/R8BSE2MzqR8</a></p>',
    replace: `<p><em>The project video this page linked, <code>youtu.be/R8BSE2MzqR8</code>, was set to private by its owner and cannot be watched; checked ${NOTE_DATE}.</em></p>`,
  },
];

// Every one of these is a link fix, so the version moves by a patch from whatever
// the page currently carries rather than from a number written into this script.
const bumpPatch = (v) => { const [a, b, c] = v.split('.').map(Number); return `${a}.${b}.${c + 1}`; };

const MESSAGE = 'Run 353: removed a YouTube citation a reader cannot watch. Anchor-form YouTube links were never resolved through oEmbed, so deleted and private videos read as healthy 200s; all 55 cited video ids were checked and 7 came back unwatchable. scripts/check-links.mjs now probes the anchor form too.';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));

    const idx = blocks.findIndex((b) => (b.text || '').includes(e.find));
    if (idx < 0) {
      const id = e.find.match(/youtu\.be\/([\w-]+)/)?.[1];
      if (!blocks.some((b) => (b.text || '').includes(id))) {
        console.log(`  ${e.slug}: already applied — no write`);
        continue;
      }
      throw new Error(`${e.slug}: video ${id} present but find-string did not match`);
    }

    let text = blocks[idx].text.replace(e.find, e.replace).replace(/\n{2,}/g, '\n');
    if (e.note) {
      if (!text.includes(e.noteAfter)) throw new Error(`${e.slug}: note anchor not found`);
      const end = text.indexOf('</p>', text.indexOf(e.noteAfter)) + '</p>'.length;
      text = `${text.slice(0, end)}<p>${e.note}</p>${text.slice(end)}`;
    }
    blocks[idx].text = text;

    const version = bumpPatch(page.version);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title.padEnd(38)} v${page.version} -> v${version}  block ${idx}, ${blocks[idx].text.length - page.content[idx].text.length >= 0 ? '+' : ''}${blocks[idx].text.length - page.content[idx].text.length} chars`);

    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
        [json, version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, version, e.changeType, AUTHOR_ID, MESSAGE, now]);
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
