// Sweep 382 — /community/matthew-hine, the community rotation's oldest
// actionable page (22 August; the older /community/cryptoants is the run-232
// FLAG FOR A HUMAN and stays untouched).
//
// The page's Publication record section ends on an open question: no individual
// byline since September 2024, and "no announcement has stated a change" in his
// role. On 7 September 2026 he answered a wallet-roadmap question in a public
// developer channel, which closes that question with evidence rather than
// inference. Authorship note: the message reached hyperscale.rs as a FORWARD,
// so the embed's author (flightofthefox) is the forwarder and Telegram's
// forwarded-from header is what names Hine.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'community';
const SLUG = 'matthew-hine';
const SENTINEL = 'session mode';
const DRY = process.argv.includes('--dry-run');

const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const SECTION = `<h2>Answering on the record after the bylines stopped (September 2026)</h2>
<p>The byline record above leaves a question open, and on 7 September 2026 the answer arrived in a place the blog does not reach. A thread had been running since the previous evening in the ${a('https://t.me/hyperscale_rs', 'hyperscale.rs')} developer channel about the ${a('/contents/tech/core-protocols/radix-wallet', 'Radix Wallet')}'s signing surface, opened by builders complaining that a single dApp session costs too many wallet confirmations. At ${a('https://t.me/hyperscale_rs/12100', '21:00 UTC on 6 September')} the ${a('/contents/tech/research/hyperscale-rs', 'hyperscale-rs')} lead put the obvious follow-up to a former protocol engineer: had the team ever landed on anything workable for a "session"-type solution? ${a('https://t.me/hyperscale_rs/12106', 'The reply')} was that the wallet team would know better, and asked the question that makes the feature hard &mdash; how would you keep it from carrying the same vulnerabilities as the ERC-20 approval pattern.</p>
<p>Hine's answer reached the channel at ${a('https://t.me/hyperscale_rs/12108', '05:22 UTC on 7 September')}. Some sort of "session mode" concept, he wrote, "remains on the backlog, but is honestly quite far down the list of priorities right now, given a variety of other big urgently-desired features" &mdash; and he set out the alternative he prefers, in the terms this wiki's ${a('/contents/tech/core-concepts/asset-oriented-programming', 'asset-oriented')} pages describe: most of what a session would do "can also be (maybe even better) addressed with another approach, where the user puts assets to be used for a 'session' into a sort of shared-access component where the app has the rights to use them, but the user can withdraw them at the end of the session." That is a session expressed as a resource the engine holds and the user can reclaim, rather than as a standing permission a wallet has to remember and a user has to revoke. The ${a('https://t.me/hyperscale_rs/12111', 'reply')} named its one cost: the time and effort of setting such a component up, per app.</p>
<p>Two things about this are worth recording as they are. The statement is the first public account of where a session feature sits in the wallet's priorities, and it comes from the product side rather than from an engineering channel's own speculation. And the attribution needs care: the message was <em>forwarded</em> into hyperscale.rs by the project's lead developer, so the account that posted it is not the account that wrote it &mdash; Telegram's forwarded-from header is what names Hine, and this page attributes it on that basis. What it settles is narrow but real: two years after the last individually bylined blog post, the Chief Product Officer is still answering roadmap questions in public, in his own words, about the product he has written about since 2019.</p>`;

const INFOBOX_ROW = `<tr><td>Last public statement</td><td>7 September 2026, on the ${a('https://t.me/hyperscale_rs/12108', 'Radix Wallet session-mode backlog')}</td></tr>`;

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
  const hay = JSON.stringify(blocks);
  if (hay.includes(SENTINEL)) { console.log('  already applied — no write'); process.exit(0); }

  // 1. infobox row, appended after the UK directorships row.
  const info = blocks[0];
  if (info.type !== 'infobox') throw new Error('block 0 is not the infobox');
  const inner = (info.blocks || [])[0];
  if (!inner || !inner.text.includes('UK directorships')) throw new Error('infobox anchor row not found');
  const before = inner.text;
  inner.text = inner.text.replace('</tbody></table>', `${INFOBOX_ROW}</tbody></table>`);
  if (inner.text === before) throw new Error('infobox splice did not apply');

  // 2. new section after "Publication record", before "External links".
  const at = blocks.findIndex((b) => (b.text || '').includes('<h2>External links</h2>'));
  if (at < 0) throw new Error('External links anchor not found');
  blocks.splice(at, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '1.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (section at ${at}, ${blocks.length} blocks)`);
  if (DRY) { console.log(inner.text.slice(-320)); process.exit(0); }

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
     'Close the open question left by the Publication record section: Hine answered a Radix Wallet session-mode question in the hyperscale.rs channel on 7 September 2026, two years after his last individual byline. Records the shared-access-component alternative he prefers, and that the message reached the channel as a forward, so the attribution rests on Telegram’s forwarded-from header.', now]);
  await client.query('COMMIT');
  console.log('  written');
} finally {
  client.release();
  await pool.end();
}
