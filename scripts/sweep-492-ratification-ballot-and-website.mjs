// sweep 492: two /ideas cards.
// 1. radix-network-dao-charter – the GP-PRE-1 Governance Proposal read 28 hours in (19:05 UTC
//    26 Sep, vote.radixdao.org/proposal/0: 109 accounts, 900.21m XRD Approve, 0 Reject, 0 Abstain
//    against a 1,350.83m quorum), plus the vote banners radixdlt.com and radixdao.org now carry
//    (t.me/radix_dlt/1005171), which call it a formation vote where the proposal's §4 says it forms
//    nothing. New dated section after "The Governance Proposal opens"; infobox Vote status row.
// 2. dao-website-redesign – the Cloudflare migration has landed: radixdlt.com has Cloudflare
//    nameservers and serves an Astro build (data-astro-cid markup, no Webflow CDN assets) from
//    Cloudflare, read 19:06 UTC 26 Sep. New dated section before Deliverables; infobox Latest row.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const a = (href, label) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;

const CHARTER_SENTINEL = 'id="the-ballot-a-day-in"';
const CHARTER_SECTION = `<h2 ${CHARTER_SENTINEL}>The ballot a day in (26 September 2026)</h2><p>At 19:05 UTC on 26 September, 28 hours into the seven-day ballot, 109 accounts had cast 900m XRD of voting power for GP-PRE-1 and none against or abstaining, on the ${a('https://vote.radixdao.org/proposal/0', 'ballot page')}. That is more than the 875m the Temperature Check drew in five days, from 39 fewer accounts, and 67% of the 1,351m quorum: the proposal needs another 451m by 15:18 UTC on 2 October. The other two thresholds hold while nobody votes against: 66% of decisive votes in favour, and the floor of YES votes at 3.5% of eligible voting power, about 473m when the quorum is 10% of it.</p><p>From 18:06 UTC on 26 September, radixdlt.com and radixdao.org both carry a header on every page linking to the ballot, as Timan (Astrolescent) ${a('https://t.me/radix_dlt/1005171', 'reported in the main Telegram channel')}. Both headers call it the DAO formation vote. The proposal's own section 4 says it does not form the legal entity: it ratifies the framework, and the Transition RAC then forms the company carrying it under the mandate it already holds.</p>`;

const WEBSITE_SENTINEL = 'id="the-site-moves-off-webflow"';
const WEBSITE_SECTION = `<h2 ${WEBSITE_SENTINEL}>The site moves off Webflow (26 September 2026)</h2><p>The migration Governance Proposal 2 approved has landed. Read on 26 September, radixdlt.com's nameservers are Cloudflare's, and the pages checked, its 404 included, are served from Cloudflare as an Astro build of the old Webflow export, loading nothing from Webflow's CDN. The cutover date was never announced; by 5 September projectShift already counted the website among the resources the community runs, ${a('https://t.me/radix_dlt/1002125', 'in the main Telegram channel')}. On 26 September Timan (Astrolescent) added ${a('https://t.me/radix_dlt/1005171', 'a header on every page')} pointing readers to the Charter ratification ballot, covered on the <a href="/ideas/radix-network-dao-charter" rel="noopener">Radix DAO Charter</a> card. The redesign RFC has not moved: it has had no temperature check and no vote.</p>`;

const EDITS = [
  {
    slug: 'radix-network-dao-charter',
    sentinel: CHARTER_SENTINEL,
    version: '2.9.0',
    message: 'GP-PRE-1 read 28 hours into the Governance Proposal (19:05 UTC 26 Sep, vote.radixdao.org/proposal/0): 109 accounts, 900m XRD Approve, none Reject or Abstain, 67% of the 1,351m quorum, above the Temperature Check turnout. New section records it and the vote headers on radixdlt.com and radixdao.org (t.me/radix_dlt/1005171), noting they call it a formation vote where the proposal says it forms nothing. Infobox Vote status updated.',
    apply(blocks) {
      const infobox = blocks.find((b) => b.type === 'infobox').blocks[0];
      const from = 'proposal/0</a> until 15:18 UTC 2 Oct 2026</td>';
      if (!infobox.text.includes(from)) throw new Error('charter infobox anchor not found');
      infobox.text = infobox.text.replace(from, 'proposal/0</a> until 15:18 UTC 2 Oct 2026; 900m for and none against at 19:05 UTC 26 Sep</td>');
      const i = blocks.findIndex((b) => b.text?.includes('id="the-governance-proposal-opens"'));
      if (i < 0) throw new Error('proposal-opens section not found');
      blocks.splice(i + 1, 0, { id: uid(), type: 'content', text: CHARTER_SECTION });
    },
  },
  {
    slug: 'dao-website-redesign',
    sentinel: WEBSITE_SENTINEL,
    version: '1.5.0',
    message: 'radixdlt.com has moved off Webflow: Cloudflare nameservers and an Astro build of the Webflow export served from Cloudflare, read 26 Sep. New dated section before Deliverables, citing t.me/radix_dlt/1002125 and /1005171; infobox Latest row updated. Redesign RFC still unvoted.',
    apply(blocks) {
      const infobox = blocks.find((b) => b.type === 'infobox').blocks[0];
      const m = infobox.text.match(/<tr><th>Latest<\/th><td>.*?<\/td><\/tr>/);
      if (!m) throw new Error('website infobox Latest row not found');
      infobox.text = infobox.text.replace(m[0], '<tr><th>Latest</th><td>26 Sep 2026 &ndash; radixdlt.com is served from Cloudflare as an Astro build of the Webflow export, completing the migration Governance Proposal 2 approved. The redesign itself is still an RFC.</td></tr>');
      const body = blocks.find((b) => b.type === 'content' && b.text.includes('<h2>Deliverables</h2>'));
      if (!body) throw new Error('Deliverables heading not found');
      body.text = body.text.replace('<h2>Deliverables</h2>', `${WEBSITE_SECTION}<h2>Deliverables</h2>`);
    },
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const edit of EDITS) {
    if (isLockedPage('ideas', edit.slug)) throw new Error(`${edit.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ideas', edit.slug]);
    if (!rows.length) throw new Error(`${edit.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(edit.sentinel)) {
      console.log(`  ${edit.slug}: already applied – no write`);
      continue;
    }
    edit.apply(blocks);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${edit.version}`);
    if (DRY) continue;
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, edit.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, edit.version, 'minor', AUTHOR_ID, edit.message, now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
