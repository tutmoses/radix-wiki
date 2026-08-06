# Subintents Guide

## Source Paths

Rust transaction model paths:

- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/subintent_manifest_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/subintent_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/partial_transaction_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/signed_partial_transaction_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/non_root_subintents_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/child_subintent_hashes_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/hash/mod.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/versioned.rs`

Rust builder, manifest, and validation paths:

- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/transaction_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_namer.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validator_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_structure_validator.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/validation_test_helpers.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/signature_validator.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/subintents/child.rtm`
- `./.repos/radixdlt-scrypto/radix-clis/tests/subintent.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/basic_subintents.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/basic_subintents_part2.rs`

TypeScript workflow paths:

- `./.repos/radix-web3.js/packages/cli/src/subintent.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintent.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintentAssembly.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintentAssembly.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/schemas.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/inspectSignedPartialTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntentV2.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/schemas.ts`
- `./.repos/radix-web3.js/packages/connect/src/schemas/walletInteraction.ts`

## Mental Model

A subintent is a V2 partial transaction subtree. The user-facing wallet term is pre-authorization; the protocol model is a signed partial transaction whose root is a `SubintentV2`.

Keep these boundaries separate:

- `SubintentManifestV2` describes child-capable V2 manifest instructions and is not executable by itself.
- `PartialTransactionV2` stores a root subintent plus flattened non-root subintents.
- `SignedPartialTransactionV2` adds signatures for the root subintent and each non-root subintent.
- A complete root transaction adds signed partial transactions as children, yields to them with `YIELD_TO_CHILD`, and pays fees through the root transaction path.
- Wallet or CLI flows exchange signed partial transaction bytes out of band. The network receives only a complete transaction.

Subintent work is usually a coordination problem, not just a manifest problem. Check the manifest shape, parent/child tree, signatures, hash identity, validation limits, and assembly workflow.

## Examples

Use these examples when a task mentions pre-authorization, signed partial transactions, delegated fees, multi-party signing, child intents, `YIELD_TO_PARENT`, `YIELD_TO_CHILD`, or `VERIFY_PARENT`.

### Decide whether a workflow needs subintents

Use this when a request mentions pre-authorization, delegated fees, atomic multi-party actions, intent-based trading, or a user signing work before the final root transaction exists.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/partial_transaction_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/signed_partial_transaction_v2.rs`
- `./.repos/radix-web3.js/packages/connect/src/schemas/walletInteraction.ts`
- `./references/guide-transactions.md`

Pattern:

1. Ask whether the user signs a complete transaction or a partial subtree.
2. If the signed artifact cannot pay fees or cannot be submitted by itself, model it as a subintent.
3. If the workflow only needs a normal manifest submitted by one wallet or notary, stay in the normal transaction path.
4. If the root submitter pays fees for another user's signed work, inspect both the signed partial transaction and the root transaction assembly.

Rule: do not call every V2 transaction a subintent workflow. V2 is required for subintents, but a V2 root transaction can still have no children.

Done when: the design names the artifact being exchanged: manifest string, transaction intent, signed partial transaction, or notarized transaction.

### Build a subintent manifest

Use this when writing RTM that will be signed as a pre-authorization or partial transaction.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/subintent_manifest_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/subintents/child.rtm`
- `./.repos/radixdlt-scrypto/radix-clis/tests/subintent.rtm`
- `./references/guide-transaction-manifest.md`

Pattern:

```rtm
ASSERT_WORKTOP_IS_EMPTY;
VERIFY_PARENT Enum<AccessRule::AllowAll>();
YIELD_TO_PARENT;
```

Rule: `SubintentManifestV2` implements `BuildableManifestWithParent` and `BuildableManifestSupportingChildren`, but `into_executable_with_proofs` returns an error. Wrap it in a parent test transaction or root transaction before execution.

Rule: use V2-only instructions intentionally. `YIELD_TO_PARENT` belongs in a subintent; `YIELD_TO_CHILD` belongs in a parent manifest that has declared or injected the child.

