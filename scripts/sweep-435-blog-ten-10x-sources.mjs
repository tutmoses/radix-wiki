import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const EXT = 'target="_blank" rel="noopener"';
const OLD_ATTRS = 'target="_blank" rel="noopener noreferrer nofollow" class="link"';

const edits = [
  {
    slug: 'ten-10x-moments-coming-to-web3',
    expectVersion: '2.6.3',
    version: '2.7.0',
    changeType: 'minor',
    sentinel: 'scaling-dlt-to-over-1m-tps-on-google-cloud',
    message: 'Sweep 435: three sources checked. (1) "1.4m transactions per second (tps)" linked the 11 June 2019 replaying-bitcoin post, which says peaked over 1 million; the 1.4 million figure is in the 28 August 2019 Google Cloud post, now linked. (2) The "~200k" Solidity developer count linked a malformed URL (the SmartCon 2022 post and the Electric Capital 2021 report joined with ")("), which resolves to the Chainlink blog index; neither post gives a Solidity count and the one secondary citation found (a LinkedIn article of 31 October 2022) is gone, so the link is removed and the editor\'s note says so. (3) The same GitHub repository searches the table links return 1,347,045 Rust and 295,472 Solidity on 15 September 2026, a ratio of 4.6 against the 29 printed. The closing section\'s forex figure (~5tn a day) is the BIS April 2016 count; the April 2022 survey, published October 2022, measured 7.5tn. Essay prose unchanged.',
    replacements: [
      {
        from: 'href="https://www.radixdlt.com/blog/replaying-bitcoin">1.4m transactions per second (tps)</a>',
        to: 'href="https://www.radixdlt.com/blog/scaling-dlt-to-over-1m-tps-on-google-cloud">1.4m transactions per second (tps)</a>',
      },
      {
        from: `<a ${OLD_ATTRS} href="https://blog.chain.link/smartcon-2022-developer-announcements/)(https://medium.com/electric-capital/electric-capital-developer-report-2021-f37874efea6d">~200k</a>`,
        to: '~200k',
      },
      {
        from: 'The Rust-versus-Solidity figures in the table above are 2022&ndash;2023 counts and have not been re-measured here.',
        to: `The Rust-versus-Solidity figures in the table above are 2022&ndash;2023 counts. On 15 September 2026 the same GitHub searches return <a href="https://github.com/search?q=language%3ARust&amp;type=repositories" ${EXT}>1.35m Rust repositories</a> and <a href="https://github.com/search?q=language%3ASolidity&amp;type=repositories" ${EXT}>295k Solidity repositories</a>, 4.6 times as many rather than 29. The table&rsquo;s count of about 200k Solidity developers has no surviving source: its link joined two unrelated posts into one broken address, and neither gives the figure.`,
      },
      {
        from: 'a different execution engine, and a different builder from the ones named here.</p>',
        to: `a different execution engine, and a different builder from the ones named here.</p>\n<p>One supporting figure was out of date on the day the piece was published. Its closing section puts the forex market at about 5 trillion dollars a day, the <a href="https://www.bis.org/publ/rpfx16.htm" ${EXT}>BIS count for April 2016</a>; the survey for April 2022, published in October 2022, <a href="https://www.bis.org/statistics/rpfx22.htm" ${EXT}>measured 7.5 trillion</a>.</p>`,
      },
    ],
  },
  {
    slug: 'money-wealth-volcanos',
    expectVersion: '2.4.3',
    version: '2.4.4',
    changeType: 'patch',
    sentinel: 'fred.stlouisfed.org/data/M2SL.txt',
    message: 'Sweep 435: checked the one figure run 423 could not, "Since 1990, the dollars we use to measure wealth have increased 560%". FRED series M2SL, read in a browser on 15 September 2026, gives 3,166.3bn for January 1990 and 20,829.5bn for May 2023, a rise of 558%, so the figure holds. Recorded in the Dated claim row; essay unchanged.',
    replacements: [
      {
        from: '$9.6 trillion for April 2025</a></td>',
        to: `$9.6 trillion for April 2025</a>. Its money-supply figure holds: US M2 <a href="https://fred.stlouisfed.org/data/M2SL.txt" ${EXT}>rose from 3.2 trillion dollars in January 1990 to 20.8 trillion in May 2023</a>, an increase of 558%</td>`,
      },
    ],
  },
];

if (new RegExp('[\\u00a0\\u2014]').test(JSON.stringify(edits))) throw new Error('script contains a U+00A0 or an em dash');

const textNodes = (blocks) => blocks.flatMap((b) => [...(typeof b.text === 'string' ? [b] : []), ...(b.blocks ? textNodes(b.blocks) : [])]);

try {
  for (const e of edits) {
    if (isLockedPage('blog', e.slug)) throw new Error(`blog/${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['blog', e.slug]);
    if (!rows.length) throw new Error(`blog/${e.slug} not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }
    if (page.version !== e.expectVersion) throw new Error(`${e.slug}: expected v${e.expectVersion}, found v${page.version}`);

    for (const r of e.replacements) {
      let hits = 0;
      for (const n of textNodes(blocks)) {
        const count = n.text.split(r.from).length - 1;
        if (!count) continue;
        n.text = n.text.split(r.from).join(r.to);
        hits += count;
      }
      if (hits !== 1) throw new Error(`${e.slug}: expected 1 match for "${r.from.slice(0, 60)}", found ${hits}`);
    }

    console.log(`  ${DRY ? '[dry] ' : ''}blog/${e.slug}  v${page.version} -> v${e.version}  (${e.changeType})`);
    if (DRY) continue;

    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
