# Radix Engine Toolkit Guide

## Source Paths

TypeScript source paths:

- `./.repos/radix-web3.js/packages/core/src/account/index.ts`
- `./.repos/radix-web3.js/packages/core/src/persona/index.ts`
- `./.repos/radix-web3.js/packages/core/src/network/index.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/getKnownAddresses.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/transformTransactionManifest.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/transformStringManifest.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/getIntentHash.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/compileTransaction.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/decompileTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyValidateManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifestV2.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/intentHash.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/compileTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/inspectSignedPartialTransaction.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintent.ts`
- `./.repos/radix-web3.js/packages/cli/src/notarize.ts`
- `./.repos/radix-web3.js/packages/cli/src/submit.ts`

Rust source paths:

- `./.repos/radixdlt-scrypto/radix-common/src/types/addresses/component_address.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/network/mod.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/constants/native_addresses.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/compiler.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/static_manifest_interpreter.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/static_resource_movements/visitor.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instruction_effects.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/hash/mod.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/hash/traits.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/intent.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/notarized_transaction_v1.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/transaction_intent_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/notarized_transaction_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/signed_partial_transaction_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/subintent_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/signed_transaction_intent_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/preview_v2.rs`
- `./.repos/radixdlt-scrypto/radix-engine-toolkit-common/src/receipt/receipt/base.rs`

## Mental Model

Radix Engine Toolkit is the offline boundary for Radix transaction and address operations in the TypeScript packages. It is used before Gateway submission and before wallet handoff to derive addresses, convert RTM strings into instruction models, validate or analyze manifests, hash intents, compile transaction bytes, and inspect signed partial transactions.

Treat Toolkit calls as typed protocol boundaries:

- Pass the intended network ID to address derivation, known-address lookup, manifest conversion, manifest validation, and signed partial transaction decompilation.
- Keep V1 and V2 transaction models explicit. V1 intents use `Intent` and `NotarizedTransaction`; V2 workflows use `TransactionIntentV2`, `SubintentV2`, `SignedPartialTransactionV2`, `SignedTransactionIntentV2`, and `NotarizedTransactionV2`.
- Keep Toolkit output close to its source shape unless a package already has a stable domain wrapper. This prevents lossy conversion around hashes, signatures, analysis results, and compiled bytes.
- Use Rust `radix-transactions` files to understand model semantics. The cloned Scrypto repo includes transaction model and common toolkit receipt code, not the standalone TypeScript Toolkit implementation.

## Examples

Use these examples when a task touches `@steleaio/radix-engine-toolkit`, offline transaction work, address derivation, manifest analysis, transaction hashes, compiled transaction bytes, or V2 partial transactions.

### Derive virtual account or identity addresses

Use this when code derives an account or persona identity address from a public key.

Start with:

- `./.repos/radix-web3.js/packages/core/src/account/index.ts`
- `./.repos/radix-web3.js/packages/core/src/persona/index.ts`
- `./.repos/radix-web3.js/packages/cli/src/accountReads.ts`
- `./.repos/radixdlt-scrypto/radix-common/src/types/addresses/component_address.rs`
- `./references/guide-account.md`

Pattern:

```ts
const accountAddress =
  RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
    publicKey,
    networkId,
  )

const identityAddress =
  RadixEngineToolkit.Derive.virtualIdentityAddressFromPublicKey(
    publicKey,
    networkId,
  )
```

Rule: the Rust model derives preallocated account and identity component addresses from the public key hash, then the network ID controls the encoded address string. Do not reuse an address derived for another network.

Done when: public key type, network ID, derived entity kind, and caller-facing address encoding are all checked by a package helper or CLI test.

### Look up native known addresses

Use this when code needs XRD, package, component, or native blueprint addresses for a network.

Start with:

- `./.repos/radix-web3.js/packages/core/src/network/index.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/getKnownAddresses.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/faucet.ts`
- `./.repos/radixdlt-scrypto/radix-common/src/network/mod.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/constants/native_addresses.rs`

