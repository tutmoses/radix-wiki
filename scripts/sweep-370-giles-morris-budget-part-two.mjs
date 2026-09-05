/**
 * Run 370 (community rotation) — /community/gilesmorris-me stops one post short.
 *
 * The page was last edited on 15 August 2026 and covers the July 2026 network budget model as if
 * it were the end of the series. A second part went up on 25 August, read in full at
 * https://gilesmorris.me/my-blog/radix-midao-budgeting-part-2/ on 5 September 2026, and it drops
 * the assumption part one rested on: instead of large holders donating staking rewards to the DAO,
 * it asks whether the Foundation's 2 billion XRD reserve can carry the network on its own. That
 * matters more now than it did in August, with mainnet halted and no funded development in view.
 *
 * All figures below are the post's own, quoted as his rather than asserted by this wiki.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'community';
const SLUG = 'gilesmorris-me';
const SENTINEL = 'radix-midao-budgeting-part-2';

const OLD_CLOSER = "<p>The two posts are the same question asked at two scales, fifteen months apart: in 2025 whether Radix can carry a business's books, and in 2026 whether <a rel=\"noopener\" class=\"link\" href=\"/contents/tech/core-concepts/network-emissions\">emissions</a> can carry the network's own.</p>";

const NEW_TAIL =
  '<h3>Part two: the two billion XRD reserve</h3>'
  + '<p>A <a target="_blank" rel="noopener" href="https://gilesmorris.me/my-blog/radix-midao-budgeting-part-2/">second part</a>, published on 25 August 2026, drops the assumption the first one rested on. Taking the ecosystem as a whole, he writes, does not account for &ldquo;selfish stakeholders&rdquo; and assumes some large holders would be willing to donate their rewards to the DAO. So part two asks a narrower question with no goodwill in it: can the network pay for itself out of the staking rewards on the 2 billion XRD reserve the <a rel="noopener" class="link" href="/ecosystem/radix-foundation">Foundation</a> held, money originally set aside as a stablecoin reserve and which he takes to be largely intact.</p>'
  + '<p>His answer is that it can, on what he calls a shoestring budget. Staking rewards on 2 billion XRD come to about <strong>$9,000 a month</strong> at the price he uses, roughly $0.00093 per XRD, and covering costs at that level takes four things at once: mainnet <a rel="noopener" class="link" href="/contents/tech/core-concepts/validator-nodes">validators</a> cut to twenty, the test network kept running, market-maker spending severely curtailed, and no funded development and no paid staff. The revised model is again published rather than summarised, as a <a target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/u/0/d/1ASb1d50fCqK5hIhukmKpuckGVgICATV_/htmlview">Google Sheet</a> and a <a target="_blank" rel="noopener" href="https://gilesmorris.me/wp-content/uploads/2026/08/radix-bare.xlsx">downloadable spreadsheet</a>, so the assumptions can be changed and the forecast re-run.</p>'
  + '<p>Read together, the two parts answer different questions and it is worth keeping them apart. Part one asks whether <a rel="noopener" class="link" href="/contents/tech/core-concepts/network-emissions">emissions</a> can fund the network as it is, and answers probably yes. Part two asks what is left when nothing is donated, and answers that the network survives without the people currently building it.</p>'
  + "<p>The posts are the same question asked at widening scales: in 2025 whether Radix could carry a business's books, in July 2026 whether emissions could carry the network's own, and in August what the floor is if no one contributes anything at all.</p>";

const NEW_LINK =
  '<li><a target="_blank" rel="noopener" href="https://gilesmorris.me/my-blog/radix-midao-budgeting-part-2/">Radix MIDAO budgeting &ndash; part 2, on the 2 billion XRD reserve (August 2026)</a></li>';

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  for (const [name, s] of [['NEW_TAIL', NEW_TAIL], ['NEW_LINK', NEW_LINK]]) {
    if (/ /.test(s)) throw new Error(`${name} contains U+00A0`);
    if (/—/.test(s)) throw new Error(`${name} contains an em dash`);
  }

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const econ = blocks.find((b) => b.text?.includes(OLD_CLOSER));
  if (!econ) throw new Error('economics-model closing paragraph not found');
  econ.text = econ.text.replace(OLD_CLOSER, NEW_TAIL);

  const links = blocks.find((b) => b.text?.includes('<h2>External links</h2>'));
  if (!links) throw new Error('External links block not found');
  const cut = links.text.lastIndexOf('</ul>');
  if (cut < 0) throw new Error('no </ul> in External links block');
  links.text = links.text.slice(0, cut) + NEW_LINK + links.text.slice(cut);

  const version = '1.5.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  economics block ${page.content.find((b) => b.text?.includes(OLD_CLOSER)).text.length} -> ${econ.text.length} chars; external links +1`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       "Adds part two of the Radix MIDAO budget model, published 25 August 2026 and read in full on 5 September. It drops part one's assumption that large holders donate their staking rewards and asks instead whether the Foundation's 2 billion XRD reserve alone can carry the network: his answer is yes, at about $9,000 a month, with validators cut to twenty and no funded development or paid staff. Figures are his, attributed.",
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
