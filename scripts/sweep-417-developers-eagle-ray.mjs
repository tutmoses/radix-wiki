/**
 * sweep 417 — developers rotation: the release the category slept through, and the halt
 * notice a deploy page was still showing.
 *
 * Scrypto v1.4.0 (Eagle Ray) was published on 7 September 2026 and `radix-clis` 1.4.0
 * reached crates.io on 9 September. The `developers` subtree was last touched in bulk on
 * 3 September, so every version claim in it predates the release by days. Three pages
 * carried a claim that the release made false:
 *
 *   01-install-scrypto            tells you to run `cargo install --force radix-clis@1.3.1`
 *                                 and says an unpinned install "resolves to the same 1.3.1".
 *                                 It resolves to 1.4.0 and has since 9 September.
 *   03-deploying                  infobox: "Mainnet status: halted". The halt ended on
 *                                 11 September; run 416 cleared this string out of the
 *                                 `ecosystem` subtree and this page is in a different one.
 *   scrypto/03-authorization-...  "Nor is any of it live yet" — the receiver-access check.
 *                                 It is live, and Mainnet has already refused a vault drain
 *                                 with the exact error the section names.
 *
 * Everything below is read from the source rather than inherited, on 12 September 2026:
 *
 *   crates.io radix-clis        1.4.0 published 2026-09-09T08:06:28Z, 15 downloads;
 *                               1.3.1 325; 1.3.0 4,885 (api/v1/crates/radix-clis)
 *   GitHub scrypto releases     v1.4.0 "Scrypto v1.4.0 (Eagle Ray)" 2026-09-07T17:35:11Z;
 *                               release body is licence boilerplate, no notes
 *   PR #2093                    merged 2026-09-07T17:33:31Z into `develop` — 98 seconds
 *                               before the release was published; `radix-engine/src/
 *                               updates/mod.rs` at the v1.4.0 tag carries `mod eagle_ray`
 *   babylon-node                v1.4.0.0 "Eagle Ray" 2026-09-10T03:59:09Z (RC1 09-08)
 *   install scripts             RADIX_CLI_VERSION=1.3.0 on main, on develop, AND at the
 *                               v1.4.0 tag itself; last commit to the directory 7 Jan 2026
 *   template at v1.4.0          channel = "1.92.0", components rustfmt + rust-src —
 *                               identical to 1.3.1, so the 1.3.0 divergence is unchanged
 *   docs                        /docs/getting-rust-scrypto still documents 1.81.0 and
 *                               radix-clis 1.3.0; /docs/scrypto-v1-4-0 is HTTP 404, where
 *                               /docs/scrypto-v1-3-1 at least exists and says "Content to
 *                               be added"; radixdlt.com/blog/scrypto-1-4-0 is 404 and the
 *                               blog index names neither 1.4.0 nor Eagle Ray
 *   ledger (mainnet Gateway)    557,840,627 epoch 339,897 r4 2026-08-31T21:19:48.939Z last
 *                               pre-halt round; 557,840,628 r5 2026-09-11T11:35:28.960Z
 *                               rounds resume under the moratorium; 557,840,694 epoch
 *                               339,898 r2 2026-09-11T11:39:25.129Z FIRST USER TRANSACTION
 *                               — 3m56s later, so the moratorium is visible as a 66-state
 *                               gap. Live at read: epoch 340,179, sv 557,923,055.
 *   txid_rdx15cnw85z…ytta86     PermanentlyRejected, error_message
 *                               ErrorBeforeLoanAndDeferredCostsRepaid(SystemError(
 *                               InvalidInvokeAccess)) — the Eagle Ray error, on Mainnet,
 *                               against a real drain attempt. Submitted as a deliberate
 *                               test by Daffy (t.me/RadixDevelopers/66392, embed-verified),
 *                               against a Vault Drainer blueprint published at sv
 *                               557,842,200 (txid_rdx1n23…f4a269, CommittedSuccess,
 *                               epoch 339,909, 2026-09-11T12:35:05.915Z).
 *   /state/validators/list      HTTP 200 again (it was 500 for the whole halt)
 *
 * The stored HTML uses the literal entity `&nbsp;`, not U+00A0 — asserted zero U+00A0 in
 * all three pages before writing these find-strings.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');

const EDITS = [
  {
    tag: 'developers/getting-started',
    slug: '01-install-scrypto',
    version: '2.0.0',
    changeType: 'major',
    sentinel: 'radix-clis@1.4.0',
    message:
      'Scrypto v1.4.0 (Eagle Ray), 7 September 2026: radix-clis 1.4.0 reached crates.io on 9 September, so the page\'s install command and its whole Version Pins argument were a release out of date — an unpinned `cargo install radix-clis` no longer resolves to 1.3.1. Re-checked every pin at source on 12 September: the install scripts still set RADIX_CLI_VERSION=1.3.0 on main, on develop and inside the v1.4.0 tag itself; the 1.4.0 template is byte-identical to 1.3.1 so the divergence is unchanged; docs /docs/scrypto-v1-4-0 is 404 and there is no release blog. Downloads 1.4.0 15 / 1.3.1 325 / 1.3.0 4,885.',
    subs: [
      [
        '<code>radix-clis</code> 1.3.0 &ndash; a CLI pin that predates the <a href="https://www.radixdlt.com/blog/scrypto-1-3-1-unlocking-modern-rust-support" target="_blank" rel="noopener">Scrypto 1.3.1</a> release.',
        '<code>radix-clis</code> 1.3.0 &ndash; a CLI pin two releases behind the current <a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">Scrypto v1.4.0</a> of 7 September 2026.',
      ],
      [
        'Install Rust via <a href="https://rustup.rs" target="_blank" rel="noopener">rustup</a>. Scrypto 1.3.1 supports Rust 1.81.0 and newer (tested up to 1.92.0).',
        'Install Rust via <a href="https://rustup.rs" target="_blank" rel="noopener">rustup</a>. Scrypto declares no minimum Rust version in its manifest; what it pins is a toolchain, and <a href="https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/rust-toolchain.toml" target="_blank" rel="noopener">1.4.0\'s <code>rust-toolchain.toml</code></a> names <strong>1.92.0</strong>, as 1.3.1\'s did. Older releases built on 1.81.0, and that number is still what you will meet in the places listed under <em>Version Pins</em> below.',
      ],
      [
        '<pre><code class="language-bash">cargo install --force radix-clis@1.3.1</code></pre><p>Unpinned, <code>cargo install radix-clis</code> resolves to the same 1.3.1; the version is written out here because the official install scripts pin an older one. See <em>Version Pins</em> below.</p>',
        '<pre><code class="language-bash">cargo install --force radix-clis@1.4.0</code></pre><p>Unpinned, <code>cargo install radix-clis</code> resolves to the same 1.4.0, published 9 September 2026 alongside <a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">Scrypto v1.4.0</a>; the version is written out here because the official install scripts pin an older one. See <em>Version Pins</em> below.</p>',
      ],
      [
        '<h2>Version Pins: Which <code>radix-clis</code> You Actually Get</h2><p>The automated scripts and the manual steps do <strong>not</strong> install the same command-line tools, and the difference is silent. Checked at source on 12 August 2026:</p><ul><li><code><a href="https://crates.io/crates/radix-clis" target="_blank" rel="noopener">radix-clis</a></code> published <strong>1.3.1</strong> on 20 January 2026 alongside the <a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.3.1" target="_blank" rel="noopener">Scrypto v1.3.1 release</a>. An unpinned <code>cargo install radix-clis</code> resolves to it.</li><li>The <a href="https://github.com/radixdlt/radixdlt-scrypto/blob/main/scrypto-install-scripts/install-scrypto-macos.sh" target="_blank" rel="noopener">install scripts</a> still set <code>RADIX_CLI_VERSION=1.3.0</code> on both the <code>main</code> and <code>develop</code> branches, while setting <code>RUST_VERSION=1.92.0</code>. Their <a href="https://github.com/radixdlt/radixdlt-scrypto/commits/main/scrypto-install-scripts" target="_blank" rel="noopener">last commit</a> is 7 January 2026 &ndash; thirteen days before 1.3.1 shipped &ndash; although the repository\'s own <code>rust-toolchain.toml</code> carries a checklist of every place a version bump must land and names those script variables explicitly.</li>',
        '<h2>Version Pins: Which <code>radix-clis</code> You Actually Get</h2><p>The automated scripts and the manual steps do <strong>not</strong> install the same command-line tools, and the difference is silent. Re-checked at source on 12 September 2026, five days after <a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">Scrypto v1.4.0 (Eagle Ray)</a>:</p><ul><li><code><a href="https://crates.io/crates/radix-clis" target="_blank" rel="noopener">radix-clis</a></code> published <strong>1.4.0</strong> on 9 September 2026, two days after the GitHub release. An unpinned <code>cargo install radix-clis</code> resolves to it. The previous release, 1.3.1, is of 20 January 2026.</li><li>The <a href="https://github.com/radixdlt/radixdlt-scrypto/blob/main/scrypto-install-scripts/install-scrypto-macos.sh" target="_blank" rel="noopener">install scripts</a> still set <code>RADIX_CLI_VERSION=1.3.0</code>, while setting <code>RUST_VERSION=1.92.0</code>. Not only on <code>main</code> and <code>develop</code>: the <a href="https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/scrypto-install-scripts/install-scrypto-macos.sh" target="_blank" rel="noopener">copy tagged <code>v1.4.0</code></a> carries the same line, so the release ships the lag inside itself. Their <a href="https://github.com/radixdlt/radixdlt-scrypto/commits/main/scrypto-install-scripts" target="_blank" rel="noopener">last commit</a> is 7 January 2026 &ndash; before either of the two releases that have followed &ndash; although the repository\'s own <code>rust-toolchain.toml</code> carries a checklist of every place a version bump must land and names those script variables explicitly.</li>',
      ],
      [
        '<li>The divergence surfaces at <code>scrypto new-package</code>, which writes a <code>rust-toolchain.toml</code> into your project from a bundled template. Under 1.3.0 that template pins <a href="https://github.com/radixdlt/radixdlt-scrypto/blob/v1.3.0/radix-clis/assets/template/rust-toolchain.toml_template" target="_blank" rel="noopener"><code>channel = "1.81.0"</code> with no extra components</a>; under 1.3.1 it pins <a href="https://github.com/radixdlt/radixdlt-scrypto/blob/v1.3.1/radix-clis/assets/template/rust-toolchain.toml_template" target="_blank" rel="noopener"><code>channel = "1.92.0"</code> with <code>rustfmt</code> and <code>rust-src</code></a> &ndash; <code>rust-src</code> being what the 1.3.1 build pipeline needs in order to <a href="https://www.radixdlt.com/blog/scrypto-1-3-1-unlocking-modern-rust-support" target="_blank" rel="noopener">rebuild the Rust standard library with an MVP WebAssembly feature set</a>.</li>',
        '<li>The divergence surfaces at <code>scrypto new-package</code>, which writes a <code>rust-toolchain.toml</code> into your project from a bundled template. Under 1.3.0 that template pins <a href="https://github.com/radixdlt/radixdlt-scrypto/blob/v1.3.0/radix-clis/assets/template/rust-toolchain.toml_template" target="_blank" rel="noopener"><code>channel = "1.81.0"</code> with no extra components</a>; under <a href="https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/radix-clis/assets/template/rust-toolchain.toml_template" target="_blank" rel="noopener">1.4.0 it pins <code>channel = "1.92.0"</code> with <code>rustfmt</code> and <code>rust-src</code></a>, exactly as 1.3.1 did &ndash; <code>rust-src</code> being what the modern build pipeline needs in order to <a href="https://www.radixdlt.com/blog/scrypto-1-3-1-unlocking-modern-rust-support" target="_blank" rel="noopener">rebuild the Rust standard library with an MVP WebAssembly feature set</a>. The template has not changed across the two releases, so the gap the automated installer opens is the same one, a release older.</li>',
      ],
      [
        'So the automated installer sets Rust 1.92.0 as your default, and then your first package quietly builds on 1.81.0 &ndash; the exact pin that <a href="https://www.radixdlt.com/blog/scrypto-1-3-1-unlocking-modern-rust-support" target="_blank" rel="noopener">Scrypto 1.3.1 was released to lift</a>.</li></ul><p>Pin the CLI explicitly if you want the modern toolchain:</p><pre><code class="language-bash">cargo install --force radix-clis@1.3.1</code></pre><p>The official documentation carries the same lag. The <a href="https://docs.radixdlt.com/docs/getting-rust-scrypto" target="_blank" rel="noopener">install and compatibility page</a> that the release announcement points at still documents Rust 1.81.0 and <code>radix-clis@1.3.0</code>, and the <a href="https://docs.radixdlt.com/docs/scrypto-v1-3-1" target="_blank" rel="noopener">v1.3.1 release-notes page</a> that the GitHub release links to reads <em>"Content to be added."</em> Downloads follow the scripts rather than the release: on 12 August 2026 crates.io recorded 304 pulls of 1.3.1 against 4,883 of 1.3.0.</p>',
        'So the automated installer sets Rust 1.92.0 as your default, and then your first package quietly builds on 1.81.0 &ndash; the exact pin that <a href="https://www.radixdlt.com/blog/scrypto-1-3-1-unlocking-modern-rust-support" target="_blank" rel="noopener">Scrypto 1.3.1 was released to lift</a>.</li></ul><p>Pin the CLI explicitly if you want the modern toolchain:</p><pre><code class="language-bash">cargo install --force radix-clis@1.4.0</code></pre><p>The official documentation carries the same lag, and 1.4.0 is documented less than 1.3.1 was. The <a href="https://docs.radixdlt.com/docs/getting-rust-scrypto" target="_blank" rel="noopener">install and compatibility page</a> still documents Rust 1.81.0 and <code>radix-clis@1.3.0</code>, three CLI releases back. <code>docs.radixdlt.com/docs/scrypto-v1-4-0</code> answers HTTP 404, where the <a href="https://docs.radixdlt.com/docs/scrypto-v1-3-1" target="_blank" rel="noopener">v1.3.1 page</a> at least exists and reads <em>"Content to be added."</em> The <a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">GitHub release body</a> is licence boilerplate with no notes, and <a href="https://www.radixdlt.com/blog" target="_blank" rel="noopener">the Radix blog</a> names neither the release nor Eagle Ray. What 1.4.0 contains is legible only from the diff: <a href="https://github.com/radixdlt/radixdlt-scrypto/compare/v1.3.1...v1.4.0" target="_blank" rel="noopener">18 commits over 300 files</a>, among them the <a href="/developers/scrypto/03-authorization-and-badges#receiver-check" rel="noopener">Eagle Ray receiver-access check</a> now enforcing on Mainnet.</p><p>Downloads still follow the scripts rather than the release: on 12 September 2026 crates.io recorded <strong>15</strong> pulls of 1.4.0, three days after publication, against 325 of 1.3.1 and 4,885 of 1.3.0.</p>',
      ],
      [
        '<li><a href="https://www.radixdlt.com/blog/scrypto-1-3-1-unlocking-modern-rust-support" target="_blank" rel="noopener">Scrypto 1.3.1 release blog</a></li>',
        '<li><a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">Scrypto v1.4.0 (Eagle Ray) release</a> &ndash; the current release</li><li><a href="https://www.radixdlt.com/blog/scrypto-1-3-1-unlocking-modern-rust-support" target="_blank" rel="noopener">Scrypto 1.3.1 release blog</a> &ndash; the last release that got one</li>',
      ],
    ],
  },
  {
    tag: 'developers/getting-started',
    slug: '03-deploying',
    version: '3.0.0',
    changeType: 'major',
    sentinel: '557,840,694',
    message:
      'Network restart: the infobox said "Mainnet status: halted" and a danger callout told developers a package upload would not commit. Mainnet resumed on 11 September 2026 — measured from the ledger, not from the status endpoint the old callout quoted: rounds resume at state version 557,840,628 (11:35:28.960 UTC) under an upgrade moratorium, first user transaction 557,840,694 at epoch 339,898 (11:39:25.129 UTC). Live at read: epoch 340,179, state version 557,923,055. /state/validators/list answers 200 again and console.radixscan.io is up.',
    subs: [
      [
        '<tr><td><strong>Mainnet status</strong></td><td>halted &ndash; no round committed since 31 August 2026</td></tr><tr><td><strong>Stokenet status</strong></td><td>live; ledger reset 29 August 2026</td></tr><tr><td><strong>Checked</strong></td><td>4 September 2026</td></tr>',
        '<tr><td><strong>Mainnet status</strong></td><td>live &ndash; transactions resumed 11 September 2026 after a ten-day halt</td></tr><tr><td><strong>Stokenet status</strong></td><td>live; ledger reset 29 August 2026</td></tr><tr><td><strong>Checked</strong></td><td>12 September 2026</td></tr>',
      ],
      [
        '<div data-callout="danger"><div><p data-callout-title>Mainnet is not accepting transactions</p><p>Step 3 below deploys to <strong>Mainnet</strong>, and Mainnet has committed no round since <strong>21:19:06&nbsp;UTC on 31 August 2026</strong>. Read at 19:03&nbsp;UTC on 4 September 2026, the public <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> still returns state version 557,840,622 at epoch 339,896 round 102, and <code>/state/validators/list</code> answers HTTP 500 because its database is 3 days 21 hours behind the ledger. A package upload will not commit. <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> is unaffected and is producing rounds normally, so for the moment the only network you can deploy to is the one with no hosted console. Background: <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain and network halt</a>; live status on <a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">Radix ecosystem operational status</a>.</p></div></div>',
        '<div data-callout="info"><div><p data-callout-title>Mainnet is accepting transactions again</p><p>Step 3 below deploys to <strong>Mainnet</strong>, which was halted for ten days and is not any more. The ledger dates its own restart more precisely than any status page does. Mainnet\'s last pre-halt round is state version <strong>557,840,627</strong>, epoch 339,897 round 4, at 21:19:48.939&nbsp;UTC on 31 August 2026. Rounds resume at <strong>557,840,628</strong> at 11:35:28.960&nbsp;UTC on 11 September &ndash; but under an upgrade moratorium that committed no user transaction, so a package upload would still not have gone through. The first user transaction is <strong>557,840,694</strong>, epoch <strong>339,898</strong> round 2, at 11:39:25.129&nbsp;UTC: three minutes fifty-six seconds later, on the far side of the <a href="/developers/scrypto/03-authorization-and-badges#receiver-check" rel="noopener">Eagle Ray</a> fork. Read at 11:07&nbsp;UTC on 12 September the network stands at epoch 340,179, state version 557,923,055, and <code>/state/validators/list</code> answers HTTP 200 after five hundred-ing throughout the halt. Background: <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain and network halt</a>; live status on <a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">Radix ecosystem operational status</a>.</p></div></div><div data-callout="tip"><div><p data-callout-title>Read the ledger, not the status endpoint</p><p>An earlier version of this page quoted the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a>, which during the halt returned state version 557,840,622 at epoch 339,896 round 102. That is five states short of what the ledger actually committed. The endpoint reports how far the Gateway\'s own database has read, and a Gateway that has fallen behind reports its own position, not the network\'s. Pin a read to a state version through <code>at_ledger_state</code> when the answer matters. See <a href="/policy/verifiability" rel="noopener">Verifiability</a>.</p></div></div>',
      ],
      [
        'Stokenet itself is unaffected, and that is now the load-bearing half of this page: through the Mainnet halt described above the testnet has kept committing rounds, and its Gateway still answers at <a href="https://babylon-stokenet-gateway.radixdlt.com" target="_blank" rel="noopener">babylon-stokenet-gateway.radixdlt.com</a>. It is the hosted web tooling that is gone.',
        'Stokenet was unaffected throughout, and for the ten days of the Mainnet halt that made it the load-bearing half of this page: the testnet kept committing rounds while Mainnet did not, and its Gateway answers at <a href="https://babylon-stokenet-gateway.radixdlt.com" target="_blank" rel="noopener">babylon-stokenet-gateway.radixdlt.com</a> &ndash; epoch 4,311 at state version 8,365,764, read 11:08&nbsp;UTC on 12 September 2026. Both networks take deployments again; it is the hosted Stokenet web tooling that is gone, and that has nothing to do with the halt.',
      ],
    ],
  },
  {
    tag: 'developers/scrypto',
    slug: '03-authorization-and-badges',
    version: '3.0.0',
    changeType: 'major',
    sentinel: 'InvalidInvokeAccess))',
    message:
      'Eagle Ray is live. The section said "Nor is any of it live yet" and argued from babylon-node having no Eagle Ray branch. #2093 merged 7 September 2026 at 17:33:31 UTC, 98 seconds before Scrypto v1.4.0 (Eagle Ray) was published; babylon-node v1.4.0.0 followed on 10 September; the fork enacted at epoch 339,898 on 11 September. Mainnet has since permanently rejected a real vault-drain attempt with ErrorBeforeLoanAndDeferredCostsRepaid(SystemError(InvalidInvokeAccess)) — the error this section describes, quoted from the Gateway.',
    subs: [
      [
        'Nothing on this page changes as a result. Eagle Ray adds no Scrypto API: badges, proofs, <code>enable_method_auth!</code> and the auth zone are untouched, and a blueprint written against them needs no edit. Nor is any of it live yet. As of 19:00&nbsp;UTC on 4 September 2026 the pull request is open with no reviews and is not merged; its base branch <code>develop</code> is unchanged at <code>858c70f1</code> of 27 March 2026; <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>’s newest release is still v1.3.0.5 of 1 June 2026 and carries no Eagle Ray branch, so no validator has a node version to signal readiness for; <code>docs.radixdlt.com/docs/eagle-ray</code> answers HTTP 404. On <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a>, which is running, the newest protocol-update readiness signal is for <code>cuttlefish-part2</code> on 2 September 2026 &ndash; not <code>eagle-ray</code>. The chronology is on the record and the causation is not: the branch’s earliest commit is dated 31 August 2026 at 22:41&nbsp;UTC, 82 minutes after the last round Mainnet committed, and the receiver check itself 1 September at 00:12&nbsp;UTC. See <a href="/contents/tech/releases/protocol-updates" rel="noopener">Radix Protocol Updates</a>.</p>',
        'Nothing on this page changes as a result. Eagle Ray adds no Scrypto API: badges, proofs, <code>enable_method_auth!</code> and the auth zone are untouched, and a blueprint written against them needs no edit. What has changed since this section was first written is that it is now enforcing on Mainnet.</p><h3>From pull request to enacted, in eleven days</h3><p>An earlier reading of this page, at 19:00&nbsp;UTC on 4 September 2026, found the pull request open with no reviews, <code>develop</code> unchanged at <code>858c70f1</code> of 27 March 2026, and <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>’s newest release still v1.3.0.5 of 1 June 2026 with no Eagle Ray branch &ndash; so no validator yet had a node version to signal readiness for. All four of those facts have since been overtaken:</p><ul><li><strong>#2093 merged</strong> into <code>develop</code> at 17:33:31&nbsp;UTC on 7 September 2026, and <a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">Scrypto v1.4.0, named Eagle Ray</a>, was published 98 seconds later. The tag carries <code>mod eagle_ray</code> in <a href="https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/radix-engine/src/updates/mod.rs" target="_blank" rel="noopener"><code>radix-engine/src/updates/mod.rs</code></a>.</li><li><strong>babylon-node v1.4.0.0 (Eagle Ray)</strong> shipped on <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0" target="_blank" rel="noopener">10 September 2026</a>, after an RC1 on 8 September.</li><li><strong>The fork enacted at an epoch boundary, not on a readiness signal.</strong> Mainnet resumed rounds at state version 557,840,628 at 11:35:28.960&nbsp;UTC on 11 September under an upgrade moratorium &ndash; consensus running, no user transaction committed. The first user transaction is state version 557,840,694 at 11:39:25.129&nbsp;UTC, in epoch <strong>339,898</strong>: three minutes fifty-six seconds later, and one epoch on. The moratorium is legible in the ledger as the 66-state gap between the two.</li><li><code>docs.radixdlt.com/docs/eagle-ray</code> still answers HTTP 404, re-checked 12 September 2026. So does <code>/docs/scrypto-v1-4-0</code>. The protocol update reached Mainnet before it reached the documentation.</li></ul><h3 id="invalidinvokeaccess-on-mainnet">The error, on Mainnet, against a real attempt</h3><p>On 11 September a node runner tested the deployed fix in the open, publishing a Vault Drainer blueprint to Mainnet (<a href="https://t.me/RadixDevelopers/66391" target="_blank" rel="noopener">announced in the Radix Developer Discussion group</a>; the publishing transaction committed at state version 557,842,200, epoch 339,909, 12:35:05.915&nbsp;UTC) and then <a href="https://t.me/RadixDevelopers/66392" target="_blank" rel="noopener">submitting a draining transaction against it</a>. The Gateway\'s verdict on that transaction is <code>PermanentlyRejected</code>, and it names the reason:</p><pre><code class="language-text">ErrorBeforeLoanAndDeferredCostsRepaid(SystemError(InvalidInvokeAccess))</code></pre><p>That is the error described above, returned by Mainnet against a live attempt to call a vault method through a reference the caller was not entitled to reach. The check is not a proposal on this page any more; it is the thing standing between a typed internal reference and somebody else\'s vault. The chronology of its authorship remains on the record and its causation remains unstated: the branch’s earliest commit is dated 31 August 2026 at 22:41&nbsp;UTC, 82 minutes after the last round Mainnet committed before the halt, and the receiver check itself 1 September at 00:12&nbsp;UTC. See <a href="/contents/tech/releases/protocol-updates" rel="noopener">Radix Protocol Updates</a> and <a href="/developers/getting-started/01-install-scrypto" rel="noopener">Installing Scrypto</a>, whose pins the release moved.</p>',
      ],
    ],
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

let applied = 0, skipped = 0;
try {
  for (const edit of EDITS) {
    if (isLockedPage(edit.tag, edit.slug)) throw new Error(`${edit.tag}/${edit.slug} is LOCKED`);

    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [edit.tag, edit.slug]
    );
    if (!rows.length) throw new Error(`page not found: ${edit.tag}/${edit.slug}`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(edit.sentinel)) {
      console.log(`  ${edit.slug}: already applied (sentinel present) — no write`);
      skipped++;
      continue;
    }

    let hits = 0;
    const walk = (bs) => {
      for (const b of bs) {
        if (typeof b.text === 'string') {
          for (const [from, to] of edit.subs) {
            if (b.text.includes(from)) { b.text = b.text.split(from).join(to); hits++; }
          }
        }
        if (Array.isArray(b.blocks)) walk(b.blocks);
        if (Array.isArray(b.columns)) b.columns.forEach((c) => walk(c.blocks || []));
      }
    };
    walk(blocks);

    if (hits !== edit.subs.length) {
      throw new Error(`${edit.slug}: matched ${hits} of ${edit.subs.length} find-strings — aborting before any write`);
    }

    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${edit.version}  (${hits} substitutions)`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query(
        'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
        [json, edit.version, now, page.id]
      );
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, edit.version, edit.changeType, AUTHOR_ID, edit.message, now]
      );
      await client.query('COMMIT');
    }
    applied++;
  }
} catch (err) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('FAILED:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
console.log(`${DRY ? '[dry] ' : ''}applied ${applied}, skipped ${skipped}`);
