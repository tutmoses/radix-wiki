/**
 * Sweep 498: the validator fee rises the 27 September Week in Review named, recorded
 * on the pages of the validators that filed them. Read on 27 September 2026:
 *   - txid_rdx1ksxuuge5... (14:35 UTC 23 Sep): update_fee on Radstakes (0.4),
 *     RadixStake (0.2989), Sirius (0.25) and Polaris (0.25), each after
 *     create_auth_badge_proof on the AccessManager holding its owner badge, with
 *     access-key proofs from account_rdx12xly... (three) and account_rdx12xw5... (one).
 *   - txid_rdx1drj805dy... (15:37 UTC 26 Sep): RadixTalk validator metadata rewritten,
 *     update_fee 0.5, update_key, start_unlock_owner_stake_units 242771.
 *   - radix_get_validator at epoch 344,595 (19:04 UTC 27 Sep): Radstakes 93,320,940 XRD
 *     25% -> 40% at 347,421; RadixStake 107,874,076 14.9% -> 29.89% at 347,421;
 *     Sirius 106,120,288 and Polaris 75,955,133, 0% -> 25% at 347,421; RadixTalk
 *     73,048,718 1.5% -> 50% at 348,297, owner badge now in AccessManager
 *     component_rdx1cq60tf... (package_rdx1p4m04..., same as Radstakes's).
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'txid_rdx1ksxuuge5';
const SENTINEL_TALK = 'txid_rdx1drj805dy';

const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;
const TX = 'https://dashboard.radixdlt.com/transaction/txid_rdx1ksxuuge5ca3qc7ghuermxzrey07yz2tjhyffwx4yzfge3ulpg74sm2t92u';
const TX_TALK = 'https://dashboard.radixdlt.com/transaction/txid_rdx1drj805dypsq9jsdyyxhfdsl526pmran653eul4msw7cf3fsxlw6qqfc920';
const V_TALK = 'https://dashboard.radixdlt.com/validator/validator_rdx1s0qzv2vmxydpnglk36mczrdwczpsskuzek2cs5nnld6j533rzatmln';
const AM_TALK = 'https://dashboard.radixdlt.com/component/component_rdx1cq60tf8hv2pgn0q5h7d6kstehdhxwet3jm4sygurwcutuh7a4m972d';

const PAGES = [
  {
    slug: 'radstakes', version: '3.4.0', sentinel: SENTINEL,
    message: 'Radstakes queued a second fee rise, 25% to 40% at epoch 347,421 (about 7 Oct), in one transaction with RadixStake (14.9% to 29.89%) and Sirius and Polaris (0% to 25%), txid_rdx1ksxuuge5... on 23 Sep. Infobox Fee and Stake rows re-read at epoch 344,595 on 27 Sep. Source: Week in Review 2026-09-27.',
    edits: [
      ['<td>25% charged since epoch 335294 (16 August 2026); the stored field still reads 15%</td>',
        '<td>25%, rising to 40% at epoch 347,421 (about 7 October 2026) under a request filed on 23 September</td>'],
      ['93,213,191.72 XRD (rank 17 of 186 registered, 17 Sep 2026)', '93,320,940 XRD (27 Sep 2026)'],
      ['returns the Radstakes logo normally - so the icon the dashboard draws beside this node is served from a domain whose site is gone.</p>',
        `returns the Radstakes logo normally - so the icon the dashboard draws beside this node is served from a domain whose site is gone.</p><h3>A second increase, filed with three others (23 September 2026)</h3><p>At 14:35&nbsp;UTC on 23 September Radstakes queued another rise, from 25% to <strong>40%</strong>, effective at epoch 347,421, about 7 October 2026. It was not filed alone. The ${ext(TX, 'same transaction')} raised ${int('/ecosystem/radixstake', 'RadixStake')} from 14.9% to 29.89% and the two former ${int('/ecosystem/caviarnine', 'CaviarNine')} validators, Sirius and Polaris, from 0% to 25%, all four at the same epoch. Each of the four owner badges is held by an AccessManager component rather than an account, and the transaction reached them by proving access-key badges from two accounts: three from <code>account_rdx12xly&hellip;hju5y77lu</code>, for Radstakes, Sirius and Polaris, and one from <code>account_rdx12xw5&hellip;9ee2frt5</code>, for RadixStake. Whoever filed it held the authority of both.</p><p>Read at epoch 344,595 (19:04&nbsp;UTC, 27 September), Radstakes still charges 25% and holds 93,320,940&nbsp;XRD, and the four validators together hold 383.3m&nbsp;XRD. An increase waits out a 4,032-epoch notice before it applies, which is the window delegators have to unstake or move.</p>`],
    ],
  },
  {
    slug: 'radixstake', version: '3.2.0', sentinel: SENTINEL,
    message: 'RadixStake queued a fee rise from 14.9% to 29.89% at epoch 347,421 (about 7 Oct), in one transaction with Radstakes and the former CaviarNine validators Sirius and Polaris, txid_rdx1ksxuuge5... on 23 Sep. Infobox fee row and new dated paragraph, stake re-read at epoch 344,595. Source: Week in Review 2026-09-27.',
    edits: [
      ['<td>14.9% (effective since epoch 288573; stored factor still reads 1.49%)</td>',
        '<td>14.9%, rising to 29.89% at epoch 347,421 (about 7 October 2026)</td>'],
      ['instead of the one the ledger charges.</p>',
        `instead of the one the ledger charges.</p><h3>The fee doubles in October</h3><p>On 23 September 2026 RadixStake queued a rise from 14.9% to <strong>29.89%</strong>, effective at epoch 347,421, about 7 October. The ${ext(TX, 'transaction')} that filed it also raised ${int('/ecosystem/radstakes', 'Radstakes')} from 25% to 40% and the former ${int('/ecosystem/caviarnine', 'CaviarNine')} validators Sirius and Polaris from 0% to 25%. RadixStake's owner badge sits in an AccessManager component, and the proof that opened it came from <code>account_rdx12xw5&hellip;9ee2frt5</code>, a different account from the one that opened the other three. Read at epoch 344,595 on 27 September, the validator holds 107,874,076&nbsp;XRD and still charges 14.9%.</p>`],
    ],
  },
  {
    slug: 'caviarnine', version: '5.7.0', sentinel: SENTINEL,
    message: 'The 23 Sep fee change on Sirius and Polaris was filed in one transaction with Radstakes (25% to 40%) and RadixStake (14.9% to 29.89%), txid_rdx1ksxuuge5...; stake re-read at epoch 344,595 on 27 Sep (Sirius 106.1m, Polaris 76.0m, down from 113.8m on 25 Sep).',
    edits: [
      ['Delegators who do not want to pay the new fee can unstake or move to another validator before it applies.</p>',
        `Delegators who do not want to pay the new fee can unstake or move to another validator before it applies.</p><p>The ${ext(TX, 'same transaction')} also queued increases for ${int('/ecosystem/radstakes', 'Radstakes')}, from 25% to 40%, and ${int('/ecosystem/radixstake', 'RadixStake')}, from 14.9% to 29.89%, at the same epoch. Read again at epoch 344,595 on 27 September, Sirius held 106.1m&nbsp;XRD and Polaris 76.0m. Polaris has lost a third of its stake in two days, before the fee has applied.</p>`],
    ],
  },
  {
    slug: 'radixtalk', version: '3.1.0', sentinel: SENTINEL_TALK,
    message: 'New section on the RadixTalk validator: on 26 Sep (txid_rdx1drj805dy...) its metadata was rewritten, a fee rise from 1.5% to 50% queued for epoch 348,297 (about 10 Oct), its signing key replaced and 242,771 owner stake units set unlocking; its owner badge has since moved to an AccessManager component. Validator read at epoch 344,595 on 27 Sep. Source: Week in Review 2026-09-27.',
    edits: [
      ['<tr><td><strong>Measured</strong></td>',
        `<tr><td><strong>Validator</strong></td><td>${ext(V_TALK, '<code>validator_rdx1s0q&hellip;j533rzatmln</code>')}, 73.0m XRD; fee 1.5%, rising to 50% about 10 October 2026</td></tr><tr><td><strong>Measured</strong></td>`],
    ],
    insertBefore: '<h2>External Links</h2>',
    block: `<h2>The RadixTalk validator</h2><p>The forum also runs a ${ext(V_TALK, 'validator')} under its name, described on-ledger as the "Official Validator of the RadixTalk Forum". On 27 September 2026 it held 73.0m&nbsp;XRD of delegated stake and charged 1.5% of its delegators' emissions.</p><p>A ${ext(TX_TALK, 'single transaction')} on 26 September changed most of that. It rewrote the validator's name, description, icon and info URL, queued a fee rise from 1.5% to <strong>50%</strong> effective at epoch 348,297, about 10 October 2026, replaced the node's signing key and began unlocking 242,771 of the owner's stake units. The new icon is served from <code>images.cadwynbloc.com</code>, the domain that Sirius and Polaris, the renamed ${int('/ecosystem/caviarnine', 'CaviarNine')} validators, give as their website. By 19:04&nbsp;UTC the next day the owner badge had left the account that signed that transaction for an ${ext(AM_TALK, 'AccessManager component')}, built from the same package as the one that holds the ${int('/ecosystem/radstakes', 'Radstakes')} owner badge.</p><p>At 50% a validator keeps half of every delegator's emissions. A fee increase cannot apply until its 4,032-epoch notice has run, so delegators who do not want to pay it can unstake or move to another validator before about 10 October.</p>`,
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
    let json = JSON.stringify(page.content);
    if (json.includes(p.sentinel)) { console.log(`  ${p.slug}: already applied — no write`); continue; }
    for (const [find, replace] of p.edits) {
      const f = JSON.stringify(find).slice(1, -1);
      const n = json.split(f).length - 1;
      if (n !== 1) throw new Error(`${p.slug}: expected 1 match, got ${n}: ${find.slice(0, 80)}`);
      json = json.replace(f, () => JSON.stringify(replace).slice(1, -1));
    }
    let blocks = JSON.parse(json);
    if (p.block) {
      const i = blocks.findIndex((b) => b.text?.includes(p.insertBefore));
      if (i < 0) throw new Error(`${p.slug}: insert anchor not found`);
      blocks.splice(i, 0, { id: uid(), type: 'content', text: p.block });
      json = JSON.stringify(blocks);
    }
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${p.version}`);
    if (!DRY) {
      const now = new Date().toISOString();
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, p.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, p.version, 'minor', AUTHOR_ID, p.message, now]);
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
