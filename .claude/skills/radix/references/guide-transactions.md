# Transactions Guide

## Source Paths

TypeScript source roots:

- `./.repos/radix-web3.js/packages/tx-tool/src`
- `./.repos/radix-web3.js/packages/core/src/transaction`
- `./.repos/radix-web3.js/packages/core/src/manifests`

Rust source roots:

- `./.repos/radixdlt-scrypto/radix-transactions/src`
- `./.repos/radixdlt-scrypto/radix-common/src/data/manifest`
- `./.repos/radixdlt-scrypto/radix-engine-toolkit-common/src/receipt`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/static_resource_movements`

## Mental Model

A Radix transaction workflow is a pipeline:

1. build or receive a manifest string
2. optionally add fee payer or auth instructions
3. create an intent with header, message, blobs, and manifest
4. statically validate or analyze it
5. sign intent hashes with account/notary keys
6. compile/notarize transaction bytes
7. submit to Gateway
8. poll status until committed, rejected, failed, or timed out

V1 transactions are the common baseline. V2 is required for subintents and pre-authorization flows.

## Examples

Use these examples to move between TypeScript lifecycle code and Rust transaction semantics. For raw RTM instruction syntax, manifest values, worktop/proof instructions, address allocation, or subintent manifest shape, read `./references/guide-transaction-manifest.md` first.

### Preview, sign, submit, and poll a standard V1 transaction

Use this when implementing the ordinary happy path before adding V2, subintent, or custom signer behavior.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntent.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/compileTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/submitTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionStatus.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`

Pattern:

1. Build or receive a manifest string.
2. Let `CreateTransactionIntent` or `CreateTransactionIntentV2` decode the manifest and call `StaticallyValidateManifest`.
3. Create a V1 intent with header, message, blobs, and network ID.
4. Sign the intent hash with account signer and notary signer.
5. Compile/notarize transaction bytes.
6. Submit bytes through Gateway.
7. Poll status until the transaction leaves `Pending`.

Rule: keep the happy path boring and explicit before adding retry, hooks, fee payer injection, or V2 branching. Tests should prove network ID, signer public key, notary key, epoch window, and static manifest validation are wired into the transaction model.

Done when: the application-level result shape is explicit. `TransactionHelper.submitTransaction` returns `{ id, statusResponse }` after a successful `CommittedSuccess` poll; lower services expose compile, submit, and status behaviors separately and should not be documented as if they all return the same shape.

### Debug a transaction that submits but does not commit

Use this when Gateway accepts transaction bytes but polling ends in failure, rejection, or timeout.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/submitTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionStatus.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/compiler.rs`

Pattern:

1. Check network ID, epoch bounds, nonce, and notary key.
2. Check signature collection and compile/notarize output.
3. Check `onSubmit`, Gateway submission, `onSubmitSuccess`, polling, `onStatusFailure`, and `onSuccess` in that order.
4. Only then inspect manifest semantics and engine validation.

Done when: the failure is classified as pre-submit construction, Gateway submission, unresolved polling, committed failure, permanent rejection, or timeout, and the report names the first boundary where expected state diverged.

### Build a V1 transaction intent

Use this when building standard transactions without subintents.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntent.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHeader.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/schemas.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/intent.rs`

Pattern: convert a manifest string into a transaction intent with header, message, and blobs. Keep schema transformations in `schemas.ts`; keep header defaults in the header service.

Done when: tests or source inspection prove the manifest was statically validated, the network ID and epoch window come from the intended services, and the intent hash is derived from the same intent that is later signed.

### Build a V2 transaction or subintent workflow

Use this when the task mentions subintents, pre-authorizations, partial transactions, or child intents.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntentV2.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHeaderV2.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/inspectSignedPartialTransaction.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintent.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`

Pattern: verify both sides of the workflow: TypeScript builds and inspects signed partial transactions, while Rust defines `TransactionManifestV2` and `SubintentManifestV2` semantics.

Done when: the V2 path is explicit in code and tests cover subintent-specific behavior such as child references, signed partial inspection, and V2 header/message differences from V1.

### Add or debug manifest string generation

Use this when a helper emits RTM text or when an RTM instruction fails to compile.

Start with:

- `./.repos/radix-web3.js/packages/core/src/manifests/sendResourceManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/manifestHelper.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/compiler.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/tests/test_manifest_compiler_error_diagnostics.rs`

Pattern: use `./references/guide-transaction-manifest.md` and Rust source for instruction names and argument shapes. Add TypeScript tests that compile or statically validate the generated manifest where possible.

Done when: the emitted RTM is compared against Rust examples or builder source, and at least one local test proves the helper output compiles, validates, or reaches the package's static analysis boundary.

### Add fee payer or costing behavior

Use this when the transaction needs fee payer injection, XRD balance checks, or lock-fee diagnosis.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/addFeePayer.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/manifestHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/e2e.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/transaction/transaction_receipt.rs`
- `./references/guide-costing-fees.md`

