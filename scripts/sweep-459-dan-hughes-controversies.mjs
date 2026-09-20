import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

// Run 459: Dan Hughes' Controversies section answered a charge it never stated.
// State the January 2014 Bitcointalk scam thread, Hughes' rebuttal to it, and the
// two accounts he has given of the BlackHatWorld episode; add the ~900 BTC theft
// and the refunds to Career, where the house sale currently reads as slow burn.
const TAG_PATH = 'contents/history';
const SLUG = 'dan-hughes';
const CAREER_BLOCK = '7a6220df-246e-402b-b53b-5024fd261f87';
const CONTROVERSY_BLOCK = '45d764ca-28dc-4daf-ae4c-feaa73a47a8f';
const SENTINEL = '1EMunieVKAs8PC8mXeBkXnnry79toEKust';

const EXT = 'target="_blank" rel="noopener noreferrer nofollow" class="link"';
const THREAD = 'https://web.archive.org/web/20180208035335/https://bitcointalk.org/index.php?topic=411366.0;all';
const NEWSBTC = 'https://www.newsbtc.com/sponsored/in-conversation-with-emunie-founder-dan-hughes/';
const FORBES = 'https://www.forbes.com/sites/parmyolson/2019/01/09/this-hermitic-engineer-is-plotting-the-death-of-blockchain/';
const ADDRESS = 'https://mempool.space/address/1EMunieVKAs8PC8mXeBkXnnry79toEKust';

// Career: the house sale follows the theft and the refunds, not six quiet years.
const CAREER_FROM = `The financial pressure eventually became so intense that&nbsp;<a ${EXT} href="${FORBES}">Hughes and his wife sold their four-bedroom house and downsized to a smaller, two-bedroom home</a>.</p>`;
const CAREER_TO = `</p><p>eMunie was robbed during those years. In a sponsored interview with newsBTC in October 2015, Hughes said a hacker had reached the fundraiser and his personal Bitcoin wallets, along with his email, exchange and forum accounts and the control panel for the project's servers, and that <a ${EXT} href="${NEWSBTC}">"in all over 900 BTC was taken in pledged and personal funds, at a time when BTC was at the top end of $600 in valuation"</a>. Supporters who had pledged money asked for it back; over the following couple of months, he said, <a ${EXT} href="${NEWSBTC}">"every single person who wanted out got their pledges back"</a>. <a ${EXT} href="${FORBES}">Hughes and his wife sold their four-bedroom house and downsized to a smaller, two-bedroom home</a>.</p>`;

