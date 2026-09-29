/**
 * sweep 507 - developers rotation: 06-vault-patterns compiled and run under
 * Scrypto 1.4.0, and the Radix Rust SDK's September work.
 *
 * Run 29 September 2026.
 *
 * 1. 06-vault-patterns. Every snippet pasted into a fresh `scrypto new-package`
 *    (scrypto = "=1.4.0"), `cargo check`, then `scrypto build` + resim publish,
 *    instantiate and call. TokenSale and MultiVault (HashMap entry/or_insert_with)
 *    build and run: two deposits of XRD landed in one vault of 8 XRD.
 *    - "For non-fungibles, use .take_non_fungible(&id)" named a method a plain
 *      Vault does not have: in scrypto 1.4.0 src/resource/vault.rs it is on
 *      ScryptoNonFungibleVault, reached with .as_non_fungible(), and the
 *      plural takes an &IndexSet<NonFungibleLocalId>. Stated.
 *    - The "caller" snippet called account.withdraw from Rust. A component
 *      cannot withdraw from a user's account; the caller is a manifest.
 *      Replaced with the manifest that committed in resim.
 *    - The worktop claim tested both ways: a named bucket left unused is
 *      rejected before execution (DanglingBucket); resources left on the
 *      worktop commit as a failure, DropNonEmptyBucket. Both stated.
 *    - HashMap vs KeyValueStore note added; links inside <pre> unwrapped.
 * 2. radixdlt-rust-sdk. The page said nine tags ending connector-v0.3.1 on
 *    2 Aug, "also the repository's most recent commit". Read via the GitHub
 *    API: connector-v0.3.2 on 19 Sep (request_email), commits 4193537,
 *    c5fe2de, 2e4e5b9, f55f4ca, and c6443bf on 27 Sep (authorized persona
 *    login, under Unreleased in CHANGELOG.md). crates.io still returns
 *    "does not exist" for all five crate names checked.
 *
 * Idempotent per page: skipped if its sentinel is already stored.
 */
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

// VOICE.md bans the em dash: any left in a touched page become spaced en dashes.
const DRY = process.argv.includes('--dry-run');
const REPO = 'https://github.com/genkipool/radixdlt-rust-sdk';
const VAULT_RS = 'https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/scrypto/src/resource/vault.rs';
const KV_RS = 'https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/scrypto/src/component/kv_store.rs';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const unlinkCode = (html) =>
  html.replace(/<pre[\s\S]*?<\/pre>/g, (pre) => pre.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/g, '$1'));

const MANIFEST = [
  'CALL_METHOD Address("${account}") "lock_fee" Decimal("10");',
  'CALL_METHOD Address("${account}") "withdraw" Address("${xrd}") Decimal("100");',
  'TAKE_FROM_WORKTOP Address("${xrd}") Decimal("100") Bucket("payment");',
  'CALL_METHOD Address("${token_sale}") "buy" Bucket("payment");',
  'CALL_METHOD Address("${account}") "deposit_batch" Expression("ENTIRE_WORKTOP");',
].join('\n');