Pattern: distinguish fee-lock manifest instructions from Gateway or engine costing results. Use `guide-costing-fees.md` when the question depends on fee reserve, contingent fee, royalty fee totals, cost breakdown, preview estimate, or transaction limit semantics. Use `guide-royalties.md` when the question depends on royalty setup, claims, or royalty module roles.

Rule: `packages/core/src/manifests/sendResourceManifest.ts` currently inserts `lock_fee` before `withdraw`. The Rust `resource_transfer.rtm` example warns to remove `lock_fee` when submitting through Babylon Wallet, because wallet submission handles fee locking differently from resim/direct tooling. When adapting a transfer manifest, first identify the submitter: core/tx-tool direct submission may need explicit fee locking, while wallet-submitted manifests should follow wallet fee behavior.

Done when: the fee payer, submitter, and fee-locking source are named, and insufficient balance, costing failure, and wallet fee injection are treated as separate outcomes.

### Interpret preview or receipt summaries

Use this when a transaction preview, submission result, or transaction stream payload includes receipt details that need domain-shaped errors or logs.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/previewTransaction.ts`
- `./.repos/radixdlt-scrypto/radix-engine-toolkit-common/src/receipt/receipt/base.rs`
- `./.repos/radixdlt-scrypto/radix-engine-toolkit-common/src/receipt/receipt/runtime.rs`
- `./.repos/radixdlt-scrypto/radix-engine-toolkit-common/src/receipt/receipt/serializable.rs`
- `./references/guide-transaction-stream.md`

Pattern: keep Gateway receipt shape at the boundary, then map only the fields the caller actually needs: commit outcome, rejection/error summary, fee summary, new entities, events, and balance changes. If a streamed transaction needs event payload decoding, switch to the SBOR guide instead of parsing receipt text.

Done when: the mapped result preserves the original Gateway receipt or transaction ID for debugging, and every derived domain field names the exact Gateway receipt field or SBOR event payload it came from.

## Reference Routes

- Hash intents or derive transaction IDs: inspect `packages/tx-tool/src/intentHash.ts`, `packages/core/src/transaction/helpers/getIntentHash.ts`, and Rust transaction hash models.
- Inject signers: inspect `packages/tx-tool/src/signer/signer.ts` and `guide-tx-tool.md`.
- Preview before signing or submission: inspect `packages/tx-tool/src/previewTransaction.ts`, Gateway `previewTransaction.ts`, and CLI prepare preview code.
- Static manifest analysis: inspect `packages/tx-tool/src/staticallyAnalyzeManifest.ts`, `staticallyAnalyzeManifestV2.ts`, and Toolkit call sites.
- Static manifest validation: inspect `packages/tx-tool/src/staticallyValidateManifest.ts` and Rust manifest validation code.
- Rust transaction crate builders, signatures, raw payloads, hashes, and validators: use `./references/guide-rust-transactions.md`.
- Engine costing, fee reserve, contingent fees, royalty fee totals, preview estimates, and transaction limits: use `./references/guide-costing-fees.md`.
- Royalty setup, royalty roles, claim manifests, and generated royalty scenarios: use `./references/guide-royalties.md`.
- Transaction scenarios: inspect `radix-transaction-scenarios/src/`, generated examples, and corresponding transaction tests.
- Epoch windows: inspect `packages/tx-tool/src/epoch.ts`, transaction header services, and CLI `prepare.ts`.
- Blobs or messages: inspect tx-tool `schemas.ts`, Rust manifest model structs, and transaction builder APIs.

Routing check: adjacent routing sends the agent to one more specific guide or source file, not to a broad package search.

## Usage Notes

- Keep manifest string generation separate from signing and submission.
- Do not skip static validation unless a test explicitly covers why.
- Check network ID, epoch bounds, nonce, notary key, and signer public key before blaming Gateway.
- For V2/subintent work, inspect both TypeScript tx-tool V2 files and Rust `SubintentManifestV2`/`TransactionManifestV2` definitions.
- For RTM syntax or manifest instruction semantics, switch to `guide-transaction-manifest.md`.
- For Rust-only transaction builder, raw payload, signing, hash, or validator work, switch to `guide-rust-transactions.md`.
