// Sweep 527: /ecosystem/stakesafe and /ecosystem/atomix, 3 Oct 2026. The scope check run 524 banked
// after trimming avaunt-staking, read against the 1 Oct 2026 rule (no owner-badge handovers traced
// between private accounts, no per-validator fee or stake figures; link the validator's Radix
// Dashboard page instead).
// StakeSafe: the infobox still carried dated per-validator stake and rank reads, the combined stake,
// the queued fee changes by epoch, and an "Acquired" row resting on the owner-badge account match.
// Those rows go; the acquisition stays, sourced to Avaunt's public announcement, and both production
// validators link to their Dashboard pages. The body's "Validators and fees" section was already in
// that shape.
// Atomix: the fee collector is the dApp's own meter and stays. The paragraph naming the 21 August
// trade as the Avaunt badge sale, with its price, rested on the trace; it now reports the fee and
// the sweep without identifying the trade.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const ROTTERDAM = 'https://dashboard.radixdlt.com/network-staking/validator_rdx1s048k34ctk3m57gumema2e5jmhfxhdryyr5hq42xa9q59pvn8lezg8';
const AMSTERDAM = 'https://dashboard.radixdlt.com/network-staking/validator_rdx1s066xuq885l0mttgmx4ptflte6fepkt0c06mqnqtdgajj4mcwh70q4';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const EDITS = [
  {
    slug: 'stakesafe',
    version: '2.9.0',
    // from the Rotterdam row up to (not including) the Free network tooling row
    cutFrom: '<tr><td><strong>Rotterdam</strong></td>',
    cutTo: '<tr><td><strong>Free network tooling</strong></td>',
    replacement:
      `<tr><td><strong>Fee and stake</strong></td><td>Live on each validator's Radix Dashboard page: ${ext(AMSTERDAM, 'Amsterdam')} · ${ext(ROTTERDAM, 'Rotterdam')}</td></tr>` +
      `<tr><td><strong>Acquired</strong></td><td><a href="/ecosystem/avaunt-staking" rel="noopener">Avaunt Staking</a>'s validator, ${ext('https://t.me/radix_dlt/998993', 'announced by Avaunt on 21 August 2026')}, services migrated 28 August</td></tr>`,
    sentinel: '<strong>Fee and stake</strong>',
    banned: ['81,182,620', '75,944,786', '299,581,425', 'epoch&nbsp;342,482', 'owner badge held'],
    message: 'Sweep 527: scope edit under the 1 Oct 2026 rule. Infobox: removed the dated per-validator stake and rank reads, the combined-stake figure, the queued fee changes by epoch and the owner-badge account match; the acquisition of Avaunt Staking stays, sourced to Avaunt\'s announcement (t.me/radix_dlt/998993), and both validators link to their Radix Dashboard pages for live fee and stake.',
  },
  {
    slug: 'atomix',
    version: '1.3.0',
    cutFrom: '<p>It came back on <strong>21 August 2026</strong>',
    cutTo: '<p>Re-read on 30 September 2026',
    replacement: '<p>It came back on <strong>21 August 2026</strong> with three transactions in forty minutes, the middle one carrying a single fee of <strong>43,689.33&nbsp;XRD</strong>, <strong>210 times</strong> everything the platform had earned in the ten months before it. Twenty minutes later the operator swept the component\'s whole balance, 43,693.83&nbsp;XRD, in a single withdrawal.</p>',
    sentinel: 'the middle one carrying a single fee',
    banned: ['owner badge', '1,456,311', 'sold its validator'],
    after: (t) => t.replace('its last deployment is dated the same afternoon as the sale.', 'its last deployment is dated 21 August.'),
    message: 'Sweep 527: scope edit under the 1 Oct 2026 rule. Fees section: the 21 August fee and the operator\'s sweep stay, read from the dApp\'s own fee collector; the identification of that trade as the sale of the Avaunt Staking validator\'s owner badge, and its price, are removed.',
  },
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

// Return the leaf holding `marker`, walking infobox/columns containers.
function findLeaf(blocks, marker) {
  for (const b of blocks) {
    if (typeof b.text === 'string' && b.text.includes(marker)) return b;
    for (const kids of [b.blocks, ...(b.columns ?? []).map((c) => c.blocks)]) {
      const hit = kids && findLeaf(kids, marker);
      if (hit) return hit;
    }
  }
  return null;
}

try {
  for (const e of EDITS) {
    if (isLockedPage('ecosystem', e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ecosystem', e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (findLeaf(blocks, e.sentinel)) { console.log(`  ${e.slug}: already applied, no write`); continue; }
    const leaf = findLeaf(blocks, e.cutFrom);
    if (!leaf) throw new Error(`${e.slug}: cutFrom not found`);
    const i = leaf.text.indexOf(e.cutFrom), j = leaf.text.indexOf(e.cutTo);
    if (!(j > i)) throw new Error(`${e.slug}: markers out of order ${i} ${j}`);
    const before = leaf.text.length;
    leaf.text = leaf.text.slice(0, i) + e.replacement + leaf.text.slice(j);
    if (e.after) leaf.text = e.after(leaf.text);
    const all = JSON.stringify(blocks);
    for (const bad of e.banned) if (all.includes(bad)) throw new Error(`${e.slug}: still contains ${bad}`);
    if (/—| /.test(e.replacement)) throw new Error('em dash or nbsp in new text');

    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  leaf ${before} -> ${leaf.text.length} chars`);
    if (DRY) { console.log(leaf.text.slice(Math.max(0, i - 200), i + e.replacement.length + 300)); continue; }
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [all, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, all, page.title, e.version, 'minor', AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
