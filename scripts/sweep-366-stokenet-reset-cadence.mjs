import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const SENTINEL = 'every 6 months or so';
const DRY = process.argv.includes('--dry-run');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const CITE_CADENCE = '<a href="https://t.me/radix_dlt/1001768" target="_blank" rel="noopener">t.me/radix_dlt/1001768</a>';
const CITE_REDEPLOY = '<a href="https://t.me/radix_dlt/1001787" target="_blank" rel="noopener">1001787</a>';

const targets = [
  {
    tagPath: 'developers/getting-started',
    slug: '03-deploying',
    version: '2.3.1',
    changeType: 'patch',
    find: 'The operator intends to repeat the exercise every 9&ndash;12 months, so a Stokenet deployment is best treated as disposable by default.',
    replace:
      'How often this recurs has been stated twice, differently, by the same side. The 16 August announcement gave <strong>9&ndash;12 months</strong>. '
      + 'Asked on 3 September 2026 why the reset happened at all, Timan Rebel answered for the operator &ndash; &ldquo;we simply did a reset&rdquo; &ndash; that it was '
      + '&ldquo;to be able to keep it running &lt; 1TB needed storage. It was a cost issue.. By heart the plan is to do this <strong>every 6 months or so</strong>&rdquo; '
      + '(' + CITE_CADENCE + ', embed-verified), and, asked whether that was a problem for developers, &ldquo;you will have to redeploy your packages and resources, '
      + 'but that is about it&rdquo; (' + CITE_REDEPLOY + '). The later figure is offered from memory, so take the cadence as somewhere between the two and the '
      + 'principle as settled: a Stokenet deployment is disposable by default, and the constraint driving it is the cost of storing the ledger.',
  },
  {
    tagPath: 'contents/tech/releases',
    slug: 'stokenet',
    version: '1.10.3',
    changeType: 'patch',
    find: 'The operator plans to <strong>repeat the exercise every 9&ndash;12 months</strong>. That turns what reads as a one-off cleanup into a standing property of the test network: a Stokenet deployment is now expected to be disposable on roughly an annual cycle, and anything a project needs to keep should live in its own source control rather than on the test ledger.',
    replace:
      'The operator plans to repeat the exercise, but has given two different intervals: the 16 August announcement said <strong>9&ndash;12 months</strong>, '
      + 'while on 3 September 2026 Timan Rebel, answering for the operator, said the reset was &ldquo;to be able to keep it running &lt; 1TB needed storage. '
      + 'It was a cost issue.. By heart the plan is to do this <strong>every 6 months or so</strong>&rdquo; (' + CITE_CADENCE + ', embed-verified) &ndash; '
      + 'the later figure explicitly from memory. Either way it turns what reads as a one-off cleanup into a standing property of the test network: '
      + 'a Stokenet deployment is expected to be disposable on a cycle measured in months rather than years, and anything a project needs to keep '
      + 'should live in its own source control rather than on the test ledger.',
  },
];

try {
  for (const t of targets) {
    if (isLockedPage(t.tagPath, t.slug)) throw new Error(`${t.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [t.tagPath, t.slug]);
    if (!rows.length) throw new Error(`page not found: ${t.tagPath}/${t.slug}`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(SENTINEL)) {
      console.log(`  ${t.slug}: already applied — no write`);
      continue;
    }
    const walk = (bs) => {
      for (const b of bs) {
        if (b.text?.includes(t.find)) { b.text = b.text.replace(t.find, t.replace); return true; }
        if (b.blocks && walk(b.blocks)) return true;
      }
      return false;
    };
    if (!walk(blocks)) throw new Error(`find string not matched on ${t.slug}`);

    const metadata = { ...(page.metadata || {}), last_verified_at: new Date().toISOString() };
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${t.version}`);
    if (DRY) {
      const hit = JSON.stringify(blocks).indexOf(SENTINEL);
      console.log('    ...' + JSON.stringify(blocks).slice(hit - 700, hit + 500) + '\n');
    } else {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, metadata=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
        [json, t.version, JSON.stringify(metadata), now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, t.version, t.changeType, AUTHOR_ID,
         'Stokenet reset cadence: the wiki carried the 16 August "every 9-12 months" figure alone. On 3 September Timan Rebel, answering for the operator, gave the cause (keeping the ledger under 1 TB, a cost issue) and a different interval, "every 6 months or so", explicitly from memory, plus the consequence for developers. Both intervals now recorded and attributed rather than one asserted. Sources embed-verified per /policy/verifiability.',
         now]);
      await client.query('COMMIT');
      console.log('    written');
    }
  }
} finally {
  client.release();
  await pool.end();
}
