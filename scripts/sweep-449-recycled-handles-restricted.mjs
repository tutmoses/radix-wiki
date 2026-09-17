// sweep-449-recycled-handles-restricted.mjs
//
// Run 449, contents/resources rotation. The backlog asked for the WhyNotXRD and
// DELIVER_XRD re-check to be done through MTProto rather than the t.me web
// preview, because the preview cannot tell an unregistered handle from a
// restricted or empty channel. All eleven recycled handles were resolved again
// on 17 September 2026 through contacts.ResolveUsername + channels.GetFullChannel
// + messages.GetHistory: four now carry a Telegram ToS restriction, seven are
// untouched, and the ledger records that cite them are unchanged at epoch 341,715.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/resources';
const SLUG = 'recycled-telegram-handles';
const SENTINEL = 'Telegram restricted four of the eleven';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2>Telegram restricted four of the eleven: 17 September 2026</h2>
<p>All eleven handles were resolved again on <strong>17 September 2026</strong>, this time through Telegram's own <a href="https://core.telegram.org/methods" target="_blank" rel="noopener">MTProto API</a> rather than the <code>t.me</code> web preview. The preview cannot separate an unregistered handle from a channel that is empty or withdrawn, and the distinction is the whole reading. Four of the eleven now carry a restriction: <code>@DELIVER_XRD</code>, <code>@FotonMarketplace</code>, <code>@Radixnode</code> and <code>@juicystake</code> each return a restriction with platform <code>all</code> and reason <code>terms</code>, reading "This channel can't be displayed because it violated Telegram's Terms of Service." Each reports no subscribers, no photo, no description and no messages, and its title has been reduced to its own username.</p>
<p>The other seven are untouched and answer exactly as recorded above. <code>@RadLandNFT</code>, <code>@phoenix_xrd</code>, <code>@backeum_news</code>, <code>@hardmoneyproject</code>, <code>@stabilislabs</code>, <code>@Impahla</code> and <code>@fibonaccifi</code> each hold one subscriber and two posts, the "Channel created" notice and the gate, with a "Tap to Verify" button beneath it. The six survivors of the 29 June batch all send that button to <code>t.me/CollabLandlBot</code>; <code>@fibonaccifi</code> sends it to <code>t.me/collab_land_accessbot</code>.</p>
<p>The bots behind the buttons have moved further than the channels. <code>@CollabLandlBot</code> is still a live bot and still presents the display name <strong>Collab.Land</strong>, the same name the genuine <a href="https://t.me/collablandbot" target="_blank" rel="noopener">@collablandbot</a> presents; in the API the two differ by account id and by how often each has updated its bot description, twelve times for the real one and once for the imitation. <code>@collab_land_accessbot</code>, the handle <code>@fibonaccifi</code>'s button still leads to, is not a bot at all: it is a broadcast channel created on 24 May 2026 and titled as an airdrop promotion for a different handle. <code>@Collabslands_bot</code> resolves to a deleted account that Telegram marks as fake. The two remaining spellings, <code>@coIIab_Iands_bot</code> and <code>@collabland_access_bot</code>, resolve to nothing.</p>
<p>The ledger records that point at two of these handles are unchanged. Read at mainnet epoch <strong>341,715</strong> on 17 September, the DELIVER token still publishes <code>https://t.me/DELIVER_XRD</code> in <code>social_urls</code>, so a wallet, explorer or aggregator that renders its socials now links a channel Telegram has withdrawn; and <a href="/ecosystem/whynot" rel="noopener">WhyNot</a>'s $WHY still publishes <code>https://t.me/WhyNotXRD</code> in both <code>social_urls</code> and <code>telegram_profile_url</code>, where Telegram still answers <code>USERNAME_NOT_OCCUPIED</code>. That slot has now been empty for eighteen days with the citation live in front of it.</p>
<p>A restriction is not a deletion. The four channels keep their usernames, so every citation that reaches them still resolves, and a reader who follows the DELIVER token's own metadata link arrives at Telegram's notice rather than at the gate. Two things are worth re-reading on the next pass: whether the restriction holds, and whether <code>@WhyNotXRD</code> is still free.</p>`;

const INFOBOX_EDITS = [
  ['<tr><td><strong>Handles observed</strong></td><td>11, swept 1, 20 and 30 August 2026</td></tr>',
   '<tr><td><strong>Handles observed</strong></td><td>11, swept 1, 20 and 30 August and 17 September 2026</td></tr>'],
  ['<tr><td><strong>Observed</strong></td><td>1, 20 and 30 August 2026</td></tr>',
   '<tr><td><strong>Restricted by Telegram</strong></td><td>4 of 11, read 17 September 2026</td></tr>\n<tr><td><strong>Observed</strong></td><td>1, 20 and 30 August and 17 September 2026</td></tr>'],
];

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

  // Infobox rows.
  const info = blocks[0];
  if (info.type !== 'infobox') throw new Error('block 0 is not the infobox');
  const table = info.blocks[0];
  for (const [from, to] of INFOBOX_EDITS) {
    if (!table.text.includes(from)) throw new Error(`infobox row not found: ${from.slice(0, 60)}`);
    table.text = table.text.replace(from, to);
  }

  // New dated section, after the on-ledger sweep and before the bot-spotting section.
  const at = blocks.findIndex((b) => b.text?.includes('The handles the ledger publishes'));
  if (at === -1) throw new Error('anchor block not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '1.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  blocks ${page.content.length} -> ${blocks.length}, section inserted at index ${at + 1}`);
  console.log(`  em dashes in new text: ${(SECTION.match(/\u2014/g) || []).length}, nbsp: ${(SECTION.match(/\u00a0/g) || []).length}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'All eleven recycled handles re-resolved on 17 September 2026 through MTProto rather than the t.me preview. Telegram has restricted four of them (DELIVER_XRD, FotonMarketplace, Radixnode, juicystake) for violating its Terms of Service; the other seven still serve the Collab.Land gate unchanged. Of the five imitation bot handles, one is still a live bot under the name Collab.Land, one is now a broadcast channel, one is a deleted account Telegram marks fake and two resolve to nothing. DELIVER and WHY still publish their handles on-ledger at epoch 341,715, and WhyNotXRD is still unregistered.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
