// Run 365, ecosystem rotation. The page's dated website note said anthic.io has
// no DNS record; on 4 September 2026 it resolves and answers 200. It has not
// come back - the registration auto-renewed on 3 September and the domain now
// serves a GoDaddy parking lander. Corrects the note with the fresh reading and
// strips the nofollow this auto-generated page puts on its external citations.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'anthic';
const SENTINEL = 'autoRenewPeriod';
const DRY = process.argv.includes('--dry-run');

const FIND = '<p><em>Website (30 July 2026): <code>anthic.io</code> has no DNS record.';
const OLD_START = '<p><em>Website (30 July 2026):';

const NOTE = `<p><em>Website (4 September 2026): <code>anthic.io</code> resolves again and answers HTTP 200, and the project has not come back with it. The 200 is 114 bytes of JavaScript redirecting to <code>/lander</code>, which serves a <a href="https://www.godaddy.com/" target="_blank" rel="noopener noreferrer">GoDaddy</a> parking page &mdash; the nameservers are <code>ns59</code> and <code>ns60.domaincontrol.com</code> and the document declares <code>window.LANDER_SYSTEM</code> and pushes a <code>parking</code> marker. WHOIS shows why: the domain was created on 28 August 2024, its registrar registration expired on 28 August 2026, and it sits in <code>autoRenewPeriod</code> having been updated at 18:26&nbsp;UTC on 3 September 2026, one day before this reading, with registry expiry now 28 August 2027. This is the same registration lapsing into a parking page and being auto-renewed, not a re-registration by a third party and not a relaunch. <code>docs.anthic.io</code> and <code>app.anthic.io</code> still have no DNS record at all, and the project has published nothing since. <code>anthic.com</code> is a different domain and a different owner &mdash; an unrelated Lithuanian cycling-tourism site, not a successor. The link stays off this page&#39;s facts table: a domain answering 200 from a parking lander is the plainest form of the caveat the <a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">operational-status index</a> attaches to every website probe, which is that a domain outlives the project on it.</em></p>`;

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
    console.log('  already applied - no write');
    process.exit(0);
  }

  const body = blocks.find(b => b.type === 'content' && b.text?.includes(FIND));
  if (!body) throw new Error('stale website note not found verbatim');
  const cut = body.text.indexOf(OLD_START);
  body.text = body.text.slice(0, cut) + NOTE;

  // Every external citation on this page carries rel="... nofollow" from the bulk
  // generator. The wiki cites primary sources on purpose; suppress nothing.
  let stripped = 0;
  const sweep = (list) => {
    for (const b of list) {
      if (typeof b.text === 'string') {
        const was = (b.text.match(/nofollow/g) || []).length;
        b.text = b.text.replace(/ noreferrer nofollow"/g, '"').replace(/ nofollow"/g, '"');
        stripped += was;
      }
      if (Array.isArray(b.blocks)) sweep(b.blocks);
    }
  };
  sweep(blocks);
  const remaining = (JSON.stringify(blocks).match(/nofollow/g) || []).length;
  if (remaining) throw new Error(`${remaining} nofollow attributes survived`);

  const version = '3.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  note replaced; ${stripped} nofollow attributes stripped, ${remaining} remaining`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       "Correct the website note: anthic.io resolves and returns 200 again as of 4 September 2026, but serves a GoDaddy parking lander after the registration auto-renewed on 3 September - the domain came back, the project did not. docs/app subdomains still have no DNS. Also strips the nofollow the bulk generator put on all 42 external citations.", now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
