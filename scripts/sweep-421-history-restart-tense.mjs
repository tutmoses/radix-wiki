import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const edits = [
  {
    tagPath: 'contents/history',
    slug: '',
    version: '1.8.0',
    changeType: 'minor',
    sentinel: '557,840,627',
    message: 'Sweep 421: the category hub still said "At the time of writing mainnet has not restarted" and gave the halt boundary as 557,840,622 at 21:19:06 UTC, which is the Gateway status endpoint\'s reading. The ledger committed through state version 557,840,627 (epoch 339,897 round 4, 21:19:48.939 UTC; a read pinned there answers 200, verified 13 September 2026) and restarted at 11:35 UTC on 11 September. Section past-tensed, restart added, and the day-by-day record now points at the timeline page. Infobox also gave Dan Hughes as (1974-2025); his own page and this hub\'s heading say born 24 July 1979.',
    replacements: [
      { from: 'Dan Hughes</a> (1974–2025)', to: 'Dan Hughes</a> (1979–2025)' },
      {
        from: 'so mainnet came to rest at <strong>21:19:06&nbsp;UTC</strong> on state version 557,840,622 in epoch 339,896 and stayed there.',
        to: 'so the ledger committed its last round at <strong>21:19:48&nbsp;UTC</strong>, state version 557,840,627 in epoch 339,897, and stayed there for ten and a half days.',
      },
      {
        from: 'that will not answer a question about a present it is hours behind.</p>',
        to: 'that would not answer a question about a present it was hours behind. Readings taken through the Gateway during the halt cite state version 557,840,622, where its status endpoint stopped; the ledger itself ran five state versions and 43 seconds further.</p>',
      },
      {
        from: 'At the time of writing mainnet has not restarted. The record read from the ledger, day by day through the outage, is at <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane Asset Drain and Network Halt (August 2026)</a>.</p>',
        to: 'Mainnet restarted at <strong>11:35&nbsp;UTC on 11 September 2026</strong>, 254 hours after it stopped; Eagle Ray was enacted at the start of the next epoch and user transactions resumed at 11:39&nbsp;UTC. The incident is written up at <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane Asset Drain and Network Halt (August 2026)</a>, and the record read from the ledger day by day through the outage is at <a href="/contents/history/hyperlane-asset-drain-2026-timeline" rel="noopener">its timeline</a>.</p>',
      },
    ],
  },
  {
    tagPath: 'contents/history',
    slug: 'hyperlane-asset-drain-2026-timeline',
    version: '1.1.0',
    changeType: 'minor',
    sentinel: 'pinned-after-restart',
    message: 'Sweep 421: the closing guide, "Reading your own account while the Gateway refuses", was written on 6 September in the present tense ("the Gateway will not answer", "nothing can move until the network restarts", "no transaction can be built or submitted"). Mainnet restarted at 11:35 UTC on 11 September. Past-tensed, and a closing paragraph added from a live read at 03:06 UTC on 13 September 2026: unpinned /state/entity/details answers 200, /transaction/construction returns a current ledger state (epoch 340,371), and reads pinned to 557,840,627 (the last state the ledger committed before the halt) and 557,840,622 (the last the Gateway reported) both answer 200.',
    replacements: [
      { from: 'Reading your own account while the Gateway refuses</h2>', to: 'Reading your own account at the halt</h2>' },
      { from: 'and the ordinary way to find out does not work:', to: 'and during the halt the ordinary way to find out did not work:' },
      { from: 'loads and then fails, because it reads the', to: 'loaded and then failed, because it reads the' },
      {
        from: 'and the Gateway will not answer a question about the present while it is five days behind the network.</p>',
        to: 'and the Gateway would not answer a question about the present while it was days behind the network.</p>',
      },
      { from: '<p>It will answer a question about the past.', to: '<p>It would answer a question about the past, and still does.' },
      {
        from: 'returns 200 from the same endpoint that returns 500 unpinned.',
        to: 'returned 200 from the same endpoint that returned 500 unpinned.',
      },
      {
        from: 'Two limits are worth stating plainly. This is the final pre-halt state and nothing more: it is the answer to <em>what did I hold when the network stopped</em>, not to <em>what do I hold now</em>, and the two will be the same only because nothing can move until the network restarts. And it reads; it does not write. <code>/transaction/construction</code> refuses pinned and unpinned alike, so no transaction can be built or submitted, which is the halt working as intended rather than a gap in it.</p>',
        to: 'Two limits applied while the network was down. A pinned read answers <em>what did I hold when the network stopped</em>, not <em>what do I hold now</em>, and the two were the same only because nothing could move until the restart. And it reads; it does not write. <code>/transaction/construction</code> refused pinned and unpinned alike, so no transaction could be built or submitted, which was the halt working as intended rather than a gap in it.</p>'
          + '<p id="pinned-after-restart">Since the restart at 11:35&nbsp;UTC on 11 September, the ordinary route works again. Read at 03:06&nbsp;UTC on 13 September 2026, an unpinned <code>/state/entity/details</code> answers 200 and <code>/transaction/construction</code> returns a current ledger state, epoch 340,371. The pinned read still answers, and it is now the way to compare an account at the halt with the same account today. Pin to <code>557840627</code>, the last state the ledger committed before the halt (epoch 339,897 round 4, 21:19:48.939&nbsp;UTC), rather than <code>557840622</code>, the last one the Gateway reported. Both return 200.</p>',
      },
    ],
  },
  {
    tagPath: 'contents/tech/research',
    slug: '',
    version: '2.0.1',
    changeType: 'patch',
    sentinel: 'Dan Hughes</a> (1979&ndash;2025)',
    message: 'Sweep 421: infobox gave Dan Hughes as (1974-2025); /contents/history/dan-hughes gives his birth as 24 July 1979, died 27 July 2025 aged 46. Same error was on the History of Radix hub, fixed in the same pass.',
    replacements: [
      { from: 'Dan Hughes</a> (1974&ndash;2025)', to: 'Dan Hughes</a> (1979&ndash;2025)' },
    ],
  },
];

if (JSON.stringify(edits).includes(' ')) throw new Error('script contains a literal U+00A0');

const textNodes = (blocks) => blocks.flatMap((b) => [...(typeof b.text === 'string' ? [b] : []), ...(b.blocks ? textNodes(b.blocks) : [])]);

try {
  for (const e of edits) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(e.sentinel)) {
      console.log(`  ${e.slug || '(hub)'}: already applied, no write`);
      continue;
    }
    for (const r of e.replacements) {
      let hits = 0;
      for (const n of textNodes(blocks)) {
        const count = n.text.split(r.from).length - 1;
        if (!count) continue;
        n.text = n.text.split(r.from).join(r.to);
        hits += count;
      }
      if (hits !== 1) throw new Error(`${e.slug || '(hub)'}: expected 1 match for "${r.from.slice(0, 60)}", found ${hits}`);
    }

    console.log(`  ${DRY ? '[dry] ' : ''}${e.tagPath}/${e.slug}  v${page.version} -> v${e.version}  (${e.replacements.length} replacements)`);
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
