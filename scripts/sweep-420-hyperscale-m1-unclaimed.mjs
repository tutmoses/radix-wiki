import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const tg = (id, text) => `<a href="https://t.me/hyperscale_rs/${id}" target="_blank" rel="noopener">${text}</a>`;

const M1_SECTION =
  '<h3 id="milestone-one-not-invoiced">Milestone 1 Delivered and Not Invoiced (12 September 2026)</h3>'
  + '<p>On the evening of 12 September a validator operator posting as Validador GENKIPOOL argued in the channel that the '
  + 'proposal had promised Xi&rsquo;an itself: ' + tg(12415, 'its title names Xi&rsquo;an, it covers staking, and it ends &ldquo;Let&rsquo;s ship Xi&rsquo;an!&rdquo;')
  + '. The lead developer answered that the milestone items had been delivered, and added something the record '
  + 'did not have: ' + tg(12420, '&ldquo;not only is M1 kicked-off but delivered in full (and i am not requesting the $50k payment for reaching that milestone)&rdquo;') + '.</p>'
  + '<p>That answers the question the 3 September subsection above left open. There he dated a Milestone 1 payment from RDX Works '
  + 'to about 10 September and said he had withdrawn before it arrived; he now says he is not asking for it. It is also the first '
  + 'time either party has put a number on a milestone payment: $50,000. His &ldquo;delivered in full&rdquo; is broader than this '
  + 'article&rsquo;s milestone list, which records one Milestone 1 item as deferred: splitting shards on fees, which waits on the fee '
  + 'system. The message does not mention it.</p>'
  + '<p>An hour later he gave a second reason for refusing grants, and this one concerns what happens if Xi&rsquo;an disappoints. '
  + 'If Radix waits for the upgrade instead of working on adoption, and the upgrade then does nothing for holders, '
  + tg(12470, '&ldquo;the next inevitable step will be the asking of &lsquo;who profited?&rsquo; and if the answer is &lsquo;foxy&rsquo; then i will have to deal with an enormous amount of anger and fallout&rdquo;')
  + '. Earlier in the same exchange he said he was not sure Radix usage reaches one transaction per second, which makes it '
  + tg(12416, '&ldquo;the furthest away network from needing something like hyperscale&rdquo;') + '.</p>'
  + '<p>He declined to give dates. The milestones ' + tg(12448, '&ldquo;will be correct&rdquo;')
  + ' and keep their order, though the VM work is much larger than the RFC assumed and migration preparation will likely grow with it. '
  + 'He expects the project to reach feature-complete '
  + tg(12433, '&ldquo;faster than people think possible (even despite big shifts in the plan like needing to build a whole new VM)&rdquo;')
  + ', and would not estimate how long after that he would recommend any network adopt it, because '
  + tg(12435, '&ldquo;all these hacks are very much reinforcing the need to be 100% bullet-proof&rdquo;')
  + '. Each message is confirmed as his at its own public embed.</p>';

const edits = [
  {
    tagPath: 'contents/tech/research',
    slug: 'hyperscale-rs',
    version: '6.28.0',
    changeType: 'minor',
    sentinel: 'milestone-one-not-invoiced',
    message: 'Sweep 420: Milestone 1 delivered and not invoiced. On 12 September 2026 (hyperscale_rs 12420, 21:18 UTC) the lead developer said M1 is delivered in full and he is not requesting the $50k payment for it, which closes the pending RDX Works payment the 3 September subsection dated to ~10 September. Adds his second reason for refusing grants (12470), usage under 1 TPS (12416), and the no-dates position on milestones and feature-complete (12433, 12435, 12448). All messages authorship-verified at their embeds.',
    replacements: [
      {
        from: 'the route is real and he would walk it with them.</p>',
        to: 'the route is real and he would walk it with them.</p>' + M1_SECTION,
      },
      {
        from: 'are not recorded here.</p>',
        to: 'are not recorded here. On 12 September the developer stated the figure himself; see <a href="#milestone-one-not-invoiced">Milestone 1 Delivered and Not Invoiced</a>.</p>',
      },
    ],
  },
  {
    tagPath: 'contents/history',
    slug: 'hyperlane-asset-drain-2026',
    version: '3.2.2',
    changeType: 'patch',
    sentinel: 'by that evening it had halted as well',
    message: 'Sweep 420: tense fix left over from the halt. "and it is halted besides" described the ledger in the present tense inside a 31 August reading; mainnet restarted on 11 September.',
    replacements: [
      { from: 'and it is halted besides.', to: 'and by that evening it had halted as well.' },
    ],
  },
];

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
      console.log(`  ${e.slug}: already applied, no write`);
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
      if (hits !== 1) throw new Error(`${e.slug}: expected 1 match for "${r.from.slice(0, 60)}", found ${hits}`);
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
