// Run 374, contents/resources rotation.
//
// /contents/resources/brand-assets describes the wiki's own logomark as a
// 700x700 PNG of 440 KB. That stopped being true on 5 September 2026, when
// commit 63f89e2 replaced public/logo.png with a 512x512 file of 59 KB
// (measured: 60,778 bytes, 512x512; the previous blob at 7116d8d was 449,911
// bytes, 700x700). Same artwork, different file, and the page tells readers to
// download it.
//
// The page also asserts "There is no third-party image CDN to break" while the
// only image on it is hotlinked from the wiki's Vercel Blob store, a separate
// host serving a 700x700 WebP of the OLD mark. /contents/resources/radix-visuals
// repeats the claim in one sentence. Both narrowed to what is measurable: the
// download links resolve on radix.wiki, the preview does not.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const COMMIT = 'https://github.com/tutmoses/radix-wiki/commit/63f89e2b8a83e665e3f7784cb8362abbc28eb77c';

/** Replace once, and refuse to write if the needle was not there. */
const swap = (text, from, to, label) => {
  const n = text.split(from).length - 1;
  if (n !== 1) throw new Error(`${label}: expected 1 occurrence, found ${n}`);
  return text.replace(from, to);
};

const EDITS = [
  {
    tagPath: 'contents/resources',
    slug: 'brand-assets',
    version: '1.5.0',
    changeType: 'minor',
    sentinel: '512&times;512',
    message:
      'Corrected the logomark measurements. /logo.png has been a 512x512 PNG of 59 KB since commit 63f89e2 on 5 September 2026; the page still described the 700x700, 440 KB file it replaced. Also narrowed the "no third-party image CDN" claim: the three download links resolve on radix.wiki, but the preview image is a WebP copy of the older mark served from the wiki image store, a separate host.',
    apply(blocks) {
      const box = blocks[0].blocks[0];
      box.text = swap(
        box.text,
        'Colour logomark – PNG, 700&times;700, 440&nbsp;KB',
        'Colour logomark – PNG, 512&times;512, 59&nbsp;KB',
        'infobox primary mark',
      );
      box.text = swap(
        box.text,
        '<td>radix.wiki (no third-party CDN)</td>',
        "<td>radix.wiki, for the download links; the preview image is held in the wiki's image store</td>",
        'infobox served from',
      );

      const body = blocks[1];
      body.text = swap(
        body.text,
        'Every file below is served directly from <code>radix.wiki</code> – hotlink it, or download and self-host. There is no third-party image CDN to break.',
        'The download links below resolve on <code>radix.wiki</code> itself, so they ship with the site and cannot be decommissioned out from under a page the way the image proxy behind this wiki’s <a href="/contents/resources/radix-visuals" rel="noopener">retired 79-image gallery</a> was. Hotlink them, or download and self-host. The logomark shown below is a WebP preview served from the wiki’s image store, which is a separate host: link the download URL, not the preview.',
        'body cdn claim',
      );
      body.text = swap(
        body.text,
        'The primary RADIX.wiki mark: a 700&times;700 PNG, 440&nbsp;KB.',
        'The primary RADIX.wiki mark: a 512&times;512 PNG, 59&nbsp;KB.',
        'body mark measurements',
      );
      body.text = swap(
        body.text,
        'Download or hotlink it at <a href="/logo.png" rel="noopener">radix.wiki/logo.png</a>.</p>',
        `Download or hotlink it at <a href="/logo.png" rel="noopener">radix.wiki/logo.png</a>. The artwork is unchanged, but the file is not: until <a href="${COMMIT}" target="_blank" rel="noopener">5 September 2026</a> this URL served a 700&times;700 PNG of 440&nbsp;KB, and the preview above is still that larger copy. Anything holding the old dimensions should re-measure.</p>`,
        'body logo history',
      );
      return blocks;
    },
  },
  {
    tagPath: 'contents/resources',
    slug: 'radix-visuals',
    version: '2.1.1',
    changeType: 'patch',
    sentinel: 'the preview image on that page is served from',
    message:
      'Narrowed the copied "served from radix.wiki itself rather than a third-party CDN" claim about Brand Assets, which is true of that page’s download links and not of its preview image. Same correction as brand-assets v1.5.0 this run.',
    apply(blocks) {
      const last = blocks[blocks.length - 1];
      last.text = swap(
        last.text,
        '<a href="/contents/resources/brand-assets" rel="noopener">Brand Assets</a> – the logomark, favicon, and colour reference for this wiki, served from radix.wiki itself rather than a third-party CDN.',
        '<a href="/contents/resources/brand-assets" rel="noopener">Brand Assets</a> – the logomark, favicon, and colour reference for this wiki. Its download links resolve on radix.wiki itself; the preview image on that page is served from the wiki’s own image store.',
        'visuals cdn claim',
      );
      return blocks;
    },
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [e.tagPath, e.slug],
    );
    if (!rows.length) throw new Error(`page not found: ${e.tagPath}/${e.slug}`);
    const page = rows[0];

    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }

    const blocks = e.apply(JSON.parse(JSON.stringify(page.content)));
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (${e.changeType})`);

    if (DRY) continue;
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json,
      e.version,
      now,
      page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now],
    );
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
