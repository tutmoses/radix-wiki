// sweep-326-pokerxrd-season-zero-stopped.mjs
//
// /ecosystem/pokerxrd was the ecosystem staleness head (updated 28 Jul 2026,
// never verified) and carried a 🟢 Active chip on a page written entirely from
// the project's marketing copy: "the platform is currently operating on
// Stokenet ... while its mainnet launch is being prepared".
//
// Measured at source on 29 August 2026. pokerxrd.com answers (HTTP 200) and the
// dApp is intact, but its own tournament table is the finding: eight events,
// S0T3 through S0T10, all of Season 0, running 8 May 2025 to 29 June 2025, every
// one of them marked Finish. Nothing has been scheduled in the fourteen months
// since. The roadmap page still shows Stage 1 ("Stokenet Launch / First season
// Start!") as "Now" and Stage 2 ("Mainet Launch / ICO / DEX Listing / Token
// distribution") as "Next" - so the mainnet migration the page described as
// being prepared has not started, and the beta it described as operating has
// no scheduled play.
//
// Status chip 🟢 Active -> 🟠 Dormant. This does NOT settle the open question
// from run 324 about whether Dormant tracks the team or the demand (see /ecosystem/ice,
// live and used but barely). PokerXRD does not need that question answered: a
// tournament platform with an empty schedule is not running, whatever its
// operators intend.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'pokerxrd';
const SENTINEL = 'Season 0 and the stopped schedule';
const DRY = process.argv.includes('--dry-run');

const OVERVIEW_FIND = `The platform is currently operating on <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a>, Radix's persistent testnet, while its mainnet launch is being prepared.`;
const OVERVIEW_REPLACE = `The platform runs on <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a>, Radix's persistent testnet, and has never migrated to mainnet. Its published tournament schedule has been empty since June 2025 (see <a href="#season-zero" rel="noopener">Season 0 and the stopped schedule</a>).`;

const SECTION_HTML = `<h2 id="season-zero">${SENTINEL}</h2><p>The dApp publishes its own tournament history, and it is the clearest available reading of whether the room is running. Checked on 29 August 2026, the <a href="https://pokerxrd.com/tourney.php" target="_blank" rel="noopener">tournament page</a> lists eight events – S0T3 <em>Crazy Blinds</em>, S0T4 <em>Cheers to Prophet</em>, S0T5 <em>Newcomers</em>, S0T6 <em>WhyNot</em>, S0T7 <em>Hyper Fast</em>, S0T9 <em>Tokens</em> and S0T10 <em>Final</em> among them – all belonging to <strong>Season 0</strong>, all played between <strong>8 May and 29 June 2025</strong>, and all marked <em>Finish</em>. Nothing is scheduled after the Season 0 final, a gap of fourteen months at the time of writing.</p><p>The <a href="https://pokerxrd.com/roadmap.php" target="_blank" rel="noopener">roadmap</a> agrees. Stage 0 – site, token, socials and the game itself – is marked <em>Done in 2024</em>. Stage 1, "Stokenet Launch / First season Start!", is still marked <strong>Now</strong>. Stage 2, which is where mainnet launch, an ICO, a DEX listing and token distribution live, is still marked <em>Next</em>. The mainnet migration this page previously described as being prepared has therefore not begun, and the <strong>$poker</strong> 1:1 replication it promises to Season 0 players remains contingent on a mainnet launch with no date attached.</p><p>The site itself is not abandoned: pokerxrd.com and the dApp both answer, the badge-claim flow is live, and the <a href="https://t.me/pokerxrd" target="_blank" rel="noopener">Telegram group</a> (110 members when checked) still describes the project as being "on alpha release". On the evidence of its own schedule, though, the room is not running games, and this page records its status as <strong>Dormant</strong> rather than Active.</p>`;

const INFOBOX_FIND = '<tr><th>Status</th><td>Beta</td></tr>';
const INFOBOX_REPLACE = '<tr><th>Status</th><td>🟠 Dormant – Season 0 ran 8 May to 29 June 2025; no tournament scheduled since</td></tr>';

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
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const overview = blocks.find((b) => b.text?.includes(OVERVIEW_FIND));
  if (!overview) throw new Error('Overview find-string did not match');
  overview.text = overview.text.replace(OVERVIEW_FIND, OVERVIEW_REPLACE);

  const infobox = blocks.find((b) => b.type === 'infobox');
  const nested = infobox?.blocks?.find((n) => n.text?.includes(INFOBOX_FIND));
  if (!nested) throw new Error('infobox Status row not found');
  nested.text = nested.text.replace(INFOBOX_FIND, INFOBOX_REPLACE);

  // New section goes immediately before External Links.
  const extIdx = blocks.findIndex((b) => b.text?.startsWith('<h2>External Links</h2>'));
  if (extIdx < 0) throw new Error('External Links block not found');
  blocks.splice(extIdx, 0, { id: uid(), type: 'content', text: SECTION_HTML });

  const metadata = { ...(page.metadata || {}), status: '🟠 Dormant' };

  const version = '2.0.0';
  const before = JSON.stringify(page.content).length;
  const json = JSON.stringify(blocks);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${before} -> ${json.length} B  status ${page.metadata?.status} -> ${metadata.status}`);

  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, metadata=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [json, version, JSON.stringify(metadata), now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'major', AUTHOR_ID,
       'Status 🟢 Active -> 🟠 Dormant, on the project’s own published schedule rather than on a judgement about the team. pokerxrd.com/tourney.php lists eight Season 0 tournaments, S0T3 to S0T10, played 8 May to 29 June 2025 and all marked Finish, with nothing scheduled in the fourteen months since; pokerxrd.com/roadmap.php still marks Stage 1 (Stokenet launch, first season) as Now and Stage 2 (mainnet launch, ICO, DEX listing, token distribution) as Next, so the mainnet migration the page called "being prepared" has not begun and the $poker 1:1 replication it promises has no date. Site, dApp and Telegram group all still answer; the room is what stopped. New section "Season 0 and the stopped schedule"; the Overview claim that the platform "is currently operating" removed. Measured at source 29 Aug 2026.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