const CONTROVERSIES = [
  '<h2>Controversies</h2>',

  '<h3>The eMunie scam allegation (2014)</h3>',

  `<p>On 11 January 2014 a Bitcointalk user posting as LeoC opened a thread headed <a ${EXT} href="${THREAD}">"[SCAM ALERT] eMunie – Caution Advised"</a>, relaying a case he said someone else had written. Bitcointalk was where <a rel="noopener" class="link" href="/contents/tech/research/emunie">eMunie</a>, the project that became Radix, ran its fundraiser and recruited its beta testers. The thread reached 292 posts and stopped on 12 June 2014.</p>`,

  `<p>It made five charges. The 600 BTC eMunie said it had raised was invented, because the project's own forum showed too few client downloads to account for that many investors. Hughes' employment history was fabricated, because nobody is a senior developer at 16. His membership of BlackHatWorld, an internet marketing forum, meant he made his living running scams. The eMunie forum proved nothing, because the software behind it sold for $5. And the repeated delays to eMunie's launch were cover while he waited for a Bitcoin ATM to open in London and launder the proceeds through it.</p>`,

  `<p>Hughes answered on 17 January, in a companion thread a supporter then quoted back into this one. To the first charge he gave the fundraiser's Bitcoin address, <a ${EXT} href="${ADDRESS}">1EMunieVKAs8PC8mXeBkXnnry79toEKust</a>, and accounted for the gap between what it had received and what it held: about 60 BTC returned to early investors who asked to cash out, and about 220 BTC moved to exchanges during December 2013's price fall so it could be sold if the fall continued. The address has since received 1,103 BTC in total and holds nothing. To the second he pointed at his credit on the 1999 game F.A. Premier League Stars, where he is listed as assistant lead rather than senior developer, and later posted a passport with the numbers blanked out. He did not answer the fourth charge or the fifth.</p>`,

  `<p>The third charge cites documents, and Hughes has given two accounts of it. In 2014 he described BlackHatWorld as somewhere he went to learn internet marketing after selling KDB Technology, said the post about making $1,500 in a day was his own and unremarkable on a forum where people post their marketing milestones, and described Adpulse, the advertising network the charge named, as his: fraudulent leads came in, advertisers refused to pay for them, and "if we don't get paid for your fraud leads, then you don't get paid for them either". He confirmed the PayPal ban the thread cited, saying PayPal had frozen more than £30,000 over one customer dispute and that he "decided not to wait to the 180 days" and fought it. In a Telegram message of 12 December 2023 the network belonged to someone else:</p>`,

  `<blockquote><p>“Way back in 2010ish I helped a friend start an ad network as I was in between previous company and crypto it was promoted on various forums and I ran point on some of them for him if you know anything about online advertising you'll know that fraudulent clicks are a daily thing and he was getting a lot of them A particularly big batch was from a user who had an account on blackhat. Payment was refused and he kicked up a shit storm on there,. And that's it, nothing more exciting than that.” - Dan Hughes, <a ${EXT} href="https://t.me/delphibets/145020">Telegram</a>, 12/12/2023</p></blockquote>`,

  `<p>No charges followed, and no eMunie investor is on record as having lost money to Hughes. Supporters of NXT, a competing project launched two months before the thread opened, posted in it throughout.</p>`,

  '<h3>Satoshi Nakamoto</h3>',

  `<p>A post on Radnode's blog argues that Hughes was Satoshi Nakamoto, the pseudonymous creator of Bitcoin, on the strength of his time zone, his interest in Nissan GTRs and a resemblance in writing style. It is a joke, and Hughes never claimed otherwise.</p>`,
].join('');

const DRY = process.argv.includes('--dry-run');
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
  const career = blocks.find((b) => b.id === CAREER_BLOCK);
  const controversies = blocks.find((b) => b.id === CONTROVERSY_BLOCK);
  if (!career) throw new Error('career block not found');
  if (!controversies) throw new Error('controversies block not found');

  if (career.text.includes(SENTINEL) || controversies.text.includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }
  if (!career.text.includes(CAREER_FROM)) throw new Error('career: house-sale sentence not found verbatim');
  career.text = career.text.replace(CAREER_FROM, CAREER_TO);
  controversies.text = CONTROVERSIES;

  const stray = JSON.stringify(blocks).match(new RegExp(String.fromCharCode(160), "g"));
  if (stray) throw new Error(`${stray.length} raw U+00A0 in the written blocks`);

  const version = '4.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`    career        ${career.text.length} chars (was ${page.content.find((b) => b.id === CAREER_BLOCK).text.length})`);
  console.log(`    controversies ${controversies.text.length} chars (was ${page.content.find((b) => b.id === CONTROVERSY_BLOCK).text.length})`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       "Controversies stated Hughes' 2023 answer to the BlackHatWorld charge without ever stating the charge. Set out the Bitcointalk thread of 11 January 2014 that made it (292 posts, read from the Wayback snapshot of 8 February 2018; the live URL is behind Cloudflare), his point-by-point rebuttal of 17 January, and the two accounts he has given of the advertising network: his own venture in 2014, a friend's in 2023. The fundraiser address he cited, 1EMunieVKAs8PC8mXeBkXnnry79toEKust, has received 1,103 BTC and holds nothing, read on mempool.space on 20 September 2026. Career gains the theft of over 900 BTC and the refunds Hughes described to newsBTC in October 2015, which is what the house sale followed. Satoshi theory demoted to a line.", now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
