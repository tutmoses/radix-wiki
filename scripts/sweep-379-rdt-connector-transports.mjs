/**
 * Run 379 (developers rotation).
 *
 * Two changes to /developers/frontend/01-radix-dapp-toolkit:
 *
 * 1. The Chrome Web Store link for the Radix Wallet Connector carried the
 *    extension id bfeplaecgkoeckiidkgkmlllfbaanlkl. That id does not exist:
 *    the store redirects it to /detail/empty-title/<id> and answers HTTP 200
 *    with a 513,817-byte store shell, so check-links has always read it as
 *    healthy. The real id, linked from wallet.radixdlt.com and already used on
 *    the /developers hub, is bfeplaecgkoeckiidkgkmlllfbaeplgm.
 *
 * 2. A new "Reaching the wallet" section. On 6 September the hyperscale_rs
 *    channel was asked what /developers lacks and answered with the signing
 *    surface: how a Ledger reaches the wallet (12091, 12093, 12095, 12096) and
 *    how many confirmations a session costs (12097, 12098). The page described
 *    only the desktop extension path and never named the mobile deep link, the
 *    Ledger dependency, or pre-authorizations.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'developers/frontend';
const SLUG = '01-radix-dapp-toolkit';
const BAD_ID = 'bfeplaecgkoeckiidkgkmlllfbaanlkl';
const GOOD_ID = 'bfeplaecgkoeckiidkgkmlllfbaeplgm';
const SENTINEL = '<h2>Reaching the wallet</h2>';

const SECTION = `<h2>Reaching the wallet</h2>
<p>RDT gives your code one interface and runs two transports underneath it. In a desktop browser it reaches the wallet through the <a href="https://chromewebstore.google.com/detail/radix-wallet-connector/${GOOD_ID}" target="_blank" rel="noopener">Radix Wallet Connector</a>, a Chrome extension the user links to their phone by opening the wallet app, tapping <em>Linked Connectors</em>, and scanning a QR code. In a mobile browser there is no extension at all: RDT opens the wallet app on the same device through a deep link. The toolkit&rsquo;s own <a href="https://github.com/radixdlt/radix-dapp-toolkit/blob/main/packages/dapp-toolkit/README.md" target="_blank" rel="noopener">README</a> states the split in a sentence, and <a href="https://wallet.radixdlt.com" target="_blank" rel="noopener">the wallet setup guide</a> is where users meet it: phone users are told they are ready to go, desktop users are told to install the extension first.</p>
<h3>Ledger goes through the extension</h3>
<p>The Connector is also how a <a href="https://www.ledger.com/" target="_blank" rel="noopener">Ledger</a> hardware wallet reaches the Radix Wallet. Both the setup guide and the <a href="https://chromewebstore.google.com/detail/radix-wallet-connector/${GOOD_ID}" target="_blank" rel="noopener">store listing</a> say so in the same words: the Connector enables use of Ledger hardware wallet devices. A Radix user who signs with a Ledger therefore needs the desktop browser as well as the phone, because the phone-only path carries no Connector. If your dApp expects hardware-wallet users, it is a desktop dApp.</p>
<p>The extension is at version 1.7.0, updated on 16 April 2026, published by radixdlt.com and installed by around 20,000 users; <a href="https://github.com/radixdlt/connector-extension" target="_blank" rel="noopener">its repository</a> last took a commit the following day and is not archived. That is six weeks after RDT&rsquo;s own last release, so the transport moved after the library stopped.</p>
<h3>Signing once for a transaction someone else finishes</h3>
<p>Every <code>sendTransaction</code> call ends at a prompt the user has to approve, so a flow built from several calls costs several approvals. <a href="/contents/tech/core-concepts/subintents-and-pre-authorizations" rel="noopener">Pre-authorizations</a>, the user-facing name for subintents, are the protocol&rsquo;s answer: the user signs a partial transaction that another actor completes and submits. They reached mainnet in the <a href="/contents/tech/releases/protocol-updates" rel="noopener">Cuttlefish</a> protocol update in December 2024, and RDT exposes them as <code>sendPreAuthorizationRequest</code> alongside <code>sendTransaction</code>.</p>
<p>The shape is different from a normal request. Your dApp sends a manifest stub with an expiry schedule rather than a complete manifest; the stub locks no fee, because the enclosing transaction pays, and it ends with <code>YIELD_TO_PARENT</code>. The wallet returns a hex-encoded <code>SignedPartialTransaction</code>, which your front end passes to a back end that builds it into a full transaction and submits it. Radix&rsquo;s <a href="https://docs.radixdlt.com/docs/pre-authorizations-and-subintents" target="_blank" rel="noopener">documentation for the flow</a> notes that no general subintent aggregator existed at the Cuttlefish launch, so today that back end is usually the dApp&rsquo;s own or a named matcher such as <a href="/ecosystem/anthic" rel="noopener">Anthic</a>.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  let idFixes = 0;
  for (const b of blocks) {
    if (b.text?.includes(BAD_ID)) { b.text = b.text.split(BAD_ID).join(GOOD_ID); idFixes++; }
  }
  if (!idFixes) throw new Error('bad extension id not found — page moved on, re-inspect');

  const at = blocks.findIndex((b) => b.text?.includes('<h2>Wallet Connection &amp; Authentication</h2>')
    || b.text?.includes('<h2>Wallet Connection & Authentication</h2>'));
  if (at < 0) throw new Error('anchor section not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '1.5.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  extension-id fixes: ${idFixes}; section inserted at index ${at + 1}; blocks ${page.content.length} -> ${blocks.length}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Fix the Radix Wallet Connector store link, which carried a non-existent extension id that the store answers 200 for, and add a Reaching the wallet section covering the desktop extension and mobile deep-link transports, the Ledger dependency on the Connector, and pre-authorizations. Sources: the dApp Toolkit README, wallet.radixdlt.com, the Chrome Web Store listing, and the pre-authorizations documentation.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
