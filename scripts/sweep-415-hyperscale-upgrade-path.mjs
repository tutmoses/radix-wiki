/**
 * Sweep 415 — /contents/tech/research/hyperscale-rs, from the signal sweep.
 *
 * The page's "What Becomes of Radix (11 September 2026)" subsection closes on the
 * reading that nothing technical has closed but that no plan for the network is
 * being held in reserve. Four hours later the channel put the technical half of
 * the question directly and got the first affirmative answer the project has given
 * about Radix specifically. This adds it as its own dated subsection.
 *
 * Source, read at 03:04 UTC on 12 September 2026 via the radix-studio Telegram
 * scraper and authorship-verified message by message through the public embeds
 * (t.me/<channel>/<id>?embed=1&mode=tme):
 *   12241 02:35:51Z  James Sinkem — is it a scaling solution that could be bolted
 *                    on to Radix via a network upgrade, or a standalone network?
 *   12242 02:47:30Z  flightofthefox — "it is free for anyone to use. free as in free"
 *   12243 02:56:58Z  James Sinkem — the question was clear, the answer was not
 *   12244 02:57:54Z  flightofthefox — "what part is not clear? i will do my best to clarify"
 *   12245 03:00:29Z  James Sinkem — restates: developed so Radix could integrate it?
 *   12246 03:03:35Z  flightofthefox — "of course, not any more than any other
 *                    network, but yes / 100% there is an upgrade path, and i would
 *                    sherpa that path"
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const BLOCK = 'a4aa44ce-271a-4b7d-b526-50180855a4a8';
const SENTINEL = 'upgrade-path-named';
const DRY = process.argv.includes('--dry-run');

const NB = '&' + 'nbsp;';
const LD = '&' + 'ldquo;';
const RD = '&' + 'rdquo;';
const LS = '&' + 'lsquo;';
const RS = '&' + 'rsquo;';
const MD = '&' + 'mdash;';

const TAIL =
  'What has closed is the reading that the author is holding a plan for the network in reserve. Any such plan has to come from whoever adopts the protocol, and on the record that is not him.</p>';

const ADDITION =
  '\n<h3 id="upgrade-path-named">The Upgrade Path, Named (12 September 2026)</h3>\n' +
  '<p>Four hours later the same channel put the technical half of that question, and got the first answer the project has given that names Radix and says yes. At 02:35' + NB + 'UTC a holder asked what open source means here beyond the licence, and framed the alternatives: <a href="https://t.me/hyperscale_rs/12241" target="_blank" rel="noopener">' + LD + 'is it being designed as a scaling solution that could conceivably be bolted on to Radix via a network upgrade? Or is it basically a standalone network?' + RD + '</a> The first reply restated the licence rather than the design ' + MD + ' <a href="https://t.me/hyperscale_rs/12242" target="_blank" rel="noopener">' + LD + 'it is free for anyone to use. free as in free' + RD + '</a> ' + MD + ' and was told it had not answered the question. He asked <a href="https://t.me/hyperscale_rs/12244" target="_blank" rel="noopener">' + LD + 'what part is not clear? i will do my best to clarify' + RD + '</a>, the question was put again in one line, and at 03:03' + NB + 'UTC he answered it: <a href="https://t.me/hyperscale_rs/12246" target="_blank" rel="noopener">' + LD + 'of course, not any more than any other network, but yes. 100% there is an upgrade path, and i would sherpa that path' + RD + '</a>. Every message in the exchange is authorship-verified at its own public embed.</p>\n' +
  '<p>Two things in that sentence are worth separating, because the subsection above turns on the difference. The <strong>upgrade path exists</strong>, and he says he would guide Radix along it: that is a commitment about the technology and about his own labour, and it is new on the record. The <strong>priority does not</strong>: ' + LS + 'not any more than any other network' + RS + ' places Radix among the candidates rather than at the head of them, which is the same position as 3 September stated from the other direction. Nothing here reverses the refusal of 11 September either. He still holds no view on what becomes of the people holding the token; what he has now said is that if the network chooses to adopt this protocol, the route is real and he would walk it with them.</p>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (/ /.test(TAIL + ADDITION)) throw new Error('script carries a raw U+00A0');
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG]
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const b = blocks.find((x) => x.id === BLOCK);
  if (!b) throw new Error('block not found');
  const hits = b.text.split(TAIL).length - 1;
  if (hits !== 1) throw new Error(`anchor matched ${hits} times, expected 1`);
  b.text = b.text.replace(TAIL, TAIL + ADDITION);

  const version = '6.27.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (+${ADDITION.length} chars)`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json,
      version,
      now,
      page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(),
        page.id,
        json,
        page.title,
        version,
        'minor',
        AUTHOR_ID,
        'New subsection: the upgrade path, named (12 September 2026). Asked at 02:35 UTC whether Hyperscale is designed so it could be bolted on to Radix via a network upgrade or is a standalone network, the lead developer answered at 03:03 UTC that "100% there is an upgrade path, and i would sherpa that path", qualified by "not any more than any other network". First affirmative answer the project has given that names Radix, and it separates cleanly from the 11 September refusal to hold a view on what becomes of XRD holders. Six messages, each authorship-verified at its public Telegram embed.',
        now,
      ]
    );
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