Done when: the manifest ends with the intended parent yield, does not lock an ordinary root fee, and can be traced to a `SubintentManifestV2` builder or RTM test.

### Build and sign a partial transaction in Rust

Use this when server-side Rust code must create or validate `SignedPartialTransactionV2`.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/transaction_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/partial_transaction_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/signed_partial_transaction_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/signature_validator.rs`

Pattern:

1. Configure the subintent header, optional message, and signed children first.
2. Add children with `add_signed_child` before `manifest` or `manifest_builder`.
3. Build the subintent manifest through `manifest_builder` so child `USE_CHILD` declarations can be injected.
4. Sign the root subintent hash, not the root transaction hash.
5. Build or validate the signed partial transaction before passing it to a root transaction builder.

Rule: `SignedPartialTransactionV2Builder` is an alias for `PartialTransactionV2Builder`. The builder order matters; source comments explicitly warn that calling `add_signed_child` after setting the manifest panics.

Done when: signatures are tied to the prepared subintent hash, children are registered before manifest construction, and `prepare_and_validate` is checked against the transaction validator.

### Prepare and build CLI subintent artifacts

Use this when `rdx subintent prepare` or `rdx subintent build` should create file-backed artifacts for out-of-band signing.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/subintent.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintent.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/schemas.ts`
- `./references/guide-cli.md`
- `./references/cli-command-reference.md`

Pattern:

1. Read a subintent RTM file and subintent header JSON.
2. Build a `SubintentV2` value and hash it through Radix Engine Toolkit.
3. Write `subintent.rtm`, `subintent-header.json`, `subintent.json`, `prepared-subintent.json`, `signing-request.json`, and `signature-template.json`.
4. Import a signature file whose scope is `{ kind: "subintent", subintentId: "root" }`.
5. Compile `SignedPartialTransactionV2` into `signed-partial-transaction.hex`.

Rule: subintent artifact paths are not the same as root transaction artifact paths. `prepared-subintent.json` belongs to the subintent workflow; `prepared.json` belongs to the root transaction workflow.

Done when: tests prove the prepared subintent hash, signature template, signing request scope, and signed partial transaction hex all match the same root subintent.

### Assemble a root manifest with child subintents

Use this when a root transaction must consume one or more signed partial transactions.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/subintentAssembly.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintentAssembly.test.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_namer.rs`

Pattern:

```rtm
USE_CHILD
  NamedIntent("child_one")
  Intent("${subintent_hash}")
;

YIELD_TO_CHILD NamedIntent("child_one");
```

Rule: the CLI assembly path scans `YIELD_TO_CHILD NamedIntent("...")`, injects matching `USE_CHILD` declarations before root instructions, and rejects invalid, missing, or unreferenced child IDs.

Rule: child IDs must match `[A-Za-z][A-Za-z0-9_-]{0,63}` in the CLI assembly implementation. Do not accept arbitrary filenames or free-form labels as child IDs.

Done when: the assembled root manifest has one `USE_CHILD` declaration for every yielded child, no unused child hash, and a preserved child order matching first use.

### Inspect a signed partial transaction

Use this when code receives signed partial transaction hex from a wallet, CLI workflow, or aggregator and needs to validate or display it before assembly.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/inspectSignedPartialTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntentV2.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/schemas.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/signed_partial_transaction_v2.rs`

Pattern:

1. Decompile `SignedPartialTransactionV2` bytes with the intended network ID.
2. Extract the root `SubintentV2`.
3. Re-hash the root subintent and compare id/hex with the expected child hash.
4. Extract Ed25519 signatures with public keys.
5. Count non-root subintents separately from root signatures.

Rule: inspection is not the same as root transaction validation. A valid signed partial transaction can still fail when assembled if parent/child yield counts, reachability, depth, or root transaction semantics are wrong.

Done when: the report names root subintent hash id/hex, signature public keys, non-root subintent count, and the network ID used for decompilation.

### Debug subintent structure validation

