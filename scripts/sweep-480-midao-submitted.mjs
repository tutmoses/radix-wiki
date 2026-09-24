// Sweep run 480 (ideas rotation): the Transition RAC reported on 21 September 2026
// (t.me/RadixAccountabilityCouncil/1056, 13:01 UTC, signed projectShift) that MIDAO has
// submitted the DAO LLC formation documents to the Marshall Islands government, with
// formation expected in about 30 days. /ideas/dao-incorporate-duna-llc still said the
// submission had not been reported as made.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ideas';
const SLUG = 'dao-incorporate-duna-llc';
const SENTINEL = 'RadixAccountabilityCouncil/1056';
const VERSION = '1.7.0';

const LEAD_OLD = 'and on 20 September 2026 the council said its own work is finished and the submission to the registry is now MIDAO&rsquo;s to make.</p>';
const LEAD_NEW = 'the council finished its own part on 20 September 2026, and on 21 September MIDAO submitted the documents to the Marshall Islands government, which the council expects to form the company in about 30 days.</p>';

const ANCHOR = '<h2>Deliverables</h2>';
const SECTION = '<h3 id="21-september-submitted-to-the-marshall-islands">21 September 2026: submitted to the Marshall Islands</h3>'
  + '<p>MIDAO made the submission the next day. The council&rsquo;s <a href="https://t.me/RadixAccountabilityCouncil/1056" target="_blank" rel="noopener">update of 21 September</a>, posted at 13:01 UTC and signed by projectShift like the earlier ones, reports that MIDAO has submitted the documents to the Marshall Islands government and puts formation about 30 days away, which is around 21 October 2026. That starts the registry clock this card has tracked since the agreement was signed on 5 September. The council had earlier put four to six weeks on the registry, and 30 days is the short end of that range.</p>';

const DELIV_OLD = '<li><strong>From 7 September 2026</strong> &ndash; file incorporation, record the entity';
const DELIV_NEW = '<li><strong>Submitted 21 September 2026</strong> &ndash; incorporation filed with the Marshall Islands government by MIDAO, formation expected in about 30 days. Still to do once the company exists: record the entity';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }

  const body = blocks.find((b) => b.type === 'content' && b.text?.includes(ANCHOR));
  if (!body) throw new Error('body block not found');
  for (const [from, to] of [[LEAD_OLD, LEAD_NEW], [DELIV_OLD, DELIV_NEW], [ANCHOR, SECTION + ANCHOR]]) {
    if (body.text.split(from).length !== 2) throw new Error(`expected exactly one match for: ${from.slice(0, 60)}`);
    body.text = body.text.replace(from, to);
  }

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
        'MIDAO submitted the formation documents to the Marshall Islands government on 21 September 2026, formation expected in about 30 days (t.me/RadixAccountabilityCouncil/1056). New dated section; lead and filing deliverable updated.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
