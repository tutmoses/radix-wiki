/**
 * Run 331 (ecosystem rotation, staleness head).
 *
 * /ecosystem/crumbsup had never been verified and carried 🟢 Active on a page
 * written almost entirely from the project's own prospectus - what the
 * platform aims to do, in the future tense, with nothing about what it has
 * done. CrumbsUp is a DAO platform, and a DAO platform keeps its record on
 * the ledger, so this run read it.
 *
 * The four registries the platform mints into were taken out of its own
 * JavaScript bundle (crumbsup.io/build/p-ad14282d.js) and read at the Gateway
 * on 30 August 2026, epoch 339,390: 21 DAOs, 22 admin badges, 11 proposals and
 * 19 votes. The last proposal and the last vote are both 14 January 2026, and
 * the platform component's last transaction of any kind is 3 April 2026.
 * $CRUMB has traded nothing in seven days. The site itself is up and serving.
 *
 * Status chipped 🟢 Active -> 🟠 Dormant on the platform's own record, the
 * same narrow ground run 326 used for pokerxrd: the product is not running,
 * which needs no ruling on the team. Stated with its limits - the supplies are
 * current holdings rather than lifetime mints, and a DAO that formed here
 * could have moved its governance somewhere this measurement cannot see.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'crumbsup';
const SENTINEL = 'eleven proposals and nineteen votes';
const DRY = process.argv.includes('--dry-run');

const replacements = [
  [`</tr>\n<tr>\n<th>Blockchain</th>\n<td>Radix</td>\n</tr>`,
   `</tr>\n<tr>\n<th>Blockchain</th>\n<td>Radix</td>\n</tr>\n<tr>\n<th>Status</th>\n<td>🟠 Dormant &ndash; site live, platform idle on-ledger since April 2026</td>\n</tr>\n<tr>\n<th>On-ledger record</th>\n<td>21 DAOs, 11 proposals, 19 votes (30 August 2026)</td>\n</tr>`],
];

const ONLEDGER_SECTION = `<h2>On-ledger record</h2>
<p>The sections above describe what CrumbsUp set out to build. What it has recorded is separately verifiable, because a DAO platform mints its objects on the ledger, and CrumbsUp mints four kinds of them. The resource addresses below were taken from the platform's own front-end bundle and read at the <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway</a> on <strong>30 August 2026, epoch 339,390</strong>.</p>
<table>
<tr><th>Registry</th><th>Current supply</th><th>Most recent transaction</th></tr>
<tr><td><a href="https://dashboard.radixdlt.com/resource/resource_rdx1nfrc5swndv3dhntzzc2zfzpttmx57y9sfk3ajmldqpey5trvwm8p8z" target="_blank" rel="noopener">CrumbsUp DAOs</a></td><td>21</td><td>3 April 2026</td></tr>
<tr><td><a href="https://dashboard.radixdlt.com/resource/resource_rdx1n2dp5tgpqvtdu3keznue70fh8wcgmn40t5tz3er84cwm5fum38jrt3" target="_blank" rel="noopener">CrumbsUp DAO Admin Badges</a></td><td>22</td><td>&ndash;</td></tr>
<tr><td><a href="https://dashboard.radixdlt.com/resource/resource_rdx1n2drsjp9fagqhn90jz2lwfy72wa00ka77a8fufk06udltqcykxtz0r" target="_blank" rel="noopener">CrumbsUp Proposals</a></td><td>11</td><td>14 January 2026</td></tr>
<tr><td><a href="https://dashboard.radixdlt.com/resource/resource_rdx1ntra9m8nevh0njvaqfrkvy6erzdwclzqjnnjzvvc3swvufv6y27lwy" target="_blank" rel="noopener">CrumbsUp Votes</a></td><td>19</td><td>14 January 2026</td></tr>
</table>
<p>Twenty-one DAOs have been created on the platform and, between them, they have produced <strong>eleven proposals and nineteen votes</strong> in the platform's lifetime. Nothing has been proposed or voted on since 14 January 2026. The platform component itself, <code>component_rdx1cpupsxrv4y36n46d0d9elev9qwjw8p4up58h6ll6yff5p8sh20qckm</code>, last appeared in a committed transaction on 3 April 2026, which is also when the most recent DAO was minted; the team's operating account last moved on 5 May 2026. The <a href="https://dashboard.radixdlt.com/account/account_rdx168s540r23fg9yl64rhtqn668k52arur7wpxe6ysx9gy5urvkj9geak" target="_blank" rel="noopener">dApp definition account</a> still claims <code>crumbsup.io</code> and the site still serves, so the deployment is intact rather than abandoned.</p>
<p>The token side agrees. On <a href="https://ociswap.com/resource_rdx1t5xg95m0mhnat0wv59ed4tzmevd7unaezzm04f337djkp8wghz2z7e" target="_blank" rel="noopener">Ociswap</a>, read the same day, $CRUMB shows zero volume over one hour, twenty-four hours and seven days, an unchanged price across all three windows, roughly 85 USD of liquidity and a circulating market capitalisation near 133 USD, against about 19,400 USD of lifetime volume.</p>
<p>On that record this directory lists CrumbsUp as <strong>🟠 Dormant</strong> rather than Active. The judgement is about the product's own record and not about the team, which continues to run <a href="/ecosystem/crumbsnode" rel="noopener">CrumbsNode</a>. Two limits are worth stating: the supplies above are what the registries hold now rather than everything ever minted, so a burned proposal would not be counted; and a DAO that was created here could have moved its day-to-day governance to a channel this measurement cannot see. What the ledger does establish is that the platform's own governance objects stopped being created seven months ago.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const hits = new Set();
  const apply = (text) => {
    let out = text;
    for (const [from, to] of replacements) {
      if (out.includes(from)) { out = out.split(from).join(to); hits.add(from.slice(0, 40)); }
    }
    return out;
  };
  for (const b of blocks) {
    if (typeof b.text === 'string') b.text = apply(b.text);
    for (const n of b.blocks || []) if (typeof n.text === 'string') n.text = apply(n.text);
  }
  const missed = replacements.filter(([from]) => !hits.has(from.slice(0, 40)));
  if (missed.length) {
    for (const [from] of missed) console.error('   MISS:', JSON.stringify(from.slice(0, 110)));
    throw new Error('aborting rather than writing a partial edit');
  }

  // Split the trailing block so the new section sits above External Links.
  const tailIdx = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes('<h2>External Links</h2>'));
  if (tailIdx < 0) throw new Error('External Links block not found');
  const tail = blocks[tailIdx].text;
  const cut = tail.indexOf('<h2>External Links</h2>');
  blocks[tailIdx].text = tail.slice(0, cut);
  blocks.splice(tailIdx + 1, 0, { id: uid(), type: 'content', text: ONLEDGER_SECTION });
  blocks.splice(tailIdx + 2, 0, { id: uid(), type: 'content', text: tail.slice(cut) });

  const metadata = { ...(page.metadata || {}), status: '🟠 Dormant' };
  const version = '3.0.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${JSON.stringify(page.content).length} -> ${JSON.stringify(blocks).length} B  status ${page.metadata?.status} -> ${metadata.status}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, metadata=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [json, version, JSON.stringify(metadata), now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'major', AUTHOR_ID,
       'First verification of this page, and it changes the status. Read at the Gateway on 30 Aug 2026 (epoch 339,390) against the four registry resources taken from the platform’s own front-end bundle: 21 DAOs, 22 admin badges, 11 proposals, 19 votes, with the last proposal and the last vote both 14 Jan 2026 and the platform component’s last committed transaction 3 Apr 2026. $CRUMB shows zero 1h/24h/7d volume on Ociswap the same day. Site and dApp definition are intact. Status chipped 🟢 Active -> 🟠 Dormant on the product’s own on-ledger record, not on a judgement about the team, with the measurement’s two limits stated on the page.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
