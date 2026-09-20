/**
 * sweep 460 - blog rotation.
 *
 * Two edits, both from the blog link audit and the standing blog backlog item:
 *
 * 1. /blog/week-in-review-mar-9-15-2026 - the only broken internal link in the
 *    whole blog category. The Sources block cites
 *    "/contents/history/radix-rewards-s1-distribution", a page that does not
 *    exist and never did at that path: the wiki's Radix Rewards page lived at
 *    /ideas/radix-rewards-s1-distribution and went when the ideas board was
 *    rebuilt as the 28 dao-* cards. Repointed to the Radix Foundation's own
 *    post, which carries the figure the essay quotes (114,347,194.845748 XRD,
 *    vesting live 3 February 2026 ~16:00 UTC, 20% immediate and 80% linear over
 *    seven days, unvested share of early exits redistributed).
 *
 * 2. /blog/radix-is-what-web3-noobs-think-they-bought - two sourcing fixes the
 *    backlog has carried since run 435.
 *    a) "over $8bn worth of security breaches since September 2020" carried no
 *       link, though the chart under it names rekt.news/leaderboard as its
 *       source. Hyperlinked to the leaderboard (read 20 Sep 2026, 321 incidents).
 *    b) "The world's stock exchanges collectively host around 2-3m TPS" has no
 *       source and none exists - no exchange or regulator publishes a combined
 *       throughput figure for the world's equity markets. Rather than decorate
 *       it with an adjacent number, the infobox gains an "Unsourced figure" row
 *       saying so and giving the nearest published anchor: Nasdaq's own 2019
 *       piece rating the UTP securities information processor at ~5.6m messages
 *       a second. The prose is left alone - moving a figure into that paragraph
 *       would break the "this could reach 20-30m" demonstrative that follows.
 *
 * Run once. Idempotent: each page has a sentinel and is skipped if present.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');

const NASDAQ_URL =
  'https://www.nasdaq.com/articles/time-relative:-where-trade-speed-matters-and-where-it-doesnt-2019-05-30';
const REKT_URL = 'https://rekt.news/leaderboard';
const REWARDS_URL = 'https://www.radixdlt.com/blog/radix-rewards-s1-distribution';

const DEAD_REF = '/contents/history/radix-rewards-s1-distribution';

const INFOBOX_ROW =
  '<tr><th>Unsourced figure</th><td>The 2-3m TPS attributed to the world&rsquo;s stock exchanges is the essay&rsquo;s own estimate; no exchange or regulator publishes a combined throughput figure for the world&rsquo;s equity markets. The nearest published one covers a single consolidated feed: Nasdaq <a href="' +
  NASDAQ_URL +
  '" target="_blank" rel="noopener">rated the UTP securities information processor at around 5.6 million messages a second in 2019</a>, counting quote updates as well as trades in Nasdaq-listed stocks.</td></tr>';

const BREACH_PLAIN =
  'and together account for over $8bn worth of security breaches since September 2020.';
const BREACH_LINKED =
  'and together account for <a target="_blank" rel="noopener noreferrer nofollow" class="link" href="' +
  REKT_URL +
  '">over $8bn worth of security breaches since September 2020</a>.';

const replaceOnce = (haystack, needle, replacement, where) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`${where}: string not found: ${JSON.stringify(needle.slice(0, 60))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`${where}: string is not unique`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

const readPage = async (client, tagPath, slug) => {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [tagPath, slug],
  );
  if (!rows.length) throw new Error(`${tagPath}/${slug} not found`);
  return rows[0];
};

const writePage = async (client, page, blocks, version, changeType, message) => {
  assertLinkShapes(blocks, page.title);
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content = $1, version = $2, updated_at = $3 WHERE id = $4', [
    json,
    version,
    now,
    page.id,
  ]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, changeType, AUTHOR_ID, message, now],
  );
  await client.query('COMMIT');
};

await withClient(async (client) => {
  // ---- 1. the March week-in-review's dead internal source -------------------
  {
    const page = await readPage(client, 'blog', 'week-in-review-mar-9-15-2026');
    const blocks = JSON.parse(JSON.stringify(page.content));
    const refs = blocks.find((b) => b.type === 'references');
    if (!refs) throw new Error('mar-9-15: no references block');
    const item = (refs.items || []).find((r) => r.url === DEAD_REF);
    if (!item) {
      console.log('  mar-9-15: dead reference already repointed - no write');
    } else {
      item.url = REWARDS_URL;
      item.text = 'Radix Foundation, the Radix Rewards Season 1 distribution';
      const version = '3.0.2';
      console.log(
        `  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}` +
          `\n        ${DEAD_REF}\n     -> ${REWARDS_URL}`,
      );
      if (!DRY)
        await writePage(
          client,
          page,
          blocks,
          version,
          'patch',
          'Sources: the Radix Rewards Season 1 entry pointed at /contents/history/radix-rewards-s1-distribution, ' +
            'a page that does not exist (the wiki page lived at /ideas/radix-rewards-s1-distribution and went with the ' +
            'ideas-board rebuild). Repointed to the Radix Foundation post that carries the 114,347,194.845748 XRD total ' +
            'and the vesting terms the essay quotes.',
        );
    }
  }

  // ---- 2. the noobs essay's two unsourced figures ---------------------------
  {
    const page = await readPage(client, 'blog', 'radix-is-what-web3-noobs-think-they-bought');
    const blocks = JSON.parse(JSON.stringify(page.content));
    const whole = JSON.stringify(blocks);
    // Sentinels must be the markup this edit introduces, not the words. The page
    // already SAYS "Source: rekt.news/leaderboard" in the chart caption, so a
    // bare-text sentinel matches before the edit has been applied.
    if (whole.includes('<th>Unsourced figure</th>') || whole.includes(`href=\\"${REKT_URL}\\"`)) {
      console.log('  noobs essay: already sourced - no write');
    } else {
      const info = blocks.find((b) => b.type === 'infobox');
      if (!info) throw new Error('noobs: no infobox block');
      const table = (info.blocks || [])[0];
      if (!table || !table.text) throw new Error('noobs: infobox has no content block');
      table.text = replaceOnce(table.text, '</tbody></table>', INFOBOX_ROW + '</tbody></table>', 'noobs infobox');

      const body = blocks.find((b) => b.type === 'content' && b.text && b.text.includes(BREACH_PLAIN));
      if (!body) throw new Error('noobs: breach sentence not found');
      body.text = replaceOnce(body.text, BREACH_PLAIN, BREACH_LINKED, 'noobs body');

      const version = '2.6.0';
      console.log(
        `  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}` +
          '\n        + infobox row: the 2-3m TPS figure is the essay’s own estimate (Nasdaq UTP SIP anchor)' +
          `\n        + citation on the $8bn breach total -> ${REKT_URL}`,
      );
      if (!DRY)
        await writePage(
          client,
          page,
          blocks,
          version,
          'minor',
          'Sourcing: the "$8bn worth of security breaches since September 2020" total now links to rekt.news/leaderboard, ' +
            'which the chart beneath it already named as its source. The "2-3m TPS" attributed to the world’s stock ' +
            'exchanges has no source and none exists, so the infobox now says it is the essay’s own estimate and gives ' +
            'the nearest published anchor: Nasdaq rating the UTP securities information processor at ~5.6m messages a second in 2019.',
        );
    }
  }
});
