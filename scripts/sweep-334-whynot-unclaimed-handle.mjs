import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 334, ecosystem rotation. The on-ledger socials census (72 resources cited across
// the 148 ecosystem pages, 12 of which publish a Telegram handle in their metadata)
// found exactly one handle that does not resolve: @WhyNotXRD, which Telegram reports
// as USERNAME_NOT_OCCUPIED. The token publishes it, the project's Linktree publishes
// it, and nobody holds it. This page said the published links still resolve.

const TAG_PATH = 'ecosystem';
const SLUG = 'whynot';
const SENTINEL = 'The Telegram handle in its metadata is unclaimed';
const DRY = process.argv.includes('--dry-run');

const NEW_SECTION = `<h2>The Telegram handle in its metadata is unclaimed (30 August 2026)</h2>
<p>The $WHY resource publishes its own social links on the ledger, and one of them leads nowhere. Read from the <a href="https://docs.radixdlt.com/docs/network-gateway" target="_blank" rel="noopener">Radix Gateway</a> at epoch&nbsp;339,535 on 30&nbsp;August&nbsp;2026, the resource carries <code>social_urls = ["https://x.com/WhyNotXRD", "https://t.me/WhyNotXRD", "https://whynotxrd.gitbook.io"]</code> and, separately, <code>telegram_profile_url = "https://t.me/WhyNotXRD"</code>. Telegram answers a lookup of that username with <code>USERNAME_NOT_OCCUPIED</code>: it is not a dormant channel, not a private one, and not a renamed one. Nobody holds it. The web page at that address is the generic contact shell Telegram serves for any unheld name, with no title, no member count and no description.</p>
<p>The project&rsquo;s own <a href="https://linktr.ee/WhyNotXRD" target="_blank" rel="noopener">Linktree</a> is still live and still lists the same handle, so a reader arriving from the ledger, from a wallet, from a token aggregator or from the project&rsquo;s published link page is sent to the same free username. That is the state described in this wiki&rsquo;s advisory on <a href="/contents/resources/recycled-telegram-handles" rel="noopener">recycled Telegram handles</a>, one step before it happens: the ten handles recorded there had already been re-registered by someone else, and this one is still waiting to be. Claiming it costs nothing and would make the claimant the project&rsquo;s Telegram presence everywhere the handle is cited.</p>
<p>The record is correctable, and unlike the supply it is not sealed. <code>metadata_setter</code> on the resource resolves to Owner, the owner rule requires the <strong>WhyNot Dev</strong> badge (<code>resource_rdx1nf8rqxpce&hellip;gun9e0emn4</code>, a non-fungible of supply&nbsp;1), and that badge, <code>#1#</code>, is unburned. It sits in <code>account_rdx128cc34gfxntn89gh9t2w7m8ul9e33aehtek6yg7627kzwlhylrq3u5</code>, where it has not moved since <strong>6&nbsp;April&nbsp;2025</strong>, the day before the token was created. The same account is the one the token names in <code>dapp_definitions</code>, and its last transaction of any kind was committed on <strong>13&nbsp;June&nbsp;2025</strong>. One metadata update from it would repoint or remove the link; the reason none has been made is the reason the page calls the project dormant.</p>`;

const EDITS = [
  // The Status section claimed every published link is live.
  ['its published links and DeFi integrations remain live, but there is no clear sign of ongoing team or community activity',
   'its DeFi integrations remain live and most of its published links resolve &ndash; though not the Telegram handle, on which see below &ndash; but there is no clear sign of ongoing team or community activity'],
  // The on-ledger section drew the dormant/closed line partly on the links resolving.
  ['the contracts still respond and the published links still resolve, but nobody is answering for them',
   'the contracts still respond and the website and link page still resolve, but nobody is answering for them &ndash; and one published link has decayed to a username nobody holds'],
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

  for (const [oldStr, newStr] of EDITS) {
    const hit = blocks.find((b) => b.text && b.text.includes(oldStr));
    if (!hit) throw new Error(`anchor missing: ${oldStr.slice(0, 60)}`);
    hit.text = hit.text.replace(oldStr, newStr);
  }

  // New section goes after the on-ledger status block, before External Links if present.
  const idx = blocks.findIndex((b) => b.text && b.text.includes('On-ledger status'));
  if (idx === -1) throw new Error('on-ledger status block not found');
  blocks.splice(idx + 1, 0, { id: uid(), type: 'content', text: NEW_SECTION });

  const version = '2.4.0';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  blocks ${page.content.length} -> ${blocks.length}`);
  console.log(`  bytes  ${JSON.stringify(page.content).length} -> ${JSON.stringify(blocks).length}`);
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
       'The Telegram handle $WHY publishes on-ledger is unclaimed: contacts.resolveUsername returns USERNAME_NOT_OCCUPIED for @WhyNotXRD, cited in both social_urls and telegram_profile_url at epoch 339,535 and repeated on the live Linktree. Records that the metadata is correctable (metadata_setter resolves to Owner; the WhyNot Dev badge #1# is unburned in the dApp definition account, unmoved since 6 Apr 2025) and corrects two sentences that said the published links still resolve.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
