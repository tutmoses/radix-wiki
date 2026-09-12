/**
 * sweep 417b — protocol-updates: Eagle Ray is no longer "Released, not enacted".
 *
 * Out of rotation (`developers` was this run's slice) but taken here because the run's own
 * evidence settles it and the page is the wiki's canonical record of what protocol version
 * the network runs. /contents/tech/releases/protocol-updates v1.7.1 was written on
 * 10 September 2026 — one day before enactment — and documents Eagle Ray in full as a
 * release awaiting a network. Five claims in it are now false:
 *
 *   infobox "Enacted so far"      stops at Cuttlefish
 *   infobox "Latest enacted"      Cuttlefish, 18 December 2024
 *   infobox "Released, not enacted"  Eagle Ray
 *   infobox "Enactment"           "it enacts unconditionally at epoch 339,898" (future tense)
 *   body                          "Cuttlefish is ... the most recent one enacted"
 *   Eagle Ray section heading     "(Released, September 2026)"
 *
 * And one is a halt-boundary error of the class run 416 banked rather than fixed: the page
 * asserts "Mainnet remains at the ledger it stopped on, state version 557,840,622". It does
 * not. 557,840,622 is where the Gateway's own database had read to; the ledger committed five
 * more states, three of them user transactions, ending at 557,840,627. See /policy/verifiability.
 *
 * Read from the mainnet Gateway on 12 September 2026, not inherited:
 *
 *   557,840,627  epoch 339,897 r4  2026-08-31T21:19:48.939Z  last pre-halt round
 *   557,840,628  epoch 339,897 r5  2026-09-11T11:35:28.960Z  rounds resume, moratorium epoch
 *   557,840,694  epoch 339,898 r2  2026-09-11T11:39:25.129Z  FIRST USER TRANSACTION
 *   live at read epoch 340,179, state version 557,923,055, 11:07 UTC
 *
 *   txid_rdx15cnw85z…ytta86  PermanentlyRejected,
 *     ErrorBeforeLoanAndDeferredCostsRepaid(SystemError(InvalidInvokeAccess))
 *     — V5's new error, returned by Mainnet against a deliberate drain test
 *       (t.me/RadixDevelopers/66392, author Daffy, embed-verified), run against a Vault
 *       Drainer blueprint published at sv 557,842,200 (CommittedSuccess, epoch 339,909).
 *
 * That rejection is the only published proof the flash batch actually took: docs
 * /docs/eagle-ray is still HTTP 404 (re-checked 12 September) and there is no release blog.
 *
 * Stored HTML uses literal U+2019 apostrophes and the literal entity `&ndash;`; asserted
 * zero U+00A0 in the page before writing these find-strings.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'contents/tech/releases';
const SLUG = 'protocol-updates';
const SENTINEL = '557,840,694';
const VERSION = '2.0.0';

const SUBS = [
  // Infobox: four rows.
  [
    '<tr><th>Enactment</th><td>Validator readiness signalling &ndash; 75% of active-set stake, sustained for a required number of consecutive epochs, inside a fixed epoch window. Eagle Ray is the first mainnet exception: it enacts unconditionally at epoch 339,898</td></tr><tr><th>Enacted so far</th><td>Genesis → Anemone → Bottlenose → Cuttlefish</td></tr><tr><th>Latest enacted</th><td>Cuttlefish, 18 December 2024, epoch 160923</td></tr>',
    '<tr><th>Enactment</th><td>Validator readiness signalling &ndash; 75% of active-set stake, sustained for a required number of consecutive epochs, inside a fixed epoch window. Eagle Ray is the first mainnet exception: it enacted unconditionally at epoch 339,898</td></tr><tr><th>Enacted so far</th><td>Genesis → Anemone → Bottlenose → Cuttlefish → Eagle Ray</td></tr><tr><th>Latest enacted</th><td>Eagle Ray, 11 September 2026, epoch 339,898</td></tr>',
  ],
  [
    '<tr><th>Released, not enacted</th><td>Eagle Ray &ndash; candidate 8 September 2026, final release 10 September, configured to enact at epoch 339,898. Dugong carries no trigger on any network</td></tr>',
    '<tr><th>Released, not enacted</th><td>None. Dugong carries no trigger on any network</td></tr>',
  ],
  // Overview: the sequence sentence stops at Dugong-in-development.
  [
    'Subsequent updates follow an alphabetical sea-creature naming scheme: <strong>Anemone</strong>, <strong>Bottlenose</strong>, <strong>Cuttlefish</strong>, and – still in development – <strong>Dugong</strong>.',
    'Subsequent updates follow an alphabetical sea-creature naming scheme: <strong>Anemone</strong>, <strong>Bottlenose</strong>, <strong>Cuttlefish</strong>, <strong>Dugong</strong> – still in development, and skipped – and <strong>Eagle Ray</strong>, enacted on 11 September 2026.',
  ],
  // Cuttlefish is no longer the most recent enacted update.
  [
    'Cuttlefish is the largest post-Babylon update to date and the most recent one enacted.',
    'Cuttlefish is the largest post-Babylon update to date, and was the most recent one enacted until <a href="#eagle-ray-enacted" rel="noopener">Eagle Ray</a> in September 2026.',
  ],
  // The halt-boundary error, in the Eagle Ray section.
  [
    'Mainnet remains at the ledger it stopped on, state version 557,840,622, epoch 339,896, read at 19:06 UTC on 8 September 2026.',
    'Mainnet was still stopped at that point: read at 19:06 UTC on 8 September 2026 the Gateway status endpoint returned state version 557,840,622 at epoch 339,896. That figure is the Gateway\'s own read position, not the ledger\'s &ndash; the chain had in fact committed five more states, ending at <strong>557,840,627</strong> in epoch 339,897 at 21:19:48.939 UTC on 31 August. See <a href="/policy/verifiability" rel="noopener">Verifiability</a>.',
  ],
  // The section heading, and its lead clause.
  [
    '<h2>Eagle Ray (Released, September 2026)</h2>\n<p><strong>Eagle Ray</strong> is the sixth name in the sequence, and the only one so far written while the network it targets was stopped.',
    '<h2 id="eagle-ray-enacted">Eagle Ray (Enacted, September 2026)</h2>\n<p><strong>Eagle Ray</strong> is the sixth name in the sequence, the only one so far written while the network it targets was stopped, and the only one enacted on an epoch number rather than on a vote of the validator set. It went live on mainnet at <strong>epoch 339,898</strong> on 11 September 2026, eleven days after the halt that produced it and four days after the Scrypto release that carried it.',
  ],
];

// The enactment account, appended as its own block after the Eagle Ray section.
const NEW_BLOCK = {
  id: uid(),
  type: 'content',
  text:
    '<h3 id="eagle-ray-enactment">Enactment, read from the ledger</h3>' +
    '<p>The switch is legible in mainnet\'s own transaction stream, and it is worth reading there rather than from a status page, because the moratorium makes "the network is back" two separate events four minutes apart.</p>' +
    '<table><thead><tr><th>State version</th><th>Epoch / round</th><th>Timestamp (UTC)</th><th>What it is</th></tr></thead><tbody>' +
    '<tr><td>557,840,627</td><td>339,897 r4</td><td>2026-08-31 21:19:48.939</td><td>Last round committed before the halt</td></tr>' +
    '<tr><td>557,840,628</td><td>339,897 r5</td><td>2026-09-11 11:35:28.960</td><td>Rounds resume &ndash; inside the user-transaction moratorium</td></tr>' +
    '<tr><td>557,840,694</td><td>339,898 r2</td><td>2026-09-11 11:39:25.129</td><td>First user transaction, on the far side of the fork</td></tr>' +
    '</tbody></table>' +
    '<p>Consensus returned first and carried no user traffic: epoch 339,897 completed under the moratorium, and the fork enacted at the boundary into 339,898 exactly as <code>EnactAtStartOfEpochUnconditionally</code> specifies. The gap between the two reads as sixty-six states and three minutes fifty-six seconds. A node that had not upgraded had nothing to signal and nothing to vote on; the epoch number did the work.</p>' +
    '<p><strong>The only published confirmation that V5 took is a rejected transaction.</strong> <a href="https://docs.radixdlt.com/docs/eagle-ray" target="_blank" rel="noopener">docs.radixdlt.com/docs/eagle-ray</a> still answers HTTP 404, re-checked 12 September 2026, and no release announcement followed. What is on the record instead is a test run in the open: on 11 September a node runner published a Vault Drainer blueprint to mainnet (<a href="https://t.me/RadixDevelopers/66391" target="_blank" rel="noopener">announced in the Radix Developer Discussion group</a>; the publishing transaction committed at state version 557,842,200, epoch 339,909) and <a href="https://t.me/RadixDevelopers/66392" target="_blank" rel="noopener">submitted a draining transaction against it</a>. The Gateway records that transaction as <code>PermanentlyRejected</code> and names the reason:</p>' +
    '<pre><code class="language-text">ErrorBeforeLoanAndDeferredCostsRepaid(SystemError(InvalidInvokeAccess))</code></pre>' +
    '<p><code>InvalidInvokeAccess</code> is the error <code>SystemVersion::V5</code> introduces and nothing before it can return. Mainnet returning it is the receiver check running. See <a href="/developers/scrypto/03-authorization-and-badges#receiver-check" rel="noopener">Authorization and Access Rules</a> for what the check tests, and <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain and network halt</a> for the sequence that produced it.</p>' +
    '<p>Read at 11:07 UTC on 12 September 2026 the network stood at epoch 340,179, state version 557,923,055, and <code>/state/validators/list</code> answered HTTP 200 after returning 500 for the length of the halt.</p>',
};

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG, SLUG)) throw new Error(`${TAG}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG, SLUG]
  );
  if (!rows.length) throw new Error(`page not found: ${TAG}/${SLUG}`);
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied (sentinel present) — no write');
    process.exit(0);
  }

  let hits = 0;
  const walk = (bs) => {
    for (const b of bs) {
      if (typeof b.text === 'string') {
        for (const [from, to] of SUBS) {
          if (b.text.includes(from)) { b.text = b.text.split(from).join(to); hits++; }
        }
      }
      if (Array.isArray(b.blocks)) walk(b.blocks);
      if (Array.isArray(b.columns)) b.columns.forEach((c) => walk(c.blocks || []));
    }
  };
  walk(blocks);
  if (hits !== SUBS.length) {
    throw new Error(`matched ${hits} of ${SUBS.length} find-strings — aborting before any write`);
  }

  const at = blocks.findIndex((b) => b.id === 'd8481573-ecc5-4c57-9b59-25e0b9d0a988');
  if (at < 0) throw new Error('Eagle Ray section block not found — aborting before any write');
  blocks.splice(at + 1, 0, NEW_BLOCK);

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (${hits} substitutions, 1 block inserted at index ${at + 1})`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, VERSION, now, page.id]
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(), page.id, json, page.title, VERSION, 'major', AUTHOR_ID,
        'Eagle Ray enacted. The page was written 10 September, one day early, and carried Eagle Ray as "Released, not enacted" with Cuttlefish as the latest enacted update. Corrected across the infobox, the overview sequence, the Cuttlefish lead and the section heading, and a new section records the enactment from the ledger: last pre-halt round 557,840,627 (31 Aug 21:19:48.939 UTC), rounds resume 557,840,628 (11 Sep 11:35:28.960) inside the moratorium, first user transaction 557,840,694 at epoch 339,898 (11:39:25.129). Also fixes a halt-boundary error: the page asserted 557,840,622 as the ledger position, which is the Gateway\'s read position, five states short. V5 confirmed live by a mainnet transaction permanently rejected with SystemError(InvalidInvokeAccess), the only published confirmation — docs /docs/eagle-ray is still 404.',
        now,
      ]
    );
    await client.query('COMMIT');
  }
} catch (err) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('FAILED:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
