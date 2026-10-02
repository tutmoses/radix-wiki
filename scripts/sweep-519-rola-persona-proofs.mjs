// Sweep 519: /developers/frontend/03-rola-authentication read against @radixdlt/rola 2.1.0's
// shipped dist/rola.js and @radixdlt/radix-dapp-toolkit 2.3.0's index.d.ts, 2 Oct 2026.
// The page said the wallet signs the challenge and the package deletes it. The wallet signs a
// blake2b hash of the challenge, the dApp definition address and the origin, and the package
// never touches storage. It also accepts an unmaterialised address by deriving it from the key,
// and verifies persona proofs, which the page named and never showed.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'developers/frontend';
const SLUG = '03-rola-authentication';
const SENTINEL = 'create-signature-message.ts';
const SRC = 'https://github.com/radixdlt/rola/blob/main/typescript/src';
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const HOW_ID = 'd63b21a5-c2cd-41ab-ba16-e706686e50b1';
const HOW = `<h2>How It Works</h2><ol>`
  + `<li><strong>Backend generates a challenge</strong> – a random 32-byte hex string stored with a 5-minute expiry</li>`
  + `<li><strong>Frontend requests proof</strong> – asks the <a href="/contents/tech/core-protocols/radix-wallet">Radix Wallet</a> for accounts or a persona <em>with proof</em>, and the toolkit attaches the challenge it gets from the generator you registered</li>`
  + `<li><strong>User approves in wallet</strong> – the wallet does not sign the bare challenge. It signs a ${a(`${SRC}/helpers/create-signature-message.ts`, 'blake2b hash')} of the byte <code>R</code>, the challenge, the length and text of your dApp definition address, and your website's origin, using the key behind each account or persona (<a href="https://en.wikipedia.org/wiki/EdDSA#Ed25519" target="_blank" rel="noopener" title="Ed25519 Digital Signature">Ed25519</a> or <a href="https://en.bitcoin.it/wiki/Secp256k1" target="_blank" rel="noopener" title="Secp256k1 Curve">secp256k1</a>). Binding the origin and dApp definition is what stops a proof captured on one site from logging anyone into another</li>`
  + `<li><strong>Frontend sends proof to backend</strong> – the address, its type (<code>account</code> or <code>persona</code>), the challenge, and the public key, signature and curve</li>`
  + `<li><strong>Backend verifies</strong> – <code>verifySignedChallenge</code> ${a(`${SRC}/rola.ts`, 'rebuilds the same hash')} from the <code>expectedOrigin</code> and <code>dAppDefinitionAddress</code> you configured, checks the signature, then asks the Gateway for the address's <code>owner_keys</code> metadata. That metadata holds <em>hashes</em> of public keys, so the check is that the hash of the presented key is among them. If the address has no <code>owner_keys</code> yet, which is the case for an account or persona that has never been touched on ledger, it passes only when the address is the one ${a(`${SRC}/helpers/derive-address-from-public-key.ts`, 'derived from the public key')} itself</li>`
  + `<li><strong>Your code deletes the challenge</strong> – the package checks neither expiry nor reuse, and it never sees your challenge store. Look the challenge up, reject it if expired, and delete it before or as you call <code>verifySignedChallenge</code></li>`
  + `</ol>`;

const PERSONA = `<h3>Proving a persona instead</h3><p>For a login, a persona is often the better thing to prove: it is the identity the user chose to show your dApp, and it stays the same when they share a different set of accounts next time. The builder is <code>DataRequestBuilder.persona().withProof()</code>, and the entry it adds to <code>proofs</code> carries <code>type: 'persona'</code> and the persona's <code>identity_rdx1…</code> address, which <code>verifySignedChallenge</code> handles with no other change.</p><pre><code class="language-typescript">rdt.walletApi.setRequestData(
  DataRequestBuilder.persona().withProof(),
  DataRequestBuilder.accounts().atLeast(1).withProof(),
)</code></pre><p>To re-prove addresses the user has already shared, without asking them to pick again, the one-time builder has <code>OneTimeDataRequestBuilder.proofOfOwnership().identity(identityAddress).accounts([accountAddress])</code>, sent with <code>sendOneTimeRequest(...)</code>.</p>`;

const EDITS = [
  ['const { proofs } = result.value   // one signed challenge per shared account',
    'const { proofs } = result.value   // one signed challenge per shared account or persona'],
  ['do not test it against <code>\'ed25519\'</code> even though Ed25519 is the signature scheme.</p>',
    `do not test it against <code>'ed25519'</code> even though Ed25519 is the signature scheme.</p>${PERSONA}`],
  ['<p data-callout-title>Delete used challenges</p><p>Always delete a challenge after verification – successful or not. This prevents replay attacks where a captured proof is resubmitted.</p>',
    '<p data-callout-title>Delete used challenges</p><p>Always delete a challenge after verification – successful or not. <code>verifySignedChallenge</code> does not do it for you: it has no access to your store, so without this step a captured proof can be resubmitted for as long as the challenge exists.</p>'],
  ['Reference Implementation and Maintenance Status (checked August 2026)', 'Reference Implementation and Maintenance Status (checked October 2026)'],
  ['is at version 2.1.0, published on 20 November 2024, and npm <code>latest</code> has not moved since. It was still downloaded 3,564 times in the month to 24 August 2026.',
    `is at version 2.1.0, published on 20 November 2024, and npm <code>latest</code> has not moved since. Its ${a('https://github.com/radixdlt/rola', 'source repository')} has had no code change since then; its one 2026 commit, on 22 January, switched the npm publish step to OIDC. Downloads rose anyway, to 6,283 in September 2026.`],
];

const DRY = process.argv.includes('--dry-run');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) { console.log('  already applied, no write'); process.exit(0); }
  const blocks = JSON.parse(JSON.stringify(page.content));
  const how = blocks.find((b) => b.id === HOW_ID);
  if (!how?.text.startsWith('<h2>How It Works</h2>')) throw new Error('How It Works block not found');
  how.text = HOW;
  let json = JSON.stringify(blocks);
  for (const [from, to] of EDITS) {
    const f = JSON.stringify(from).slice(1, -1);
    const n = json.split(f).length - 1;
    if (n !== 1) throw new Error(`expected 1 match, found ${n}: ${from.slice(0, 60)}`);
    json = json.split(f).join(JSON.stringify(to).slice(1, -1));
  }
  JSON.parse(json);
  if (/\u2014|\u00a0/.test(json)) throw new Error('em dash or nbsp in output');

  const version = '2.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}, 1 block + ${EDITS.length} edits`);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 519: How It Works corrected against @radixdlt/rola 2.1.0 dist/rola.js. The wallet signs a blake2b hash of R + challenge + dApp definition + origin, not the bare challenge; owner_keys holds key hashes; an unmaterialised address passes by derivation from the public key; the package never deletes or expires a challenge. Persona proofs added (DataRequestBuilder.persona().withProof(), OneTimeDataRequestBuilder.proofOfOwnership()), checked against RDT 2.3.0 index.d.ts. Maintenance status re-read: no rola release or code change since Nov 2024, 6,283 downloads in Sep 2026.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
