// Sweep 522: /ecosystem/hermes-protocol, 2 Oct 2026, head of the ecosystem staleness queue
// after the two locked pages and unisci. The Founders section carried personal details of
// team members (degrees, past employers, hobbies, where two of them met) beyond the names they
// publish under, which the 1 Oct 2026 scope rule takes out. Names stay in History; the Radix DLT
// video that sat under one founder now cites the History paragraph. The four Dormant checks
// were repeated 2 Oct 2026, all unchanged: app.hermesprotocol.io has no A or CNAME record,
// hermesprotocol.io 200 / 150,334 B, newest GitHub push 23 Feb 2024, Telegram last post 27 Jun 2023.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'hermes-protocol';
const SENTINEL = 'repeated on 2 October 2026';
const VIDEO = 'https://youtu.be/OQoDNalYf8k';

const OLD_HISTORY_START = '<h2>History</h2>';
const NEW_HISTORY = '<h2>History</h2>'
  + '<p>The idea for Hermes Protocol emerged during Terra&#39;s second hackathon, where co-founders Sérgio Rebelo, Ana and Duarte built a notification platform that sent on-chain notifications to Discord and Telegram users. Radix DLT later featured the project in <a href="' + VIDEO + '" target="_blank" rel="noopener">Hermes Protocol: Solving the problem of Web3 communication</a>.</p>';
const OLD_STATUS = 'The Dormant status in the infobox rests on four checks made on 13 August 2026, each of which can be repeated in a few seconds:';
const NEW_STATUS = 'The Dormant status in the infobox rests on four checks made on 13 August 2026 and repeated on 2 October 2026 with the same result, each of which can be repeated in a few seconds:';

const DRY = process.argv.includes('--dry-run');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) { console.log('  already applied, no write'); process.exit(0); }
  const blocks = JSON.parse(JSON.stringify(page.content));
  const intro = blocks[0];
  const i = intro.text.indexOf(OLD_HISTORY_START);
  if (i < 0 || !intro.text.includes('<h2>Founders</h2>')) throw new Error('History/Founders not found');
  intro.text = intro.text.slice(0, i) + NEW_HISTORY;
  const status = blocks.find((b) => b.text?.includes(OLD_STATUS));
  if (!status) throw new Error('status sentence not found');
  status.text = status.text.replace(OLD_STATUS, NEW_STATUS);
  const json = JSON.stringify(blocks);
  if (/fencing|Among Us|AXA|Aptoide/.test(json)) throw new Error('personal detail remains');

  const version = '3.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (DRY) console.log(intro.text);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 522: Founders section removed under the 1 Oct 2026 scope rule (no personal details of team members beyond the names they publish under); the co-founders stay named in History, now cited to the Radix DLT feature video. The four Dormant checks were repeated 2 Oct 2026 with the same result: app.hermesprotocol.io has no address record, newest GitHub push 23 Feb 2024, Telegram silent since 27 Jun 2023.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
