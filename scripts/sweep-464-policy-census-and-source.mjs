/**
 * sweep 464 - policy rotation. The freshness citation the repository deleted,
 * and the September census on both pages that publish it.
 *
 * The link audit of /policy (8 pages, 39 external, 0 embeds) returned three
 * flags. Two are banked classes and neither is dead: defillama.com/protocol/
 * surge-trade is a Cloudflare 403 to a script, and leafnode.info is the
 * standing Vercel DEPLOYMENT_PAUSED 503 that /policy/verifiability uses as its
 * worked example. The third is a genuine 404, and it is this wiki citing
 * itself:
 *
 *   https://github.com/tutmoses/radix-wiki/blob/main/src/lib/freshness.ts -> 404
 *
 * The repository is public and answers 200; the file is gone. Commit 599ffa8,
 * "Take the freshness banner from wiki-formant and delete src/lib/freshness.ts",
 * landed at 15:38 UTC on 18 September 2026, nine hours after run 452 last
 * edited /policy/freshness. isStale, daysSince, relativeTime, formatDay, isoDate
 * and freshnessBanner are all imported from wiki-formant/freshness now, and the
 * source the page should cite is
 * github.com/tutmoses/wiki-formant/blob/main/src/freshness.ts (200).
 * scripts/mark-verified.mjs, the other half of the same reference, is still in
 * this repository and still answers 200, so reference 3 is narrowed to the file
 * it correctly names and a fourth reference carries the package.
 *
 * Both edited pages publish dated figures, and all of them were re-measured
 * against the database at 21 September 2026 rather than carried over:
 *
 *   378 pages, 310 stamped, 68 never verified (377 under a category, 309
 *     stamped) - against 308 of 377 on 16 and 18 September
 *   oldest readings: ecosystem/xrd-domains 176 days (never verified, edited
 *     28 Mar), ecosystem/radix-namespace 83 (never verified, 29 Jun), then a
 *     six-way tie at 49 days on pages the sweep verified on 2 August
 *   hand-placed notice blocks: 5, on the same 5 pages as on 4 September
 *   quality grades: 8, not the 6 the page states; 7 are policy pages
 *   tracking queues, read off /maintenance: orphaned 11 (was 13), unsourced 16
 *     (unchanged), missing required metadata 3 (was 2), outdated empty
 *
 * The unsourced queue is the finding worth writing down. maintenance.ts counts
 * a page's external links by matching href=" against the serialised blocks, and
 * a references block stores its URLs in a url field, so a page whose citations
 * are all in its reference list reads as citing nothing. Seven of the sixteen
 * are that case, 60 reference URLs between them, /policy/editorial-notices
 * among them. Nine carry no link at all: four category hub articles
 * (contents/tech, contents/tech/releases, contents/tech/research, ecosystem),
 * two generated operations pages (network-weekly, wiki-maintenance-log) and
 * three ecosystem articles that really do cite nothing (arcane-labyrinth,
 * etherealdao, xrd-domains). The predicate is a one-line code change and is
 * flagged for a human in state rather than changed here.
 *
 * Idempotent: each page is skipped if its sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');

const DEAD_REF = 'https://github.com/tutmoses/radix-wiki/blob/main/src/lib/freshness.ts';
const PKG_REF = 'https://github.com/tutmoses/wiki-formant/blob/main/src/freshness.ts';

const FRESHNESS_EDITS = [
  [
    'Read on 18 September 2026, 308 of the wiki&rsquo;s 377 pages carry a verification stamp and 69 have never been verified, the same as on 16 September, against 293 of 373 on 10 September and 281 of 381 on 2 September.',
    'Read on 21 September 2026, 310 of the wiki&rsquo;s 378 pages carry a verification stamp and 68 have never been verified, against 308 of 377 on 16 and 18 September and 293 of 373 on 10 September.',
  ],
  [
    'it clears when, and only when, the page is verified again.',
    'it clears when, and only when, the page is verified again. The 180-day threshold and the notice it raises both live in <code>wiki-formant</code>, a package this wiki shares with its sibling sites, having moved out of this site&rsquo;s own repository on 18 September 2026; the move broke the source link this page carried, and the link audit of 21 September found it.<sup class="cite"><a href="#ref-4">[4]</a></sup>',
  ],
  [
    '173 days ago as of this reading, which crosses 180 days on 24 September 2026.',
    '176 days ago as of this reading, which crosses 180 days on 24 September 2026, three days after it.',
  ],
  [
    'last edited on 29 June 2026, 81 days ago, and crossing 180 days on 26 December 2026',
    'last edited on 29 June 2026, 83 days ago, and crossing 180 days on 26 December 2026',
  ],
  [
    'The third-oldest reading is 47 days, on <a href="/contents/tech/core-protocols/system-layer" class="link">System Layer</a>, verified on 2 August 2026 and crossing the threshold on 29 January 2027.',
    'The third-oldest reading is 49 days, shared by six pages the sweep verified on 2 August 2026, among them <a href="/contents/tech/core-protocols/system-layer" class="link">System Layer</a>; all six cross the threshold on 29 January 2027.',
  ],
];

const NOTICES_EDITS = [
  [
    'Read again at 4 September 2026, the whole wiki carries <strong>five</strong> of them across 380 pages &ndash; the same five, on the same five pages, nine days and ten new articles later:',
    'Read again on 21 September 2026, the whole wiki carries <strong>five</strong> of them across 378 pages &ndash; the same five, on the same five pages, seventeen days later:',
  ],
  [
    '<strong>293 of the 373</strong> pages under a category now carry an explicit verification stamp, read on 10 September 2026, and <strong>none</strong> of them is past the threshold. The oldest page on the wiki was last touched 166 days ago, so it raises the notice by itself on <strong>24 September 2026</strong> unless someone acts first.',
    '<strong>309 of the 377</strong> pages under a category now carry an explicit verification stamp, read on 21 September 2026, and <strong>none</strong> of them is past the threshold. The oldest page on the wiki was last touched 176 days ago, so it raises the notice by itself on <strong>24 September 2026</strong>, three days after this reading, unless someone acts first.',
  ],
  [
    'at 166 days and <a href="/ecosystem/radix-namespace" class="link">Radix Namespace</a> at 73, and both sit in',
    'at 176 days and <a href="/ecosystem/radix-namespace" class="link">Radix Namespace</a> at 83, and both sit in',
  ],
  [
    '<strong>13 pages</strong> on 4 September 2026, still the largest queue and down from 19 nine days earlier.',
    '<strong>11 pages</strong> on 21 September 2026, still the largest queue and down from 13 on 4 September.',
  ],
  [
    '<strong>16 pages</strong>, and the only one of the four queues that grew.',
    '<strong>16 pages</strong>, unchanged in count since 4 September. The predicate counts a page&rsquo;s external links by matching <code>href=&quot;</code> against its stored blocks, and a references block holds its citations in a <code>url</code> field, so a page whose sources all sit in its reference list reads as citing nothing. Seven of the sixteen are that case, carrying sixty reference URLs between them, and this page is one of the seven. Of the nine that carry no link of any kind, four are category hub articles and two are pages the site generates from its own data, which leaves three ecosystem articles that cite nothing: <a href="/ecosystem/arcane-labyrinth" class="link">Arcane Labyrinth</a>, <a href="/ecosystem/etherealdao" class="link">EtherealDAO</a> and <a href="/ecosystem/xrd-domains" class="link">XRD Domains</a>.',
  ],
  [
    '<strong>2 pages</strong>, unchanged.',
    '<strong>3 pages</strong>, up from two: <a href="/developers/ai-agents/ai-agents-and-x402" class="link">AI Agents &amp; x402 Payments</a> and <a href="/developers/ai-agents/radix-context" class="link">Radix Context for AI Agents</a>, both missing Status, and the <a href="/ecosystem" class="link">Ecosystem</a> hub article, which inherits the Status and Category required of every project page in the directory and is not a project.',
  ],
  [
    'it is set by hand, and it is set on six pages.',
    'it is set by hand, and it is set on eight pages, seven of them the policy pages themselves.',
  ],
];

const replaceOnce = (haystack, needle, replacement, where) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`${where}: string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`${where}: string is not unique: ${JSON.stringify(needle.slice(0, 70))}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

const applyEdits = (blocks, edits, where) => {
  for (const [from, to] of edits) {
    const target =
      blocks.find((b) => (b.text || '').includes(from)) ||
      blocks.flatMap((b) => b.blocks || []).find((b) => (b.text || '').includes(from));
    if (!target) throw new Error(`${where}: no block holds ${JSON.stringify(from.slice(0, 60))}`);
    target.text = replaceOnce(target.text, from, to, where);
  }
};

const write = async (client, page, blocks, version, changeType, message) => {
  assertLinkShapes(blocks, page.title);
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
    [json, version, now, page.id],
  );
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, changeType, AUTHOR_ID, message, now],
  );
  await client.query('COMMIT');
};

const load = async (client, tagPath, slug) => {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [tagPath, slug],
  );
  if (!rows.length) throw new Error(`${tagPath}/${slug} not found`);
  return rows[0];
};

await withClient(async (client) => {
  // 1. Freshness: the dead self-citation, and the September census.
  const fresh = await load(client, 'policy', 'freshness');
  if (JSON.stringify(fresh.content).includes(PKG_REF)) {
    console.log('  freshness: wiki-formant reference already present - no write');
  } else {
    const blocks = JSON.parse(JSON.stringify(fresh.content));
    applyEdits(blocks, FRESHNESS_EDITS, 'freshness');

    const refs = blocks.find((b) => b.type === 'references');
    if (!refs) throw new Error('freshness: no references block');
    const dead = refs.items.find((i) => i.url === DEAD_REF);
    if (!dead) throw new Error('freshness: the dead reference is not where it was');
    dead.url = 'https://github.com/tutmoses/radix-wiki/blob/main/scripts/mark-verified.mjs';
    dead.text = 'RADIX Wiki &ndash; <em>scripts/mark-verified.mjs</em>, source repository';
    refs.items.push({
      id: 'e3b7c41a-5d92-4f08-9c16-7a4d2be80f31',
      url: PKG_REF,
      text: 'wiki-formant &ndash; <em>src/freshness.ts</em>, the 180-day threshold and the outdated notice',
    });

    const version = '1.7.0';
    console.log(
      `  ${DRY ? '[dry] ' : ''}${fresh.title}  v${fresh.version} -> v${version}` +
        '\n        ref 3: src/lib/freshness.ts (404, deleted 18 Sep) -> scripts/mark-verified.mjs' +
        '\n        ref 4 added: wiki-formant/src/freshness.ts, cited from the render-time notice' +
        '\n        census 308/377 -> 310/378; xrd-domains 173 -> 176d; namespace 81 -> 83d; third reading 47 -> 49d (six pages)',
    );
    if (!DRY) {
      await write(
        client,
        fresh,
        blocks,
        version,
        'minor',
        'The policy link audit of 21 September 2026 found one genuine death in this category and it was this page ' +
          'citing itself: github.com/tutmoses/radix-wiki/blob/main/src/lib/freshness.ts answers 404, because commit ' +
          '599ffa8 deleted the file at 15:38 UTC on 18 September when the freshness banner moved into the ' +
          'wiki-formant package. Reference 3 is narrowed to scripts/mark-verified.mjs, which is the file the ' +
          'sentence citing it names and which is still in this repository, and a fourth reference carries ' +
          'wiki-formant/src/freshness.ts, cited from the paragraph that describes the render-time notice. Every ' +
          'dated figure re-measured against the database: 310 of 378 pages stamped and 68 never verified, against ' +
          '308 of 377 on 16 and 18 September; XRD Domains 176 days and Radix Namespace 83; and the third-oldest ' +
          'reading is a six-way tie at 49 days rather than System Layer alone.',
      );
    }
  }

  // 2. Editorial notices: the same census, the queues, and what unsourced counts.
  const notices = await load(client, 'policy', 'editorial-notices');
  if (JSON.stringify(notices.content).includes('holds its citations in a <code>url</code> field')) {
    console.log('  editorial-notices: unsourced breakdown already present - no write');
  } else {
    const blocks = JSON.parse(JSON.stringify(notices.content));
    applyEdits(blocks, NOTICES_EDITS, 'editorial-notices');
    const version = '1.3.0';
    console.log(
      `  ${DRY ? '[dry] ' : ''}${notices.title}  v${notices.version} -> v${version}` +
        '\n        notices 5/380 (4 Sep) -> 5/378 (21 Sep); census 293/373 -> 309/377; countdown now three days out' +
        '\n        queues: orphaned 13 -> 11, incomplete 2 -> 3 (named), unsourced 16 with what the predicate misses' +
        '\n        quality grades six -> eight',
    );
    if (!DRY) {
      await write(
        client,
        notices,
        blocks,
        version,
        'minor',
        'Re-measured on 21 September 2026, three days before the first synthetic outdated notice this wiki will ' +
          'show. The verification census moves from 293 of 373 pages under a category to 309 of 377; XRD Domains ' +
          'stands at 176 days and Radix Namespace at 83; the five hand-placed notices are the same five on the same ' +
          'five pages, now across 378 pages; and the quality grade is set on eight pages rather than six. The ' +
          'tracking queues are read off /maintenance: orphaned 11, down from 13; missing required metadata 3, up ' +
          'from 2, and the three are named. The unsourced queue holds 16 pages and the entry now says what that ' +
          'counts: the predicate matches href=" against the stored blocks and a references block holds its URLs in ' +
          'a url field, so seven of the sixteen carry sixty reference URLs between them and read as citing nothing, ' +
          'this page among them. Of the nine with no link at all, four are category hubs and two are generated, ' +
          'leaving three ecosystem articles that cite nothing.',
      );
    }
  }
});
