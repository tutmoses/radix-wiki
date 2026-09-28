/**
 * Sweep 500: the two oldest ecosystem pages by verification age, re-read on 28 September 2026.
 *   - ascent: radix_get_resource live at epoch 344,691 (03:04 UTC 28 Sep): total supply
 *     888,312,759.484262, unchanged since the 11 Aug read. t.me/ascent_xrd 1893 (final ZENITH
 *     podium, AscentRadixBot, 12:00 UTC 30 Aug), 1894 (ShroudSilver: rewards sent, 13:02 UTC),
 *     1896 ("SILVEr | Ascent": mobile controls before the next contest, a second game considered).
 *     No contest announced since. The old closing line claimed the 25 Aug top three were
 *     OVERRIDE's top three; only SKRUTEK was. Replaced with the final podium.
 *   - rly-fun: rly.fun header read in a browser at ~03:10 UTC 28 Sep: 22.2M TVL / 51.0M Vol /
 *     1198 Coins (5 Aug: 26.6M / 51.0M / 1,195). /about fees, curve and caveats unchanged.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const TG = (n) => `https://t.me/ascent_xrd/${n}`;

const PAGES = [
  {
    slug: 'ascent', version: '2.11.0', sentinel: 'ascent_xrd/1893',
    message: 'ZENITH result recorded (VIBES 42,164 / SKRUTEK 34,566 / PLAYER67 15,241, prizes sent 30 Aug, t.me/ascent_xrd/1893-1894), replacing a line that said the 25 Aug top three were OVERRIDE\'s top three (only SKRUTEK was); new Since ZENITH section (no contest since, mobile controls first, t.me/ascent_xrd/1896); total supply re-read on-ledger at epoch 344,691 on 28 Sep, unchanged since 11 Aug.',
    cuts: [
      ['Read from the ledger at epoch 338142', 'almost nothing is going into it.</p>',
        'Read from the ledger on 28 September 2026 (epoch 344,691), total supply stands at <strong>888,312,759.48 ASCENT</strong>, the same figure this page recorded on 11 August. Nothing has been burned in the 48 days since, a period that covered the close of OVERRIDE and the whole of the ZENITH contest. The only burn this page has measured is the 72,376 ASCENT destroyed in the eight days to 11 August, about 0.008% of supply, down from the roughly 888,385,136 recorded on 3 August.</p>'],
      ['The lead changed hands three times', 'alongside the burn figure above.</p>',
        `The contest closed on 30 August with VIBES first on 42,164 points, SKRUTEK second on 34,566 and PLAYER67 third on 15,241, per the ${ext(TG(1893), 'final podium')} posted to the project Telegram, and the developer ${ext(TG(1894), 'reported the prizes sent')} to the winners' wallets the same afternoon. VIBES and SKRUTEK had also placed in OVERRIDE.</p><h3>Since ZENITH</h3><p>No contest has opened since. Asked on 30 August when the next one would start, the developer ${ext(TG(1896), 'replied')} that they wanted to finish and roll out the new mobile controls first, and that they were considering a second game set in the ASCENT universe as a way to add buying pressure on the token.</p>`],
      ['unchanged 11 Aug to 25 Aug 2026;', 'unchanged 11 Aug to 25 Aug 2026;', 'unchanged 11 Aug to 28 Sep 2026;'],
    ],
  },
  {
    slug: 'rly-fun', version: '1.2.0', sentinel: '28 September 2026',
    message: 'Scale re-read from the rly.fun header on 28 Sep: 1,198 coins (from 1,195 on 5 Aug), 22.2M locked (from 26.6M), 51.0M cumulative volume (unchanged); the three launches since named from the live trade feed. Fees, curve and caveats re-read on /about and unchanged.',
    cuts: [
      ['<h2>Scale</h2>', 'near 1M.</p>',
        '<h2>Scale</h2><p>Read on <strong>28 September 2026</strong>, the site\'s own header reported <strong>1,198 coins</strong> launched, total value locked of 22.2M and cumulative volume of 51.0M. The two aggregate figures carry no unit on the page; the platform quotes market caps, its graduation threshold and its live trade feed in XRD, so they are most plausibly XRD-denominated.</p><p>At the previous reading, on 5 August, the header showed 1,195 coins, 26.6M locked and the same 51.0M of volume. Three coins launched in the eight weeks between: NewEra, Operation Trumpo and Radx Reborn, whose buys in the live trade feed ranged from 200 to 10,000 XRD. The coins leading the market-cap list, at up to about 200k, were each launched between one and two years earlier.</p>'],
    ],
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const p of PAGES) {
    if (isLockedPage('ecosystem', p.slug)) throw new Error(`${p.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ecosystem', p.slug]);
    if (!rows.length) throw new Error(`${p.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    const leaves = [];
    const walk = (bs) => bs.forEach((b) => { if (typeof b.text === 'string') leaves.push(b); if (b.blocks) walk(b.blocks); });
    walk(blocks);
    if (leaves.some((b) => b.text.includes(p.sentinel))) { console.log(`  ${p.slug}: already applied – no write`); continue; }
    for (const [start, end, replace] of p.cuts) {
      const hits = leaves.filter((b) => b.text.includes(start));
      if (hits.length !== 1) throw new Error(`${p.slug}: expected 1 block with "${start}", got ${hits.length}`);
      const b = hits[0];
      const i = b.text.indexOf(start);
      const j = b.text.indexOf(end, i);
      if (j < 0) throw new Error(`${p.slug}: end "${end}" not found after "${start}"`);
      b.text = b.text.slice(0, i) + replace + b.text.slice(j + end.length);
    }
    const json = JSON.stringify(blocks);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${p.version}`);
    if (DRY) { leaves.forEach((b) => p.cuts.some(([, , r]) => b.text.includes(r.slice(0, 40))) && console.log('   ', b.text.slice(0, 1500))); continue; }
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, p.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, p.version, 'minor', AUTHOR_ID, p.message, now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
