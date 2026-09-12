// sweep-418: the halt-boundary LABEL, on the five pages that still get it wrong.
//
// Run 416 measured the boundary and corrected it at source; run 417 fixed one
// carrier. The rest are here. State version 557,840,622 is what the Gateway's
// STATUS endpoint reported for the whole outage; the ledger's own last pre-halt
// state is 557,840,627 (epoch 339,897 round 4, 2026-08-31T21:19:48.939Z), five
// states and forty-two seconds further on. Re-verified this run from POST
// /stream/transactions with kind_filter All, from_ledger_state 557,840,626:
//   557,840,626  ep339897 r1  2026-08-31T21:19:48.939Z  (last USER transaction)
//   557,840,627  ep339897 r4  2026-08-31T21:19:48.939Z  (last state, round change)
//   557,840,628  ep339897 r5  2026-09-11T11:35:28.960Z  (consensus resumes)
//
// The PINNED READS are sound and stay pinned. Only the label changes — plus the
// three places where the restart falsified a "and there it stays" clause.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const NBSP = ' ';

const EDITS = [
  {
    tagPath: 'ecosystem', slug: 'dan', version: '1.2.1',
    sentinel: 'five states further on',
    from: 'Read at state version 557,840,622 &ndash; the last state Radix mainnet committed before <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">it halted on 31 August 2026</a>, so these are the ledger&rsquo;s final figures rather than a live reading &ndash; the resource',
    to: 'Read at state version 557,840,622 &ndash; a <a href="/contents/tech/core-protocols/radix-gateway-api#pinned-reads" rel="noopener">pinned read</a> taken while <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">the network was halted</a>, so these are the figures as they stood on 31 August 2026 rather than a live reading; mainnet restarted on 11 September and the ledger&rsquo;s own last pre-halt state was 557,840,627, five states further on &ndash; the resource',
    message: 'Corrected the halt-boundary label: 557,840,622 is the Gateway status endpoint’s position, not the ledger’s last pre-halt state (557,840,627, epoch 339,897 round 4, verified from /stream/transactions). Dropped "the ledger’s final figures", which the 11 September restart falsified. The pinned read itself is unchanged and its results stand.',
  },
  {
    tagPath: 'ecosystem', slug: 'easymoon', version: '2.3.1',
    sentinel: 'five states short of the ledger',
    from: 'Read pinned at state version 557,840,622, the last ledger state before <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">the network halt of 31 August 2026</a>:',
    to: 'Read pinned at state version 557,840,622, a position recorded during <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">the network halt of 31 August 2026</a> and five states short of the ledger&rsquo;s own last pre-halt state, 557,840,627:',
    message: 'Corrected the halt-boundary label: 557,840,622 is where the Gateway status endpoint stopped, not the last ledger state before the halt (557,840,627, verified from /stream/transactions). The pinned read is unchanged.',
  },
  {
    tagPath: 'ecosystem', slug: 'defiplaza', version: '3.3.1',
    sentinel: '21:19:48' + NBSP + 'UTC, at state version 557,840,627',
    from: 'Radix mainnet stopped committing transactions on 31 August 2026 at 21:19 UTC, at state version 557,840,622, and had <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">not restarted eight days later</a>.',
    to: 'Radix mainnet stopped committing transactions on 31 August 2026 at 21:19:48' + NBSP + 'UTC, at state version 557,840,627, and did <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">not restart until 11 September 2026</a>.',
    message: 'Corrected the halt boundary in the lead of the halt-reading section: the ledger stopped at state version 557,840,627 at 21:19:48.939 UTC, not at 557,840,622, which is where the Gateway status endpoint stopped. Replaced the open-ended "had not restarted eight days later" with the restart date. The pinned pool read later in the section is unchanged.',
  },
  {
    tagPath: 'ecosystem', slug: 'delay', version: '1.2.2',
    sentinel: 'burning is open to anyone again',
    from: 'That is the supply as it stood at 21:19:06 UTC on 31 August 2026 and it is where it will stay: burning is open to anyone, but nothing burns on a ledger that is not committing rounds.',
    to: 'That is the supply as it stood at 21:19:06' + NBSP + 'UTC on 31 August 2026. Nothing could burn while the ledger was stopped; it <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">restarted on 11 September 2026</a>, so burning is open to anyone again and the figure is no longer fixed.',
    message: 'The 11 September restart falsified "it is where it will stay". The pinned read at state version 557,840,622 and its supply figure are unchanged; what changed is that the supply can move again.',
  },
  {
    tagPath: 'contents/history', slug: 'hyperlane-asset-drain-2026', version: '3.2.1',
    sentinel: 'five states short of 557,840,627',
    from: 'Every figure in this section is read from the Gateway pinned to state version 557,840,622, the last one the ledger reached, which is the only way to ask it anything <a href="/contents/tech/core-protocols/radix-gateway-api#pinned-reads" rel="noopener">while the network is halted</a>.',
    to: 'Every figure in this section is read from the Gateway pinned to state version 557,840,622, the position its status endpoint reported throughout the outage and five states short of 557,840,627, the last one the ledger reached; a <a href="/contents/tech/core-protocols/radix-gateway-api#pinned-reads" rel="noopener">pinned read</a> was the only way to ask it anything while the network was halted.',
    message: 'This page’s own halt section gives the boundary as state version 557,840,627 and explains that the Gateway status endpoint stopped five states short at 557,840,622; this section still called 557,840,622 "the last one the ledger reached", contradicting it. Corrected, and past-tensed "while the network is halted".',
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

// The U+00A0 trap cuts both ways: a find-string that picked up a non-breaking
// space from the editor silently matches nothing. Assert the find-strings are
// clean before anything touches the database.
for (const e of EDITS) {
  if (e.from.includes(NBSP)) throw new Error(`${e.slug}: find-string carries U+00A0`);
}

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied — no write`);
      continue;
    }
    let hits = 0;
    for (const b of blocks) {
      if (typeof b.text !== 'string' || !b.text.includes(e.from)) continue;
      b.text = b.text.split(e.from).join(e.to);
      hits += 1;
    }
    if (hits !== 1) throw new Error(`${e.slug}: expected 1 match, found ${hits}`);

    console.log(`  ${DRY ? '[dry] ' : ''}${e.tagPath}/${e.slug}  v${page.version} -> v${e.version}`);
    if (DRY) continue;

    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, 'patch', AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