const PAGES = [
  {
    tagPath: 'developers/scrypto',
    slug: '06-vault-patterns',
    sentinel: 'ScryptoNonFungibleVault',
    version: '1.5.0',
    edits: [
      [
        'deposit into the matching vault.</p>',
        'deposit into the matching vault. Compiled and called under Scrypto 1.4.0 on 29 September 2026, two deposits of XRD ' +
          'land in one vault.</p>',
      ],
      [
        '            .put(bucket);\n    }\n}</code></pre>',
        '            .put(bucket);\n    }\n}</code></pre>\n<p>A <code>HashMap</code> sits inside the component\'s state, so every ' +
          'method call reads the whole map. For a collection that grows without limit, a ' +
          `${ext('https://docs.radixdlt.com/docs/data-types/', '<code>KeyValueStore&lt;ResourceAddress, Vault&gt;</code>')} ` +
          `(${ext(KV_RS, 'source')}) stores each entry separately and loads only the entries a call touches.</p>`,
      ],
      [
        'For non-fungibles, use <code>.take_non_fungible(&amp;id)</code> or <code>.take_non_fungibles(&amp;ids)</code> to withdraw specific items.</p>',
        'Withdrawing specific non-fungibles needs a <code>NonFungibleVault</code>: <code>.take_non_fungible(&amp;id)</code> and ' +
          '<code>.take_non_fungibles(&amp;ids)</code>, where <code>ids</code> is an <code>IndexSet&lt;NonFungibleLocalId&gt;</code>, ' +
          `are defined on ${ext(VAULT_RS, '<code>ScryptoNonFungibleVault</code>')} and not on a plain <code>Vault</code>. ` +
          'A component that stores a generic <code>Vault</code> reaches them through <code>.as_non_fungible()</code>:</p>\n' +
          '<pre><code>let nft: NonFungibleBucket = self.vault.as_non_fungible().take_non_fungible(&amp;id);</code></pre>',
      ],
      [
        'This prevents double-spending at the language level:</p>\n<pre><code>// Caller creates a bucket, passes it to the component\n' +
          'let payment: Bucket = account.withdraw(xrd_address, dec!("100"));\n' +
          'let tokens: Bucket = sale_component.buy(payment);\n' +
          "// 'payment' is now consumed \u2013 cannot be used again\naccount.deposit(tokens);</code></pre>",
        'This prevents double-spending at the language level.</p>\n<p>A component cannot withdraw from a user\'s account, so the ' +
          'caller that creates the bucket is a transaction manifest. This one buys from the <code>TokenSale</code> above, and ' +
          'committed in resim under Scrypto 1.4.0:</p>\n<pre><code>' +
          MANIFEST.replace(/&/g, '&amp;') +
          '</code></pre>',
      ],
      [
        'The transaction fails if any resources remain on the worktop at the end.</p>',
        'Leftover resources fail a transaction in two different places, both tested in resim on 29 September 2026. A named bucket ' +
          'that no later instruction uses is rejected before execution, with <code>DanglingBucket</code>, and no fee is charged. ' +
          'Resources left on the worktop get through validation and fail when the transaction ends, as a committed failure with ' +
          '<code>DropNonEmptyBucket</code>, and the fee is paid. The last instruction in the manifest above, ' +
          '<code>deposit_batch</code> with <code>ENTIRE_WORKTOP</code>, is there to empty it.</p>',
      ],
    ],
    message:
      'Compiled and ran every snippet under Scrypto 1.4.0 on 29 September 2026. take_non_fungible(s) is defined on ' +
      'ScryptoNonFungibleVault, not on a plain Vault: stated, with .as_non_fungible() and the IndexSet argument. The caller ' +
      'snippet called account.withdraw from Rust, which a component cannot do; replaced with a manifest that committed in resim. ' +
      'Worktop claim tested both ways (DanglingBucket rejected before execution; leftover worktop commits as DropNonEmptyBucket). ' +
      'HashMap vs KeyValueStore note added; links removed from code blocks. wiki-sweep run 507.',
  },
  {
    tagPath: 'developers/infrastructure',
    slug: 'radixdlt-rust-sdk',
    sentinel: 'loginWithChallenge',
    version: '1.2.0',
    edits: [
      [
        'release train</a> \u2013 nine tags from <code>connector-v0.1.0</code> on 5 July 2026 to <code>connector-v0.3.1</code> on 2 August 2026, ' +
          "the latter also the repository's most recent commit.</p>",
        `release train</a>: ten tags, from <code>connector-v0.1.0</code> on 5 July 2026 to ` +
          `${ext(`${REPO}/releases/tag/connector-v0.3.2`, '<code>connector-v0.3.2</code>')} on 19 September 2026. ` +
          'Queried again on 29 September 2026, the same four names and <code>radixdlt-i18n</code> still return <em>crate does not exist</em>.</p>',
      ],
      [
        '<h2>Radix Connect over iroh</h2>',
        '<h2>Persona data and login</h2>\n' +
          `<p>Work resumed on 19 September 2026 after seven weeks without a commit. ${ext(`${REPO}/commit/4193537`, 'The first change')} ` +
          'lets a dApp ask the wallet for the person\'s email address alongside their name, in the same request, which the user ' +
          'approves in the wallet. The author writes that neither field decides access: the credential is the ' +
          `${ext('https://docs.radixdlt.com/docs/rola-radix-off-ledger-auth', 'ROLA')} signature, and the name and email are labels ` +
          `for an audit log. ${ext(`${REPO}/commit/c5fe2de`, 'A second commit the same day')} made both fields opt-in, because the ` +
          'wallet will not let a user approve a request for specific data without supplying it, so asking by default turns a login ' +
          `into a form. ${ext(`${REPO}/releases/tag/connector-v0.3.2`, 'connector-v0.3.2')} gives the MCP server's account-proof ` +
          'tool a <code>request_email</code> option, off by default.</p>\n' +
          `<p>${ext(`${REPO}/commit/c6443bf`, 'The most recent commit')}, on 27 September, adds an authorized login. A name returned ` +
          'by a one-time data request is a string someone typed and never identifies the persona, so nothing that decides who ' +
          'signed can rest on it. <code>login_request</code> asks the wallet for <code>loginWithChallenge</code>: the persona\'s ' +
          'identity key signs the same challenge the accounts sign, and <code>extract_login</code> returns the identity address ' +
          'with a proof a ROLA verifier accepts unchanged, typed <code>persona</code>. A persona proof typed as an account proof ' +
          'would be checked against a derived account address that no identity key matches, and a valid signature would be ' +
          'rejected. The login requests no persona data. The author reports, from testing on a phone, that a one-time data ' +
          'request the persona cannot fill closes the wallet rather than returning an empty answer. On 29 September the login ' +
          `sits under Unreleased in the ${ext(`${REPO}/blob/main/CHANGELOG.md`, 'changelog')}, and no connector tag carries it.</p>\n<h2>Radix Connect over iroh</h2>`,
      ],
    ],
    splitAt: '<h2>Persona data and login</h2>',
    message:
      'Re-read the repository through the GitHub API on 29 September 2026. The page said the last tag and commit were ' +
      'connector-v0.3.1 on 2 August; connector-v0.3.2 shipped on 19 September (opt-in persona email request, request_email on ' +
      'the MCP account-proof tool) and commit c6443bf on 27 September adds an authorized persona login (loginWithChallenge, ' +
      'persona-typed ROLA proof), still under Unreleased. New section Persona data and login; tag count and crates.io ' +
      're-check updated. wiki-sweep run 507.',
  },
];

