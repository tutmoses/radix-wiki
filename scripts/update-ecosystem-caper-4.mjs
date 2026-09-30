/**
 * update-ecosystem-caper-4 (caper sweep #490, foundations rotation). /ecosystem/caper
 * read against caper's foundations/markets/governance pages and source at caper
 * HEAD 5743b94 (contracts unchanged since 25 September) on 30 September 2026.
 *
 * Three passages described things Caper does not do:
 * 1. "deterministic pricing with zero slippage". Caper's own markets/bonding-curve
 *    page calls "zero slippage" imprecise: a buy pays the area under the curve
 *    between the old and new supply, so a large order pays a higher average
 *    price. What is deterministic is the impact.
 * 2. "token-gated forum access where the minimum token requirement ... can be
 *    determined through community governance". The forum is the Trollbox, and
 *    caper src/domains/trollbox/gates.ts holdsStake() lets anyone holding ANY
 *    amount of the caper's token, vote token or founder badge post. No minimum,
 *    no governance setting. Flags are weighted by vote weight (governance/voting).
 * 3. "legislative signaling to executive proposal implementation" and "mandatory
 *    execution delays following executive votes". update-ecosystem-caper-3 already
 *    removed the same model from the Governance System section; this is the
 *    lifecycle section's copy of it.
 *
 * VOICE.md §4 Caper overlay: outcome level, no fee amounts or shares in prose.
 *
 * Idempotent: skipped if the sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'caper';
const SENTINEL = 'Every caper also gets a Trollbox';
const VERSION = '2.7.0';

const EDITS = [
  ["This mechanism provides several key advantages over traditional liquidity pools: permissionless operation, deterministic pricing with zero slippage, and guaranteed liquidity at any price point.</p>",
   "This mechanism provides several advantages over traditional liquidity pools: permissionless operation, deterministic pricing, and liquidity at every point on the curve. It is not free of price impact. A purchase pays the area under the curve between the old supply and the new, so a large order pays a higher average price than a small one, and <a href=\"https://caper.network/wiki/markets/bonding-curve\" target=\"_blank\" rel=\"noopener\">Caper&#39;s own page on the curve</a> calls the common &quot;zero slippage&quot; description imprecise for that reason. What the curve fixes is the size of the impact: it depends only on the trade and the curve, and can be known before the trade is signed.</p>"],
  ["<p>New capers automatically integrate with the platform&#39;s social infrastructure, including token-gated forum access where the minimum token requirement for participation can be determined through community governance. This creates natural barriers to entry that filter participants based on economic commitment while allowing communities to adjust accessibility based on their specific needs and development stage.</p>",
   "<p>Every caper also gets a Trollbox, a chat room on its profile with a separate room under each of its proposals. Holding any amount of the caper&#39;s token, its vote token or its founder badge is enough to post; there is no minimum and no governance setting for one. The founder moderates, and since September 2026 members can collapse a line by flagging it, each flag weighted by the same vote weight that decides a ballot, so a holder who has never voted can post but cannot flag. <a href=\"https://caper.network/wiki/governance/voting\" target=\"_blank\" rel=\"noopener\">Caper describes the room and how its flags are counted</a>.</p>"],
  ["<p>The transition from legislative signaling to executive proposal implementation marks important developmental milestones, indicating community readiness to undertake binding financial and operational commitments. The mandatory execution delays following executive votes provide ongoing protection for member interests while enabling decisive collective action.</p>",
   "<p>Every action a treasury takes, from a payment to an investment, goes through the same ranked ballot and market window described above. There is no separate class of binding proposal to graduate to, and no delay set aside for dissenters, because a member who disagrees can <a href=\"https://caper.network/wiki/foundations/leaving-a-caper\" target=\"_blank\" rel=\"noopener\">exit at any time</a> rather than inside a window. Each ballot a member casts mints a stake token, so the members who vote most carry more weight in later ballots and a larger claim on the treasury when they leave.</p>"],
];

const MESSAGE =
  "Three passages read against caper at HEAD 5743b94 (contracts unchanged since 25 Sep) on 30 Sep 2026. (1) 'deterministic pricing with zero slippage': caper's markets/bonding-curve page calls zero slippage imprecise, a buy pays the area under the curve, so the impact is deterministic but not zero. (2) 'token-gated forum access where the minimum token requirement can be determined through community governance': the room is the Trollbox and src/domains/trollbox/gates.ts holdsStake() admits any holder of the token, vote token or founder badge, no minimum and no governance setting; flags are vote-weighted (caper governance/voting). (3) The lifecycle section's 'legislative signaling to executive proposal' and 'mandatory execution delays' repeated the model update-ecosystem-caper-3 removed from the governance section; rewritten to one ballot plus market window, exit at any time. Filed by caper sweep #490 (foundations rotation).";

const replaceOnce = (haystack, needle, replacement) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`string is not unique: ${JSON.stringify(needle.slice(0, 70))}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) {
    console.log('  already applied - no write');
    return;
  }
  const blocks = JSON.parse(JSON.stringify(page.content));
  for (const [from, to] of EDITS) {
    const target = blocks.find((b) => (b.text || '').includes(from));
    if (!target) throw new Error(`no block holds ${JSON.stringify(from.slice(0, 60))}`);
    target.text = replaceOnce(target.text, from, to);
  }
  assertLinkShapes(blocks, page.title);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (${EDITS.length} edits)`);
  if (DRY) return;
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
    [json, VERSION, now, page.id],
  );
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now],
  );
  await client.query('COMMIT');
});
