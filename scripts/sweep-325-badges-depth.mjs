// scripts/sweep-325-badges-depth.mjs
//
// contents/tech/core-concepts/badges was the one genuine stub left in the Semrush
// low-word-count warning (989 characters, three blocks, untouched since June). Its
// siblings in the same category run 4k-11k. This gives it the body they have.
//
// The ledger readings in the infobox and in "Badges nobody holds" were taken from
// mainnet at epoch 339,016 / state version 556,413,233-556,413,448 on 2026-08-28
// via the Gateway `state/entity/details` endpoint. Re-read them before quoting them
// as current; supply on the owner badges moves.
//
// The opening paragraph is also rewritten. The old one ran "is not a distinct engine
// type – it is the convention of…", which is the split-sentence form of the antithesis
// the voice guide bans outright.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'badges';
const SENTINEL = 'Badges nobody holds';
const VERSION = '2.0.0';

const INFOBOX_TABLE = `<table>
<tr><th>Layer</th><td>Core Primitive</td></tr>
<tr><th>Type</th><td>Convention over resources</td></tr>
<tr><th>Defined in</th><td><code>scrypto, radix-engine</code></td></tr>
<tr><th>Checked by</th><td>Access rules, against the transaction auth zone</td></tr>
<tr><th>Presented as</th><td>A proof, valid only within its transaction</td></tr>
<tr><th>Ed25519 signature badge</th><td><code>resource_rdx1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxxed25sg</code></td></tr>
<tr><th>Secp256k1 signature badge</th><td><code>resource_rdx1nfxxxxxxxxxxsecpsgxxxxxxxxx004638826440xxxxxxxxxsecpsg</code></td></tr>
<tr><th>Account owner badges</th><td><code>resource_rdx1nfxxxxxxxxxxaccwnrxxxxxxxxx006664022062xxxxxxxxxaccwnr</code></td></tr>
<tr><th>Ledger reading</th><td>Epoch 339,016 &middot; 28 August 2026</td></tr>
<tr><th>Source</th><td><a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a></td></tr>
</table>`;

const INTRO = `<h2>Introduction</h2>
<p>A <strong>badge</strong> is a <a href="/contents/tech/core-concepts/resources" rel="noopener">resource</a> that a <a href="/contents/tech/core-concepts/components" rel="noopener">component</a> accepts as proof of authority. <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> defines no badge type and no badge opcode. What makes a resource a badge is that an <a href="/contents/tech/core-concepts/access-rules-and-auth-zones" rel="noopener">access rule</a> somewhere names it.</p>
<p>The working distinction is between holding and showing. To move XRD you put it in a <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">bucket</a> and hand the bucket over, and the balance leaves your account. To use a badge you create a <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">proof</a> of it, and the proof is a claim about what a vault contains that the engine checks and then discards. The badge stays where it was. A door pass works the same way: the guard reads it, and you keep it.</p>
<p>Because the thing being shown is an ordinary resource, everything the ledger already guarantees about resources applies to authority too. A badge cannot be copied, cannot be conjured by the component that demands it, and cannot go missing without someone having moved it.</p>`;

const SHOWING = `<h2>Showing, not spending</h2>
<p>Every transaction runs with an <strong>auth zone</strong>, a scratch space holding the proofs presented so far. A <a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">transaction manifest</a> creates a proof from a vault, pushes it into the auth zone, and calls a method. The engine then tests that method&rsquo;s access rule against whatever the auth zone is carrying at that moment.</p>
<p>The rule is a small expression over resource addresses. <code>require</code> names a single badge. <code>require_amount</code> demands a quantity of a fungible one, which is how a component charges for a privilege rather than gating it. <code>require_any_of</code> and <code>require_all_of</code> compose those into m-of-n conditions. The operand is always a resource address, so any resource can gate any method, and one badge can gate methods on components written years apart by people who never spoke.</p>
<p>A proof is scoped to the transaction that made it. It cannot be stored in component state, returned to a caller as a durable capability, or replayed in a later transaction. When the transaction finalizes, the auth zone is emptied. That scoping is what lets an access rule be written as a question about the present moment rather than a ledger of who was granted what.</p>`;

const IMPLICIT = `<h2>Badges nobody holds</h2>
<p>Some badges have no holders and never will. The engine mints proofs of them from facts it already knows about the transaction, and the resource exists to give those facts an address that an access rule can name.</p>
<p>The signature badge is the clearest case. Radix has one per curve: the <strong>EdDSA Ed25519 Signature Resource</strong> at <code>resource_rdx1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxxed25sg</code>, and the <strong>ECDSA Secp256k1 Signature Resource</strong> at <code>resource_rdx1nfxxxxxxxxxxsecpsgxxxxxxxxx004638826440xxxxxxxxxsecpsg</code>. Both read the same way on-ledger: total supply zero, minter <code>deny_all</code>, burner <code>deny_all</code>, and every authority locked against future change. Nobody holds one, and no one can ever issue one.</p>
<p>They are presented constantly. When a transaction is signed, the engine derives a non-fungible id from the hash of the signing public key and places a proof of that id into the auth zone. An <a href="/contents/tech/core-concepts/components" rel="noopener">account</a> component&rsquo;s default rule requires exactly that badge, which is how a signature becomes an authorization without the account ever storing a key. The resource is a name for a property of the transaction, and zero supply is the honest expression of that.</p>
<p>The same construction answers a different question for code. The <strong>Package of Direct Caller Resource</strong>, at <code>resource_rdx1nfxxxxxxxxxxpkcllrxxxxxxxxx003652646977xxxxxxxxxpkcllr</code>, is also supply zero and also unmintable, and a proof of it identifies the <a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">package</a> whose code made the current call. A component can therefore admit calls from one specific body of code and refuse every other caller, human or otherwise.</p>`;