Pattern:

```ts
const knownAddresses = RadixEngineToolkit.Utils.knownAddresses(networkId)
const xrd = knownAddresses.resourceAddresses.xrd
```

Rule: known addresses are network-specific. Use the same network ID for Gateway config, address derivation, manifest construction, and known-address lookup.

Done when: every helper that uses known addresses receives the network ID from the same configuration source as Gateway submission or preview.

### Convert RTM strings into manifest instructions

Use this when package code accepts either a manifest object or human-written RTM.

Start with:

- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/transformTransactionManifest.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/transformStringManifest.ts`
- `./.repos/radix-web3.js/packages/core/src/network/previewTransaction.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/compiler.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instruction_effects.rs`
- `./references/guide-transaction-manifest.md`

Pattern:

```ts
const instructions = await RadixEngineToolkit.Instructions.convert(
  { kind: "String", value: transactionManifest },
  networkId,
  "Parsed",
)

return { instructions, blobs }
```

Rule: string conversion is not validation by itself. If the result will be signed or submitted, run the package's static validation or preview path as well.

Done when: manifest string input, blob handling, network ID, and parsed instruction output are all covered by a package helper or preview test.

### Statically validate a V1 manifest

Use this when a manifest should fail before signing because it is syntactically or structurally invalid.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyValidateManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntent.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/static_manifest_interpreter.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/compiler.rs`
- `./references/guide-tx-tool.md`

Pattern:

```ts
const result =
  await RadixEngineToolkit.TransactionManifest.staticallyValidate(
    manifest,
    networkId,
  )

if (result.kind === "Invalid") {
  throw new Error(result.error)
}
```

Rule: validation errors are part of the transaction build boundary. In Effect code, wrap Toolkit exceptions separately from invalid manifest results so callers can distinguish failed Toolkit execution from a valid invalid-result response.

Done when: invalid manifests fail before signing, error tags distinguish Toolkit failure from manifest invalidity, and the network ID is explicit.

### Analyze V1 and V2 transaction effects

Use this when code needs entity classification, deposits, withdrawals, or static resource movements before a transaction is signed.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifestV2.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/static_resource_movements/visitor.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/static_manifest_interpreter.rs`
- `./references/guide-transaction-manifest.md`

Pattern:

```ts
const v1Analysis =
  await RadixEngineToolkit.TransactionManifest.staticallyAnalyze(
    manifest,
    networkId,
  )

const v2Analysis =
  await RadixEngineToolkit.TransactionIntentV2.staticallyAnalyze(intent)
```

Rule: V1 analysis is manifest plus network ID. V2 analysis is intent-shaped because child subintents and root intent data matter. Do not reuse V1 manifest analysis for V2 subintent workflows.

Done when: the tests assert the Toolkit-shaped analysis fields the caller relies on and keep V1 and V2 analysis paths separate.

### Hash intents and signed intents

Use this when code produces transaction IDs, signing payload identity, or artifact IDs.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/intentHash.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/getIntentHash.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`
- `./.repos/radix-web3.js/packages/cli/src/notarize.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/hash/mod.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/hash/traits.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/intent.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/transaction_intent_v2.rs`

Pattern:

```ts
const hash =
  "transactionHeader" in intent
    ? await RadixEngineToolkit.TransactionIntentV2.hash(intent)
    : await RadixEngineToolkit.Intent.hash(intent)

const hex = Convert.Uint8Array.toHexString(hash.hash)
```

Rule: use the model-specific hash function for the artifact being identified. V1 intent hash, V2 transaction intent hash, V2 signed intent hash, and subintent hash are not interchangeable.

Done when: the artifact ID, raw hash hex, and model type are named together in tests or artifact files.

### Compile or decompile notarized transactions

