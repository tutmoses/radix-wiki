# Rust Transactions Guide

## Source Paths

Rust source paths:

- `./.repos/radixdlt-scrypto/radix-transactions/src/lib.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/transaction_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/signing/signer.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/user_transaction.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/any_transaction.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/preparation/traits.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/header.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/intent.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/notarized_transaction_v1.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/transaction_header_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/intent_header_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/notarized_transaction_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/signed_partial_transaction_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validator.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validation_configuration.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/signature_validator.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_structure_validator.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validator_v1.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validator_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/validation_test_helpers.rs`

## Mental Model

`radix-transactions` is the Rust crate for transaction payload models, builders, signing helpers, raw payload conversion, preparation, hashing, and validation. Use it when working in Rust, Scrypto tests, transaction scenarios, toolkit internals, or source-level protocol behavior.

Keep four layers separate:

- manifest layer: `TransactionManifestV1`, `TransactionManifestV2`, and `SubintentManifestV2`
- intent layer: headers, blobs, messages, child subintent references, and instructions
- signature layer: intent signatures, subintent signatures, and notary signatures
- validation layer: preparation settings, network checks, signature checks, manifest checks, and V2 tree structure checks

The builder type names are easy to confuse. `TransactionBuilder` is an alias for the V1 builder. `TransactionBuilder::new_v2()` creates a V2 transaction builder. `TransactionBuilder::new_partial_v2()` creates a signed partial transaction builder for subintent trees.

Preparation is not just serialization. Prepared payloads calculate the canonical hashes used for intent signing, notary signing, notarized transaction IDs, and subintent identity. Raw payload bytes should move through `to_raw`, `from_raw`, `prepare`, and `prepare_and_validate` rather than through ad hoc SBOR helpers.

## Examples

Use these examples when code or docs touch the Rust `radix-transactions` crate, transaction builders, signer traits, raw transaction bytes, payload hashes, validation configuration, or V2 signed partial transaction structure.

### Build and notarize a V1 transaction

Use this when a Rust test, transaction scenario, or engine helper needs an ordinary V1 user transaction.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/transaction_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/header.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/intent.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/notarized_transaction_v1.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/validation_test_helpers.rs`
- `./references/guide-transaction-manifest.md`

Pattern:

```rust
let transaction = TransactionBuilder::new()
    .header(TransactionHeaderV1 {
        network_id,
        start_epoch_inclusive,
        end_epoch_exclusive,
        nonce,
        notary_public_key: notary.public_key(),
        notary_is_signatory: false,
        tip_percentage: 0,
    })
    .manifest(manifest)
    .message(MessageV1::None)
    .sign(&account_signer)
    .notarize(&notary)
    .build();
```

Rule: V1 signing prepares the intent and signs `transaction_intent_hash`; notarization prepares the signed intent and signs `signed_transaction_intent_hash`. Do not sign manifest bytes directly.

Done when: the header network, epoch window, nonce, notary public key, notary signatory flag, signer set, and manifest source are explicit, and `prepare_and_validate` is tested with the intended validator.

### Build a V2 transaction with child partials

Use this when a root transaction must include one or more wallet- or service-produced signed partial transactions.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/transaction_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/transaction_header_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/intent_header_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/notarized_transaction_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validator_v2.rs`
- `./references/guide-subintents.md`

Pattern:

```rust
let detailed = TransactionBuilder::new_v2()
    .transaction_header(transaction_header)
    .intent_header(intent_header)
    .add_signed_child("child", signed_partial_transaction)
    .manifest_builder(|builder| {
        builder
            .yield_to_child("child", manifest_args!())
            .drop_auth_zone_proofs()
    })
    .sign(&root_signer)
    .notarize(&notary)
    .build();
```

Rule: call `add_signed_child` before `manifest` or `manifest_builder`. The builder injects child hashes into the manifest builder; a manifest whose children differ from the added partials will panic before validation.

Done when: the root transaction header, root intent header, child names, child hashes, root signatures, notary signature, and `DetailedNotarizedTransactionV2.transaction_hashes` are all retained or asserted.

### Build and pass around a signed partial transaction

Use this when constructing a pre-authorization artifact or an incomplete V2 transaction subtree.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/transaction_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/signed_partial_transaction_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/subintent_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/subintent_manifest_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validator_v2.rs`
- `./references/guide-subintents.md`

Pattern:

```rust
let signed_partial = TransactionBuilder::new_partial_v2()
    .intent_header(intent_header)
    .manifest_builder(|builder| {
        builder
            .yield_to_parent(manifest_args!())
    })
    .sign(&subintent_signer)
    .build();

let raw = signed_partial.to_raw()?;
```

Rule: a signed partial transaction contains a root subintent, flattened non-root subintents, root subintent signatures, and non-root subintent signatures. It is not a notarized transaction and should be validated as `SignedPartialTransactionV2` before being attached to a root transaction.

Done when: the code records the root subintent hash, non-root subintent hashes, raw payload bytes, and validation result before handing the artifact to a wallet, CLI, aggregator, or parent transaction builder.

### Choose validation constructor and network behavior

Use this when validation should be tied to a ledger database, simulator network, specific network definition, or network-agnostic artifact check.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validator.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validation_configuration.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validator_v1.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validator_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/validation_test_helpers.rs`
- `./references/guide-network-addresses.md`

Pattern:

```rust
let simulator_validator = TransactionValidator::new_for_latest_simulator();
let network_validator = TransactionValidator::new_with_latest_config(&network);
let ledger_validator = TransactionValidator::new(database, &network);
let artifact_validator =
    TransactionValidator::new_with_latest_config_network_agnostic();
```

Rule: network-specific validators require matching transaction network IDs. Network-agnostic validation is useful for portable artifacts, but it does not prove the transaction belongs on a specific network.

Done when: tests cover the intended network ID behavior, protocol configuration source, V1/V2 allowance, and at least one wrong-network or network-agnostic case.

### Convert raw payload bytes safely

Use this when decoding submitted bytes, storing artifacts, extracting manifests, or bridging between Rust and TypeScript tooling.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/model/user_transaction.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/any_transaction.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/preparation/traits.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/notarized_transaction_v1.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/notarized_transaction_v2.rs`
- `./references/guide-sbor.md`

Pattern:

```rust
let raw = transaction.to_raw()?;
let decoded = UserTransaction::from_raw(&raw)?;
let prepared = decoded.prepare(validator.preparation_settings())?;
let hashes = prepared.hashes();
```

Rule: use `UserTransaction` for notarized V1/V2 user transactions and `AnyTransaction` only when the payload may be another transaction payload type. The discriminator byte is part of the versioned transaction payload contract.

Done when: decode errors, preparation errors, validation errors, and hash extraction are reported as separate failure classes.

### Verify signing and notary behavior

Use this when adding a signer implementation, debugging signature validation, or deciding whether the notary also counts as a signer.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/signing/signer.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/signature_validator.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validation_configuration.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/notary_signature.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/notarized_transaction_v2.rs`

Pattern:

```rust
pub trait Signer {
    fn public_key(&self) -> PublicKey;
    fn sign_without_public_key(&self, message_hash: &impl IsHash) -> SignatureV1;
    fn sign_with_public_key(&self, message_hash: &impl IsHash) -> SignatureWithPublicKeyV1;
}
```

Rule: intent signatures carry public keys. Notary signatures store a signature over the prepared signed intent hash. V1 can allow the notary to duplicate a signer depending on validation config; V2 does not use that allowance.

Done when: the signer path proves the signed hash, recovered or supplied public key, signature count limits, notary key, and invalid-signature failure branch.

### Preserve hashes and object names for diagnostics

Use this when a caller needs transaction hashes, subintent hashes, manifest variable names, or decompiled manifests after building.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/transaction_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/notarized_transaction_v1.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/notarized_transaction_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/user_transaction.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_naming.rs`

Pattern:

```rust
let detailed = TransactionBuilder::new_v2()
    .transaction_header(transaction_header)
    .intent_header(intent_header)
    .manifest_builder(|builder| builder.drop_auth_zone_proofs())
    .sign(&signer)
    .notarize(&notary)
    .build();

let hashes = detailed.transaction_hashes;
let names = detailed.object_names;
```

Rule: prefer detailed builder outputs when diagnostics need hashes or manifest object names. Minimal builds return the transaction model only and can lose names needed for readable manifest extraction.

Done when: diagnostics include transaction intent hash, signed transaction intent hash, notarized transaction hash, non-root subintent hashes for V2, and names used to extract or decompile manifests.

### Decide when to skip validation

Use this when code is constructing intentionally invalid test transactions, deferring validation, or avoiding duplicate validation while composing partial transactions.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/transaction_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validation_configuration.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validator_v1.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_validator_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_structure_validator.rs`

Pattern:

```rust
let unchecked = builder.build_no_validate();
let checked = unchecked
    .transaction
    .prepare_and_validate(&validator)?;
```

Rule: `build_no_validate` still prepares or encodes enough to produce raw payloads and hashes where the builder promises them, but it does not prove manifest validity, signature validity, network validity, or V2 tree structure. Use it only when the next validation boundary is explicit.

Done when: the code names the deferred validator, explains why validation is delayed, and has a test that fails if the deferred validation call is removed.

## Reference Routes

- RTM syntax, manifest instructions, worktop, proofs, and builder methods: use `./references/guide-transaction-manifest.md`.
- TypeScript transaction services, signer injection, Gateway submission, and polling: use `./references/guide-tx-tool.md` and `./references/guide-transactions.md`.
- V2 subintent semantics and wallet pre-authorization artifacts: use `./references/guide-subintents.md`.
- Raw SBOR and Manifest/Scrypto value boundaries: use `./references/guide-sbor.md`.
- Network IDs, address HRPs, and wrong-network diagnosis: use `./references/guide-network-addresses.md`.
- Static manifest analysis and validation through Radix Engine Toolkit: use `./references/guide-radix-engine-toolkit.md`.

Routing check: if the task is in Rust and mentions `radix-transactions`, `TransactionBuilder`, `NotarizedTransactionV1`, `NotarizedTransactionV2`, `SignedPartialTransactionV2`, raw transaction bytes, transaction hashes, or `TransactionValidator`, keep this guide loaded.

## Usage Notes

- Do not use this guide as the primary RTM instruction reference. Switch to `guide-transaction-manifest.md` for manifest syntax and instruction argument shapes.
- Do not document `TransactionBuilder::new()` as V2. It is the V1 builder alias; call `TransactionBuilder::new_v2()` for V2 transactions.
- Add child partial transactions before building a V2 root manifest. Child hashes are wired into the manifest builder at that point.
- Treat preparation, validation, and execution conversion as separate steps. A payload can encode, prepare, and still fail validation.
- Preserve raw bytes, hashes, and object names when building diagnostics or artifacts intended for another process.