const NATIVE = `<h2>The badges the system issues</h2>
<p>Against those, the badges the system actually hands out have supply, holders, and a mint rule worth reading. <strong>Account Owner Badges</strong> live at <code>resource_rdx1nfxxxxxxxxxxaccwnrxxxxxxxxx006664022062xxxxxxxxxaccwnr</code> and stood at 761 in supply at epoch 339,016. One is issued when an account is created with an owner badge, and holding it grants control over that account component.</p>
<p>Its minter rule is the interesting part. Minting is <code>protected</code>, and the badge it requires is a single specific non-fungible of the Package of Direct Caller Resource described above &ndash; the id naming the account package itself. Only the account package&rsquo;s own code can mint an account owner badge, and that restriction is locked against amendment.</p>
<p>Badges gate badges, in other words, and the recursion bottoms out in the implicit resources the engine controls rather than in a privileged administrator. The same shape governs the owner badges issued for packages, validators and identities.</p>`;

const CONSEQUENCES = `<h2>What the pattern costs</h2>
<p>A badge is a bearer instrument. Whoever holds it has the authority, and a component asked to verify one has no way to distinguish its intended holder from a thief. Losing the badge loses the privilege, permanently, unless recovery was designed in beforehand &ndash; which is the problem the <a href="/contents/tech/core-concepts/access-controller" rel="noopener">Access Controller</a> exists to solve.</p>
<p>Transferability is the same trade seen from the other side. Because badges are resources, they move like resources, so authority is transferable by default. A badge meant to stay put has to be made non-transferable at creation by denying its withdrawer role, and that choice cannot be walked back once the rules are locked.</p>
<p>Babylon formalized the arrangement rather than replacing it. The <a href="/contents/tech/core-concepts/role-assignment-module" rel="noopener">role assignment module</a> gives every component a set of named roles, each mapped to an access rule, so a blueprint declares <em>who may do what</em> once and the badges satisfying those roles can be rotated underneath. The badge remains the credential; the role is the slot it fits.</p>
<p>What the pattern buys is a single vocabulary. Permissions on Radix are not a parallel system bolted beside the asset model &ndash; they are expressed in it, using the same <a href="/contents/tech/core-concepts/asset-oriented-programming" rel="noopener">asset-oriented</a> primitives as tokens, and inheriting the same guarantees against duplication and silent loss.</p>`;

const LINKS = `<h2>External Links</h2>
<ul>
<li><a href="https://docs.radixdlt.com/docs/auth" target="_blank" rel="noopener">Radix Docs: Authorization and badges</a></li>
<li><a href="https://docs.radixdlt.com/docs/access-rules" target="_blank" rel="noopener">Radix Docs: Access rules</a></li>
<li><a href="https://github.com/radixdlt/radixdlt-scrypto/tree/main/scrypto/src/component" target="_blank" rel="noopener">Authorization patterns (scrypto source)</a></li>
<li><a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a></li>
</ul>`;

const EXCERPT = 'A badge is a resource shown as proof of authority: the engine checks a proof of it, then discards the proof, and the badge never moves.';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const existing = JSON.stringify(page.content);
  if (existing.includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const blocks = [
    { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: INFOBOX_TABLE }] },
    { id: uid(), type: 'content', text: INTRO },
    { id: uid(), type: 'content', text: SHOWING },
    { id: uid(), type: 'content', text: IMPLICIT },
    { id: uid(), type: 'content', text: NATIVE },
    { id: uid(), type: 'content', text: CONSEQUENCES },
    { id: uid(), type: 'content', text: LINKS },
  ];

  const metadata = { ...(page.metadata || {}), excerpt: EXCERPT };
  const chars = blocks.reduce((n, b) => n + (b.text?.length || JSON.stringify(b.blocks).length), 0);

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  console.log(`        ${existing.length} chars, ${page.content.length} blocks  ->  ~${chars} chars, ${blocks.length} blocks`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, metadata=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [json, VERSION, JSON.stringify(metadata), now, page.id],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'major', AUTHOR_ID,
       'Give badges the body its sibling core-concept pages have: proofs and the auth zone, the zero-supply implicit resources, the account owner badge mint rule read from mainnet at epoch 339,016, and the bearer-instrument trade-offs.', now],
    );
    await client.query('COMMIT');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('FAILED:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
