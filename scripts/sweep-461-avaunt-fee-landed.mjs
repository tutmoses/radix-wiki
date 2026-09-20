/**
 * sweep 461 - the Avaunt Staking fee increase takes effect.
 *
 * The run-445/458 backlog item, due this morning and read on the ledger within
 * minutes of it landing. Avaunt Staking's rise from 2% to 25% took effect at
 * epoch 342,482, which the network reached at 10:59:09 UTC on 20 September
 * 2026. Pinned Gateway reads either side of the switch:
 *
 *   epoch 342,481 (10:54:09 UTC) - effective_fee_factor current 0.02,
 *                                  pending 0.25 at 342,482, stake 138,920,206.85
 *   epoch 342,482 (10:59:09 UTC) - effective_fee_factor current 0.25,
 *                                  no pending,              stake 138,920,292.51
 *
 * The component itself still stores validator_fee_factor 0.02 with the request
 * beside it (epoch_effective 342482), the stored-vs-charged split every
 * validator in this queue has shown. Rank 9 of 186 registered validators,
 * 3.001% of the delegated stake in the register, and the owner-stake release of
 * 294,848 stake units is still pending at epoch 346,514.
 *
 * The page recorded 138,838,023 XRD at epoch 341,523 on 17 September, so the
 * stake ROSE by about 82,000 XRD over the three days to the switch: nothing was
 * withdrawn in the notice period.
 *
 * Two edits:
 *
 * 1. /ecosystem/avaunt-staking - the "The new fee date (17 September 2026)"
 *    section says the fee "has not taken effect yet". Replaced with the landing.
 *
 * 2. /contents/history/validator-subsidy-sunset - a section for the landing, as
 *    run 458 wrote for Apollo Pool, and the queue table re-read: three requests
 *    remain, at epoch 342,483 (11:05 UTC, 20 September).
 *
 * Both target blocks use plain spaces and ASCII apostrophes, not &nbsp; and not
 * curly quotes; the new prose matches, so a later find-string still works.
 *
 * Run once. Idempotent: each page has a sentinel and is skipped if present.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');

const GATEWAY = 'https://mainnet.radixdlt.com/state/validators/list';

// ---- 1. /ecosystem/avaunt-staking ------------------------------------------
const AVAUNT_OLD_HEAD = '<h3>The new fee date (17 September 2026)</h3>';
const AVAUNT_NEW =
  '<h3>The 25% fee took effect (20 September 2026)</h3>' +
  '<p>The rise from 2% to 25% took effect at <strong>epoch 342,482</strong>, which the network reached at 10:59 UTC ' +
  'on 20 September 2026. Read from the <a href="' +
  GATEWAY +
  '" target="_blank" rel="noopener">Radix Gateway</a> at the epoch before it, the register reports the validator ' +
  'charging 2% over 138,920,207 XRD; at epoch 342,482 it reports an <code>effective_fee_factor</code> of ' +
  '<strong>0.25</strong> over <strong>138,920,293 XRD</strong>. That is rank 9 of the 186 registered validators and ' +
  '3.0% of the delegated stake in the register, and more stake than the three fee increases still queued behind it ' +
  'carry between them.</p>' +
  '<p>None of it moved in the notice an increase gives. This page recorded 138,838,023 XRD at epoch 341,523 on ' +
  '17 September and the register held 138,920,207 at epoch 342,481, the last epoch at 2%: a rise of about 82,000 XRD ' +
  'over the three days to the switch, so no delegator withdrew ahead of it. The validator component still stores a ' +
  '<code>validator_fee_factor</code> of <code>0.02</code> with the change request beside it, as every validator in ' +
  "that queue has, so the component state alone reports the old fee; the register's <code>effective_fee_factor</code> " +
  "is the field carrying the 25%. The release of 294,848 of the owner's own stake units is still pending at epoch " +
  '346,514, around 4 October.</p>' +
  '<p>The queue this increase belongs to, and what the increases before it did to their validators\' stake, is on ' +
  '<a href="/contents/history/validator-subsidy-sunset" rel="noopener">Validator Subsidy Sunset</a>.</p>';

// ---- 2. /contents/history/validator-subsidy-sunset --------------------------
const SUNSET_MARKER = '<h2>What is still queued</h2>';
const SUNSET_NEW_SECTION =
  '<h2>Avaunt Staking at 25% (20 September 2026)</h2>' +
  '<p><a href="/ecosystem/avaunt-staking" rel="noopener">Avaunt Staking</a>\'s rise from 2% to 25% took effect at ' +
  '<strong>epoch 342,482</strong>, 10:59 UTC on 20 September 2026, over <strong>138,920,293 XRD</strong> of ' +
  'delegated stake. That is rank 9 of the 186 registered validators and 3.0% of the delegated stake in the register, ' +
  'and more than the three requests still queued carry between them. The increase was signed on 26 August from the ' +
  "account that holds the validator's owner badge; the " +
  '<a href="/ecosystem/avaunt-staking" rel="noopener">validator\'s page</a> sets out the sale of that badge and the ' +
  'announcement that did not mention the fee.</p>' +
  '<p>None of the stake moved in the notice period. The register held 138,838,023 XRD for the node at epoch 341,523 ' +
  'on 17 September and 138,920,207 at epoch 342,481, the last epoch at 2%. Its component still stores ' +
  "<code>0.02</code>, as Apollo Pool's stores <code>0.2</code> and the four before it store theirs.</p>";

const SUNSET_QUEUE_OLD_OPEN =
  '<p>Four requests remain, read across the register at epoch 342,339 (19 September 2026, 23:05 UTC):</p>';
const SUNSET_QUEUE_NEW_OPEN =
  '<p>Three requests remain, read across the register at epoch 342,483 (20 September 2026, 11:05 UTC):</p>';

const SUNSET_AVAUNT_ROW =
  '<tr><td><strong><a href="/ecosystem/avaunt-staking" rel="noopener">Avaunt Staking</a></strong></td>' +
  '<td>2% to 25% at epoch 342,482, about 20 September, over 138.9 million XRD</td></tr>';

const SUNSET_CHARTS_OLD = '<td>2.5% to 15% at epoch 345,107, about 29 September, over 23.7 million XRD</td>';
const SUNSET_CHARTS_NEW = '<td>2.5% to 15% at epoch 345,107, about 29 September, over 23.6 million XRD</td>';

const SUNSET_FIRST_OLD =
  '<p>At epoch 341,571 the queue held five increases. The first of them has since taken effect.</p>';
const SUNSET_FIRST_NEW =
  '<p>At epoch 341,571 the queue held five increases. The first two have since taken effect.</p>';

const replaceOnce = (haystack, needle, replacement, where) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`${where}: string not found: ${JSON.stringify(needle.slice(0, 70))}`);
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

await withClient(async (client) => {
  // ---- 1. the validator's own page -----------------------------------------
  {
    const page = await readPage(client, 'ecosystem', 'avaunt-staking');
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes('The 25% fee took effect')) {
      console.log('  avaunt-staking: fee landing already recorded - no write');
    } else {
      const block = blocks.find((b) => (b.text || '').includes(AVAUNT_OLD_HEAD));
      if (!block) throw new Error('avaunt: "The new fee date" section not found');
      const i = block.text.indexOf(AVAUNT_OLD_HEAD);
      // the section is the tail of the block; everything from the h3 is replaced
      block.text = block.text.slice(0, i) + AVAUNT_NEW;

      const version = '3.2.0';
      console.log(
        `  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}` +
          '\n        "The new fee date (17 September 2026)" -> "The 25% fee took effect (20 September 2026)"' +
          '\n        2% -> 25% at epoch 342,482, 10:59 UTC 20 Sep; 138,920,293 XRD, rank 9 of 186',
      );
      if (!DRY)
        await writePage(
          client,
          page,
          blocks,
          version,
          'minor',
          'The 25% fee has taken effect. Pinned Gateway reads either side of the switch: at epoch 342,481 ' +
            '(10:54 UTC, 20 September 2026) the register reports effective_fee_factor 0.02 with 0.25 pending at ' +
            '342,482 over 138,920,206.85 XRD; at epoch 342,482 (10:59 UTC) it reports 0.25 with nothing pending over ' +
            '138,920,292.51 XRD. Rank 9 of 186 registered validators, 3.0% of delegated stake. The stake rose by ' +
            'about 82,000 XRD from the 138,838,023 read on 17 September, so nothing was withdrawn in the notice ' +
            'period. The component still stores validator_fee_factor 0.02; the owner-stake release of 294,848 stake ' +
            'units remains pending at epoch 346,514.',
        );
    }
  }

  // ---- 2. the queue record -------------------------------------------------
  {
    const page = await readPage(client, 'contents/history', 'validator-subsidy-sunset');
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes('Avaunt Staking at 25%')) {
      console.log('  validator-subsidy-sunset: Avaunt landing already recorded - no write');
    } else {
      const block = blocks.find((b) => (b.text || '').includes(SUNSET_MARKER));
      if (!block) throw new Error('sunset: "What is still queued" not found');
      let t = block.text;
      t = replaceOnce(t, SUNSET_FIRST_OLD, SUNSET_FIRST_NEW, 'sunset first-of-five');
      t = replaceOnce(t, SUNSET_MARKER, SUNSET_NEW_SECTION + SUNSET_MARKER, 'sunset new section');
      t = replaceOnce(t, SUNSET_QUEUE_OLD_OPEN, SUNSET_QUEUE_NEW_OPEN, 'sunset queue opener');
      t = replaceOnce(t, SUNSET_AVAUNT_ROW, '', 'sunset avaunt row');
      t = replaceOnce(t, SUNSET_CHARTS_OLD, SUNSET_CHARTS_NEW, 'sunset charts stake');
      block.text = t;

      const version = '1.6.0';
      console.log(
        `  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}` +
          '\n        + "Avaunt Staking at 25% (20 September 2026)"' +
          '\n        queue table: four requests -> three, re-read at epoch 342,483',
      );
      if (!DRY)
        await writePage(
          client,
          page,
          blocks,
          version,
          'minor',
          "Avaunt Staking's 2% to 25% took effect at epoch 342,482, 10:59 UTC on 20 September 2026, over " +
            '138,920,293 XRD - rank 9 of 186 registered validators and 3.0% of delegated stake, and more than the ' +
            'three requests still queued carry between them. Nothing was withdrawn in the notice period: 138,838,023 ' +
            'XRD at epoch 341,523 on 17 September, 138,920,207 at epoch 342,481. The queue table is re-read at epoch ' +
            '342,483 (11:05 UTC, 20 September) and now holds three requests: Daffy (Supreme) at 344,149, Radix ' +
            'Charts V2 at 345,107 (23.6m XRD, re-read) and DoItForDan at 345,108.',
        );
    }
  }
});
