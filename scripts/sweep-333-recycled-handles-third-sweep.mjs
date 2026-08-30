import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/resources';
const SLUG = 'recycled-telegram-handles';
const SENTINEL = 'An eleventh handle, published by the ledger';
const DRY = process.argv.includes('--dry-run');

const NEW_BLOCK_TEXT = `<h2>An eleventh handle, published by the ledger: 30 August 2026</h2>
<p>The sweep was re-run on <strong>30 August 2026</strong> across every Telegram handle cited on the 148 pages of the <a href="/ecosystem" rel="noopener">ecosystem directory</a> &ndash; 62 distinct handles, six more than the August sweep found, all of which resolved. One matched the signature, and it reaches the reader by a route none of the first ten used.</p>
<p><code>@DELIVER_XRD</code> is cited for <a href="/ecosystem/deliver" rel="noopener">DELIVER</a>, a meme token whose trading moved on and whose own website has gone. The channel now answering at that handle was created on <strong>1 June 2026 at 00:09:52&nbsp;UTC</strong> and posted the Collab.Land token gate four seconds later, at 00:09:56. It has four subscribers, one photo, no description and exactly two posts, the &ldquo;Channel created&rdquo; notice and the gate. The verify button leads to <code>@collabland_access_bot</code>, a fifth spelling of the imitation and the most plausible-looking yet: it is the real brand, an underscore, and a word Collab.Land does not use.</p>
<p>What is different is where the citation comes from. The first nine were reached through stale links on this wiki, the tenth through the project&rsquo;s own abandoned website; this one is published on the ledger. The DELIVER token&rsquo;s own metadata carries <code>social_urls = ["https://t.me/DELIVER_XRD", "https://x.com/DELIVER_XRD"]</code>, read at mainnet epoch 339,487 on 30 August 2026. The token was created on <strong>29 January 2025</strong>, sixteen months before the channel that now answers there, so the metadata is original and the channel behind it is not. This wiki cites the handle because the ledger does, and so will any wallet, explorer or token aggregator that renders a resource&rsquo;s socials.</p>
<p>That record is correctable, and not by this wiki. The token&rsquo;s supply is sealed &ndash; burner, minter, freezer and recaller, and every one of their updaters, are <code>DenyAll</code> &ndash; but its metadata is not: <code>metadata_setter</code> resolves to Owner, and the owner badge <code>{eb1f07d8&hellip;}</code> of <code>resource_rdx1ng362xkr&hellip;</code> is unburned and sits in <code>account_rdx128jcfayxelltc45l7u676pxxr8hhdx8wlkmme93fea47jeg4ep592w</code>, where it has not moved since <strong>20 December 2025</strong>. One metadata update from that account would repoint the record. Nothing prevents it except that nobody is watching.</p>
<p>The 20 August sweep did not miss this handle. It was not cited then: it entered this wiki at 22:11&nbsp;UTC on 20 August, hours after that day&rsquo;s sweep ran, in the revision that read the token&rsquo;s on-ledger facts and copied its socials across. A sweep covers the citations that exist while it runs, and a page that gains a citation afterwards inherits none of its assurance.</p>`;

const INFOBOX_EDITS = [
  ['<td>9, all cited on this wiki before 1 August 2026</td>',
   '<td>11, swept 1, 20 and 30 August 2026</td>'],
  ['<td><strong>Signature</strong></td><td>1 subscriber, no description, a single Collab.Land-branded token-gate post</td>',
   '<td><strong>Signature</strong></td><td>A near-empty channel, no description, a single Collab.Land-branded token-gate post</td>'],
  ['<tr><td><strong>Observed</strong></td><td>1 August 2026</td></tr>',
   '<tr><td><strong>Observed</strong></td><td>1, 20 and 30 August 2026</td></tr>'],
];

const BOT_LEAD_OLD = 'The three imitations found in this sweep each work by substituting a character that is hard to see in a sans-serif font:';
const BOT_LEAD_NEW = 'The imitations found across the three sweeps work by substituting or adding a character that is hard to see in a sans-serif font, or by simply reading as plausible:';
const BOT_TAIL_OLD = 'three times over.</li>';
const BOT_TAIL_NEW = `three times over.</li>
<li><code>@Collabslands_bot</code> &ndash; the brand pluralised, which reads as a typo rather than a substitution.</li>
<li><code>@collabland_access_bot</code> &ndash; the brand spelled correctly, with a suffix Collab.Land does not use.</li>`;

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

  // 1. Infobox: the count, the signature and the observation dates.
  const ib = blocks[0].blocks[0];
  for (const [oldStr, newStr] of INFOBOX_EDITS) {
    if (!ib.text.includes(oldStr)) throw new Error(`infobox anchor missing: ${oldStr.slice(0, 50)}`);
    ib.text = ib.text.replace(oldStr, newStr);
  }

  // 2. The bot-handle list gains the fourth and fifth spellings.
  const bots = blocks[4];
  if (!bots.text.includes(BOT_LEAD_OLD)) throw new Error('bot lead anchor missing');
  if (!bots.text.includes(BOT_TAIL_OLD)) throw new Error('bot tail anchor missing');
  bots.text = bots.text.replace(BOT_LEAD_OLD, BOT_LEAD_NEW).replace(BOT_TAIL_OLD, BOT_TAIL_NEW);

  // 3. The new section goes after "A tenth handle" (block 3), before the bot list.
  blocks.splice(4, 0, { id: uid(), type: 'content', text: NEW_BLOCK_TEXT });

  const version = '1.2.0';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  blocks ${page.content.length} -> ${blocks.length}`);
  console.log(`  infobox ${page.content[0].blocks[0].text.length} -> ${ib.text.length} B`);
  console.log(`  bot list ${page.content[4].text.length} -> ${bots.text.length} B`);
  if (!DRY) {
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Third sweep, 30 August 2026: 62 distinct Telegram handles cited across the 148 ecosystem pages, all resolved, one match. @DELIVER_XRD (created 1 Jun 2026 00:09:52 UTC, gate four seconds later, four subscribers) is the first case reached through on-ledger metadata rather than a stale link or a project website - the DELIVER token publishes it in social_urls, sixteen months after the token was created. Records that the metadata is unlocked and the owner badge is unburned, so the record is correctable, and that the 20 August sweep did not miss the handle because it was not cited until that evening.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