Use this when a V2 transaction fails validation after subintents are attached.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validator_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_structure_validator.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/validation_test_helpers.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/basic_subintents_part2.rs`

Pattern:

1. Check duplicate subintent hashes.
2. Check that every declared child is included.
3. Check parent count and reachability from the root transaction intent.
4. Check subintent depth limits.
5. Check `YIELD_TO_CHILD` and `YIELD_TO_PARENT` counts for each subintent.

Rule: structure validation errors are graph errors. Do not debug them by only reading the RTM text; inspect the flattened non-root subintent list and signatures in the transaction model.

Done when: the error is classified as duplicate, multiple-parent, missing-child, unreachable, depth, or yield-count mismatch, and the offending subintent hash or index is named.

### Use wallet pre-authorization schemas

Use this when the browser or connect layer needs to request a wallet pre-authorization rather than submit a normal transaction.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/schemas/walletInteraction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/inspectSignedPartialTransaction.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/signed_partial_transaction_v2.rs`
- `./references/guide-connect.md`
- `./references/guide-wallet-rola.md`

Pattern:

1. Use the `preAuthorizationRequest` interaction item.
2. Put the RTM text in `subintentManifest`, optional blobs/message beside it, and an explicit expiration.
3. Expect the wallet response to include `expirationTimestamp`, `subintentHash`, and `signedPartialTransaction`.
4. Treat the returned signed partial transaction as an input to inspection and root assembly, not as a submitted transaction.

Rule: wallet identity proof and pre-authorization are separate concepts. Use ROLA for identity authentication and signed partial transactions for transaction composition.

Done when: the request schema, response schema, expiration policy, and downstream signed partial transaction inspection are all named in the implementation.

### Read generated subintent scenarios

Use this when source comments are not enough to understand realistic parent/child flow, retries, or resource exchange.

Start with:

- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/basic_subintents.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/basic_subintents_part2.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/basic_subintents/manifests/005--trading_with_subintent.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/basic_subintents/manifests/006--transaction_with_complex_subintent.rtm`

Pattern: prefer scenario source when designing behavior, then use generated RTM to confirm how the scenario is serialized. Scenarios cover successful commit, failed first attempt with later success, nested subintents, timestamp ranges, trading flow, and complex subintent structures.

Rule: a subintent that was not finalized because the root transaction failed can be used again later. Verify this behavior against scenario source and generated receipts before relying on it in product logic.

Done when: the example chosen matches the workflow class and the implementation note cites both the scenario source and the generated manifest or receipt used for confirmation.

## Reference Routes

- RTM instruction syntax: inspect `guide-transaction-manifest.md` before changing instruction names, manifest values, or V2 resource assertions.
- Root transaction lifecycle: inspect `guide-transactions.md` for intent creation, signing, notarization, submission, and polling.
- CLI commands: inspect `guide-cli.md` and `cli-command-reference.md` for exact `rdx subintent` command syntax.
- Wallet pre-authorization request shape: inspect `guide-connect.md` and `walletInteraction.ts`.
- Signed partial transaction inspection: inspect `guide-tx-tool.md` plus `inspectSignedPartialTransaction.ts`.
- Validation errors: inspect Rust validator tests before inventing a new error taxonomy.
- Scenario behavior: inspect `basic_subintents.rs`, `basic_subintents_part2.rs`, and generated examples.

Routing check: choose this guide for subintent-specific tree, signature, pre-authorization, or partial-transaction work; route ordinary RTM syntax to `guide-transaction-manifest.md` and ordinary transaction submission to `guide-transactions.md`.

## Usage Notes

- Treat subintent hashes as the identity of signed partial work. Do not replace them with local file names or user labels.
- Keep root transaction fee payment separate from subintent authorization.
- Register child subintents before building manifests when using Rust builders.
- In CLI workflows, reject missing, invalid, and unused child IDs before writing final transaction artifacts.
- Always verify context-document claims against the Rust transaction model, validator tests, or TypeScript workflow source listed above.
