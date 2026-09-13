import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const EXT = 'target="_blank" rel="noopener"';
const MEMPOOL = `<a href="https://mempool.space/graphs/mining/hashrate-difficulty" ${EXT}>difficulty</a>`;
const BTC_WIKI = `<a href="https://en.bitcoin.it/wiki/Difficulty" ${EXT}>difficulty × 2^32</a>`;

const edits = [
  {
    slug: 'pow-vs-pos-the-next-industrial-revolution',
    expectVersion: '2.4.0',
    version: '2.4.1',
    changeType: 'patch',
    sentinel: '3.2 × 10^23',
    message: 'Sweep 423: the PoW section said hashing a block "10^16 times (roughly the current requirement for Bitcoin)". It was seven orders of magnitude low when written. The expected number of hashes per block is difficulty × 2^32 (Bitcoin Wiki, Difficulty); the 2 February 2024 adjustment at block 828,576 set difficulty to 75,502,165,623,893 (mempool.space), which is 3.2 × 10^23 hashes, and the 5 September 2026 adjustment set 127,450,789,715,843, which is 5.5 × 10^23. Corrected in the body and recorded in the infobox Dated claim row beside the September 2026 DPoS correction.',
    replacements: [
      {
        from: '<p>Hashing a block 10^16 times (roughly the current requirement for Bitcoin) requires millions of dollars worth of hardware and electricity.',
        to: `<p>Hashing a block around 10^23 times (the Bitcoin requirement when this was written: at the 2 February 2024 ${MEMPOOL} of 75.5 trillion, a block takes ${BTC_WIKI}, or 3.2 × 10^23 hashes, on average) requires millions of dollars worth of hardware and electricity.`,
      },
      {
        from: 'rather than its delegators&rsquo; principal</td>',
        to: 'rather than its delegators&rsquo; principal. Its PoW section was corrected at the same time: a Bitcoin block took about 3.2 × 10^23 hashes in February 2024, not the 10^16 first printed, and about 5.5 × 10^23 at the September 2026 difficulty</td>',
      },
    ],
  },
  {
    slug: 'money-wealth-volcanos',
    expectVersion: '2.4.2',
    version: '2.4.3',
    changeType: 'patch',
    sentinel: 'rpfx25.htm',
    message: 'Sweep 423: the essay (June 2023) says "the Forex markets swap $5.1tn worth of currencies every day". That is the BIS Triennial Survey figure for April 2016 (rpfx16). The survey measured $7.5 trillion a day for April 2022 (rpfx22), the latest available when the essay was published, and $9.6 trillion for April 2025 (rpfx25). The essay text is left as written and a Dated claim row, matching its companion pieces, records the figure. The "560% since 1990" M2 figure was not re-checked: FRED refused every automated request this run.',
    replacements: [
      {
        from: '</td></tr><tr><th>Related</th>',
        to: `</td></tr><tr><th>Dated claim</th><td>Published in June 2023. Its forex figure, $5.1tn a day, is the <a href="https://www.bis.org/publ/rpfx16.htm" ${EXT}>BIS count for April 2016</a>. The same survey measured <a href="https://www.bis.org/statistics/rpfx22.htm" ${EXT}>$7.5 trillion a day for April 2022</a>, the latest when this was written, and <a href="https://www.bis.org/statistics/rpfx25.htm" ${EXT}>$9.6 trillion for April 2025</a></td></tr><tr><th>Related</th>`,
      },
    ],
  },
  {
    slug: 'rgh2024-debrief',
    expectVersion: '2.6.5',
    version: '2.6.6',
    changeType: 'patch',
    sentinel: 'href="/contents/history/radix-wiki-hackathon-1">event page</a>',
    message: 'Sweep 423: the closing line read "Check out the event page here for more details" with no link on it, a leftover from the Notion import. Linked "event page" to the hackathon\'s own article, /contents/history/radix-wiki-hackathon-1, which the infobox already names as the event.',
    replacements: [
      {
        from: '<p>Check out the event page here for more details, and see you all next year!</p>',
        to: '<p>Check out the <a rel="noopener" class="link" href="/contents/history/radix-wiki-hackathon-1">event page</a> for more details, and see you all next year!</p>',
      },
    ],
  },
];

if (JSON.stringify(edits).includes(' ')) throw new Error('script contains a literal U+00A0');

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
