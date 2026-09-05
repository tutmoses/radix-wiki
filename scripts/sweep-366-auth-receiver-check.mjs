import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'developers/scrypto';
const SLUG = '03-authorization-and-badges';
const SENTINEL = 'InvalidInvokeAccess';
const DRY = process.argv.includes('--dry-run');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const PR = '<a href="https://github.com/radixdlt/radixdlt-scrypto/pull/2093" target="_blank" rel="noopener">radixdlt-scrypto&nbsp;#2093</a>';

const SECTION =
  '<h2>The check below the access rule</h2>'
  + '<p>An access rule answers one question: does the caller hold the badge this method demands. It does not answer a '
  + 'second one &ndash; may the caller reach the object it is calling a method on at all. Until September 2026 the '
  + '<a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> did not ask that question of every '
  + 'invocation, and a pull request opened while <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Mainnet was halted</a> '
  + 'adds it.</p>'
  + '<p>' + PR + ', opened on 2 September 2026 from a branch in Radix’s own repository, introduces a protocol update named '
  + '<strong>Eagle Ray</strong> (<code>logical_name: "eagle-ray"</code>). Its entire content is one flash batch that advances the '
  + '<code>SystemBoot</code> substate to <code>SystemVersion::V5</code>. V5 enables one behaviour, '
  + '<code>should_check_method_receiver_access</code>: before an invocation runs, the kernel tests its visibility of the method’s '
  + 'receiver. A <code>Direct</code> method &ndash; the type used by recall and direct vault access &ndash; needs <em>direct</em> visibility; '
  + 'an ordinary <code>Main</code> or module method needs some visibility; functions and blueprint hooks are unaffected. '
  + 'Anything else fails with a new error, <code>SystemError::InvalidInvokeAccess</code>.</p>'
  + '<p>What makes this a badge story rather than a kernel footnote is the test coverage the same pull request adds to '
  + '<code>radix-engine-tests/tests/system/reference.rs</code>. Passing a typed internal reference to somebody else’s vault into a '
  + 'blueprint function was already legal and still is &ndash; the pre-existing <code>test_internal_typed_reference</code> does exactly that '
  + 'and expects a successful commit, because it recalls a <em>recallable</em> resource under the owner’s signature. The new tests take '
  + 'the same reference and call ordinary vault methods on it through <code>ScryptoVmV1Api::object_call</code>, which demand no '
  + 'recaller badge and no signature:</p>'
  + '<ul>'
  + '<li><code>take_via_normal_call</code> and <code>take_non_fungibles_via_normal_call</code> &ndash; withdraw from a vault the caller does not own;</li>'
  + '<li><code>lock_fee_via_normal_call</code> &ndash; pay the transaction fee out of somebody else’s XRD vault;</li>'
  + '<li><code>forge_proof_via_normal_call</code> &ndash; mint a <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">Proof</a> from a vault the caller does not own;</li>'
  + '<li><code>forge_nft_proof_and_call_gated</code> &ndash; the same, then <code>LocalAuthZone::push</code> the forged proof and call a component whose method runs '
  + '<code>Runtime::assert_access_rule(rule!(require(resource)))</code>.</li>'
  + '</ul>'
  + '<p>Every one of them now fails with <code>InvalidInvokeAccess</code>. The last is the one that matters here: it satisfies a badge-gated '
  + 'access rule with a proof drawn from a badge held in another account. The rule itself never misbehaves &ndash; it is handed a genuine '
  + 'proof of a genuine resource and does what it is told. “Authorised by what you hold” depends on the engine below establishing '
  + 'that the vault a proof came from is one you may reach, and that is the check being added, not an '
  + '<a href="/contents/tech/core-concepts/access-rules-and-auth-zones" rel="noopener">access rule</a> you write.</p>'
  + '<p>Nothing on this page changes as a result. Eagle Ray adds no Scrypto API: badges, proofs, <code>enable_method_auth!</code> and the '
  + 'auth zone are untouched, and a blueprint written against them needs no edit. Nor is any of it live yet. As of 19:00&nbsp;UTC on '
  + '4 September 2026 the pull request is open with no reviews and is not merged; its base branch <code>develop</code> is unchanged at '
  + '<code>858c70f1</code> of 27 March 2026; <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>’s '
  + 'newest release is still v1.3.0.5 of 1 June 2026 and carries no Eagle Ray branch, so no validator has a node version to signal '
  + 'readiness for; <code>docs.radixdlt.com/docs/eagle-ray</code> answers HTTP 404. On '
  + '<a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a>, which is running, the newest protocol-update readiness signal is '
  + 'for <code>cuttlefish-part2</code> on 2 September 2026 &ndash; not <code>eagle-ray</code>. '
  + 'The chronology is on the record and the causation is not: the branch’s earliest commit is dated 31 August 2026 at 22:41&nbsp;UTC, '
  + '82 minutes after the last round Mainnet committed, and the receiver check itself 1 September at 00:12&nbsp;UTC. See '
  + '<a href="/contents/tech/releases/protocol-updates" rel="noopener">Radix Protocol Updates</a>.</p>';

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  // point the existing claim at the new section
  const how = blocks.find((b) => b.text?.includes('there is no manual <code>require(msg.sender == owner)</code> logic'));
  if (!how) throw new Error('How It Works sentence not matched');
  how.text = how.text.replace(
    'there is no manual <code>require(msg.sender == owner)</code> logic.</p>',
    'there is no manual <code>require(msg.sender == owner)</code> logic. That is the whole of the check the Engine has historically '
    + 'made on a method call; a second one, on whether the caller may reach the receiver at all, is being added &ndash; see '
    + '<a href="#receiver-check">The check below the access rule</a>.</p>');

  const idx = blocks.findIndex((b) => b.text?.includes('<h2>Moving Badge-Gated and Restricted Resources</h2>'));
  if (idx === -1) throw new Error('insertion point not found');
  blocks.splice(idx, 0, { id: uid(), type: 'content', text: SECTION.replace('<h2>The check below the access rule</h2>', '<h2 id="receiver-check">The check below the access rule</h2>') });

  // external links
  const ext = blocks.find((b) => b.text?.includes('<h2>External Links</h2>'));
  if (!ext) throw new Error('External Links block not found');
  ext.text = ext.text.replace('</ul>',
    '<li><a href="https://github.com/radixdlt/radixdlt-scrypto/pull/2093" target="_blank" rel="noopener">radixdlt-scrypto #2093</a> '
    + '&ndash; the Eagle Ray receiver-access check, in the repository</li>\n</ul>');

  const version = '2.8.0';
  const metadata = { ...(page.metadata || {}), last_verified_at: new Date().toISOString() };
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (DRY) {
    console.log('\n--- HOW ---\n' + how.text.slice(0, 1200));
    console.log('\n--- NEW SECTION ---\n' + blocks[idx].text);
    console.log('\n--- EXT ---\n' + ext.text);
  } else {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, metadata=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [json, version, JSON.stringify(metadata), now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'New section on the kernel receiver-access check that radixdlt-scrypto PR #2093 (Eagle Ray, SystemVersion V5) adds beneath the access-rule layer this page teaches, read from the diff rather than from a summary. Its own new tests in reference.rs forge a Proof from a vault the caller does not own and use it to pass Runtime::assert_access_rule, which is the badge model failing at a layer no access rule covers. Status recorded precisely: PR open and unmerged, no node release carries it, docs/eagle-ray 404s, and Stokenet’s newest readiness signal is cuttlefish-part2.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