const replaceOnce = (haystack, needle, replacement) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`string is not unique: ${JSON.stringify(needle.slice(0, 70))}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

await withClient(async (client) => {
  for (const p of PAGES) {
    if (isLockedPage(p.tagPath, p.slug)) throw new Error(`${p.tagPath}/${p.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [p.tagPath, p.slug],
    );
    if (!rows.length) throw new Error(`${p.slug}: page not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(p.sentinel)) {
      console.log(`  ${page.title}: already applied - no write`);
      continue;
    }
    let blocks = JSON.parse(JSON.stringify(page.content));
    let unlinked = 0;
    for (const b of blocks) {
      if (!b.text) continue;
      const next = unlinkCode(b.text).replace(/\s*\u2014\s*/g, ' \u2013 ');
      if (next !== b.text) unlinked++;
      b.text = next;
    }
    for (const [from, to] of p.edits) {
      const hits = blocks.filter((b) => (b.text || '').includes(from));
      if (hits.length !== 1) throw new Error(`${p.slug}: ${hits.length} blocks hold ${JSON.stringify(from.slice(0, 60))}`);
      hits[0].text = replaceOnce(hits[0].text, from, to);
    }
    // A new section gets its own block: split the block that now opens with it.
    if (p.splitAt) {
      const i = blocks.findIndex((b) => (b.text || '').startsWith(p.splitAt));
      if (i < 0) throw new Error(`${p.slug}: split point not found`);
      const [head, tail] = blocks[i].text.split('<h2>Radix Connect over iroh</h2>');
      if (tail === undefined) throw new Error(`${p.slug}: iroh heading lost`);
      blocks = [
        ...blocks.slice(0, i),
        { ...blocks[i], id: uid(), text: head.trim() },
        { ...blocks[i], text: '<h2>Radix Connect over iroh</h2>' + tail },
        ...blocks.slice(i + 1),
      ];
    }
    const json = JSON.stringify(blocks);
    if (json.includes('\u2014')) throw new Error(`${p.slug}: em dash in the new content`);
    if (json.includes('\u00a0')) throw new Error(`${p.slug}: U+00A0 in the new content`);
    if (blocks.some((b) => (b.text || '').match(/<pre[\s\S]*?<\/pre>/g)?.some((pre) => /<a\b/.test(pre)))) throw new Error('link left inside <pre>');
    assertLinkShapes(blocks, page.title);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${p.version}  (${p.edits.length} edits, ${unlinked} blocks unlinked, ${blocks.length} blocks)`);
    if (DRY) {
      const before = new Set(page.content.map((b) => b.text));
      for (const b of blocks) if (b.text && !before.has(b.text)) console.log('\n----\n' + b.text);
      continue;
    }
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
      [json, p.version, now, page.id],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, p.version, 'minor', AUTHOR_ID, p.message, now],
    );
    await client.query('COMMIT');
  }
});