Use this when code turns transaction models into bytes for Gateway submission or reads compiled bytes back into a model.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/compileTransaction.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/compileTransaction.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/decompileTransaction.ts`
- `./.repos/radix-web3.js/packages/cli/src/notarize.ts`
- `./.repos/radix-web3.js/packages/cli/src/submit.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/notarized_transaction_v1.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/notarized_transaction_v2.rs`

Pattern:

```ts
const bytes =
  "signedTransactionIntent" in notarizedTransaction
    ? await RadixEngineToolkit.NotarizedTransactionV2.compile(
        notarizedTransaction,
      )
    : await RadixEngineToolkit.NotarizedTransaction.compile(
        notarizedTransaction,
      )

const hex = Convert.Uint8Array.toHexString(bytes)
```

Rule: compilation happens after signing and notarization. Keep V2 builder setup explicit because V2 adds non-root subintents and signed subintent collections before notarization.

Done when: compiled bytes are tied to the exact notarized transaction model and Gateway submission receives the expected hex encoding.

### Inspect or compile signed partial transactions

Use this when a CLI, wallet, or aggregator handles a pre-authorization artifact before it is attached to a root transaction.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/inspectSignedPartialTransaction.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintent.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/signed_partial_transaction_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/subintent_v2.rs`
- `./references/guide-subintents.md`

Pattern:

```ts
const signedPartial =
  await RadixEngineToolkit.SignedPartialTransactionV2.decompile(
    Convert.HexString.toUint8Array(signedPartialTransactionHex),
    networkId,
  )

const rootHash = await RadixEngineToolkit.SubintentV2.hash(
  signedPartial.partialTransaction.rootSubintent,
)
```

Rule: a signed partial transaction is not a submit-ready transaction. Inspect root subintent hash, signatures, non-root subintent count, and network ID before assembling it into a root transaction.

Done when: the inspected artifact reports root subintent id and hash hex, public keys for supported signatures, non-root subintent count, and the network ID used for decompilation.

### Convert bytes and hex at package boundaries

Use this when a command or service crosses between Gateway hex strings, files, signing hashes, and Toolkit byte arrays.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/notarize.ts`
- `./.repos/radix-web3.js/packages/cli/src/submit.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/submitTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/signer/signer.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/schemas.ts`
- `./references/guide-shared.md`

Pattern:

```ts
const bytes = Convert.HexString.toUint8Array(hex)
const outputHex = Convert.Uint8Array.toHexString(bytes)
```

Rule: use Toolkit `Convert` at byte boundaries and package schemas for branded external strings. Do not hand-roll hex parsing in CLI or Effect services.

Done when: malformed hex, public key, signature, and compiled transaction inputs fail at the schema or conversion boundary before Gateway submission.

## Reference Routes

- Manifest syntax and instruction semantics: read `./references/guide-transaction-manifest.md`.
- Tx-tool Effect services, signer injection, and lifecycle orchestration: read `./references/guide-tx-tool.md`.
- V2 pre-authorization and signed partial transaction workflows: read `./references/guide-subintents.md`.
- Account owner keys and virtual account behavior: read `./references/guide-account.md`.
- SBOR and manifest value encoding questions: read `./references/guide-sbor.md`.
- CLI artifact workflow questions: read `./references/guide-cli.md` and `./references/cli-command-reference.md`.
- Gateway submit, preview, and status polling questions: read `./references/guide-gateway.md` and `./references/guide-transactions.md`.

Routing check: choose this guide when the task is about a direct Radix Engine Toolkit call or offline protocol conversion; choose the adjacent package guide when the task is mostly service wiring, CLI command behavior, Gateway IO, or manifest authoring.

## Usage Notes

- Keep network ID explicit at every Toolkit call that accepts it.
- Do not treat Toolkit static analysis as ledger execution. Use Gateway preview or submission when runtime behavior matters.
- Keep Toolkit exceptions wrapped in local error types in Effect services.
- Preserve V1 and V2 model checks at call sites. Avoid broad `any` conversions around transaction models.
- Use Toolkit `Convert` for byte and hex conversion, then use package branded schemas for public API boundaries.
- Do not add references to a standalone cloned `radix-engine-toolkit` source tree unless setup starts cloning that repository and the validator checks it.
