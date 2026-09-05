/**
 * sweep 372 (ecosystem rotation) — repair the four ecosystem pages whose
 * `metadata.founded` is a day-first DD/MM/YYYY string rather than the ISO date
 * the field is declared as (`{ key: 'founded', type: 'date' }`, src/lib/tags.ts).
 *
 * Why this is a defect and not cosmetics: both readers of the field parse with
 * `new Date(value)`, which reads a slashed date as US month-first. So
 * `01/08/2021` renders in the infobox as 2021-01-08 (BlockRenderer
 * formatMetadataValue) and is emitted as Schema.org `foundingDate` 2021-01-08
 * (entity-ld aboutEntity). The pages do not "fall out of the year cohort" as
 * run 369 assumed — they publish a fabricated January date, in the facts table
 * and in structured data.
 *
 * The values are day-first. All four carry day 01, which is exactly the shape
 * the wiki's own convention produces for a month known without its day: 90 of
 * the 116 ecosystem `founded` values are YYYY-MM-01. Read month-first instead,
 * all four would land in January with days 2/8/7/2, and DogeCubeX would then be
 * founded 8 January 2021 — more than six months before Olympia, the Radix
 * mainnet release that first made $XRD-era tokens possible (28 July 2021). The
 * day-first reading is the only one that survives that test.
 *
 * RadKET is the one value that does not merely change format. Read day-first it
 * is 2022-07-01, the start of the Q3/Q4 2022 window the project's own roadmap —
 * quoted on the page — gives for "social media creation ... beginning of the
 * online marketing". That roadmap dates the project itself to "Q4 2021 —
 * RadKET's birth", and the page's opening paragraph already says "The project
 * was initiated in 2021", so the infobox has been contradicting the prose above
 * it. Set to 2021-10-01: the first month of the sourced quarter, the same
 * round-down the YYYY-MM-01 convention already applies to an unknown day.
 *
 * Metadata-only, so the content blocks are carried into the revision row
 * unchanged and the version takes a patch bump — the shape network-snapshot.mjs
 * already uses for a metadata write. Idempotent: a page already holding the
 * target value is skipped.
 *
 *   node scripts/sweep-372-ecosystem-founded-iso.mjs --dry-run
 */
import { config } from 'dotenv';
import { withClient, isLockedPage, cuid, AUTHOR_ID } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'ecosystem';

const bumpPatch = (v) => { const p = String(v).split('.').map(Number); p[2] = (p[2] || 0) + 1; return p.join('.'); };

const FIXES = [
  { slug: 'blue-chick-nfts',        from: '01/02/2023', to: '2023-02-01',
    message: 'Founded: 01/02/2023 read as ISO 2023-02-01. The slashed value was parsed month-first by both readers of the field and rendered as 2 January 2023, in the facts table and in the Schema.org foundingDate; the value is day-first, and day 01 is the wiki convention for a month known without its day.' },
  { slug: 'dogecubex',              from: '01/08/2021', to: '2021-08-01',
    message: 'Founded: 01/08/2021 read as ISO 2021-08-01. The slashed value rendered as 8 January 2021 — over six months before Olympia, the mainnet release that made $XRD-era tokens possible — which settles the value as day-first rather than month-first.' },
  { slug: 'radket',                 from: '01/07/2022', to: '2021-10-01',
    message: "Founded: corrected to 2021-10-01 and put in ISO form. The stored 01/07/2022 rendered as 7 January 2022; read day-first it is July 2022, the start of the Q3/Q4 2022 window this page's own roadmap gives for social media and marketing. That roadmap dates the project to 'Q4 2021 — RadKET's birth' and the opening paragraph says it was initiated in 2021, so the infobox was contradicting the prose above it. The first month of the sourced quarter follows the same round-down the day-01 convention applies." },
  { slug: 'the-hard-money-project', from: '01/02/2023', to: '2023-02-01',
    message: 'Founded: 01/02/2023 read as ISO 2023-02-01. The slashed value was parsed month-first by both readers of the field and rendered as 2 January 2023, in the facts table and in the Schema.org foundingDate; the value is day-first, and day 01 is the wiki convention for a month known without its day.' },
];

await withClient(async (client) => {
  let changed = 0, skipped = 0;

  for (const fix of FIXES) {
    if (isLockedPage(TAG, fix.slug)) throw new Error(`${fix.slug} is LOCKED`);

    const { rows } = await client.query(
      'SELECT id, title, version, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, fix.slug]);
    if (!rows.length) throw new Error(`page not found: ${TAG}/${fix.slug}`);
    const page = rows[0];
    const md = page.metadata && typeof page.metadata === 'object' ? page.metadata : {};

    if (md.founded === fix.to) { console.log(`  skip  ${fix.slug} — already ${fix.to}`); skipped++; continue; }
    if (md.founded !== fix.from) throw new Error(`${fix.slug}: expected founded ${fix.from}, found ${JSON.stringify(md.founded)}`);

    const renders = new Date(fix.from).toISOString().slice(0, 10);
    const version = bumpPatch(page.version);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title.padEnd(24)} ${fix.from} (renders ${renders}) -> ${fix.to}   v${page.version} -> v${version}`);

    if (!DRY) {
      const now = new Date().toISOString();
      await client.query('BEGIN');
      await client.query(
        `UPDATE pages SET metadata = jsonb_set(metadata, '{founded}', to_jsonb($1::text)), version = $2, updated_at = $3 WHERE id = $4`,
        [fix.to, version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         SELECT $1, id, content, $2, $3, 'patch', $4, $5, $6 FROM pages WHERE id = $7`,
        [cuid(), page.title, version, AUTHOR_ID, fix.message, now, page.id]);
      await client.query('COMMIT');
    }
    changed++;
  }

  console.log(`\n  ${DRY ? 'would change' : 'changed'} ${changed}, skipped ${skipped}`);
});
