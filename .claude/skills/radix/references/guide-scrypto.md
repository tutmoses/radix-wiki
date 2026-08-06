# Scrypto Guide

## Source Paths

Primary source root: `./.repos/radixdlt-scrypto`

Key paths:

- `scrypto/src/`
- `scrypto-test/src/`
- `radix-engine/src/`
- `radix-engine-interface/src/`
- `radix-transactions/src/`
- `radix-common/src/`
- `radix-engine-toolkit-common/src/receipt/`
- `radix-transaction-scenarios/src/`
- `radix-native-sdk/src/`
- `examples/`

## Mental Model

Scrypto is the Rust-based smart contract and Radix Engine programming model. When TypeScript code touches manifests, addresses, SBOR, accounts, access rules, or transaction classification, the source of truth often lives in `radixdlt-scrypto`.

Common concepts:

- blueprints define component behavior
- resources and vaults model assets
- accounts are native components with deposit, withdraw, proof, and auth methods
- access rules govern method authorization
- manifests express transaction instructions against components and resources
- SBOR encodes values crossing the engine boundary

## Examples

Use these examples when TypeScript behavior depends on canonical Radix Engine or Scrypto semantics.

### Verify account owner keys and proof rules

Use this when ROLA, account authorization, virtual accounts, or owner badge behavior is unclear.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/account/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/scrypto/custom_well_known_types.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radix-web3.js/packages/gateway/src/rola.ts`
- `./references/guide-account.md`
- `./references/guide-access-rules.md`

Pattern: use Rust source for account blueprint semantics, then verify TypeScript ROLA code implements those semantics rather than the other way around.

Done when: the conclusion cites the Rust account blueprint or interface source and then names the TypeScript file that must match it.

### Trace a native blueprint method from manifest call to engine handler

Use this when tracing methods such as `withdraw`, `try_deposit_*`, `lock_fee`, role updates, or resource methods where the manifest string must match native engine behavior.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/account/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/resource_manager.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/role_assignment/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/radix-native-sdk/src/account/account.rs`
- `./.repos/radixdlt-scrypto/radix-native-sdk/src/resource/resource_manager.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/transfer_xrd.rs`

Pattern:

1. Start from the interface `invocations.rs` file to get the method string and argument tuple.
2. Follow the native handler in `radix-engine/src/blueprints`.
3. Check scenario files for realistic success and failure flows.
4. Finish with a short note naming method string, argument tuple, auth requirements, state effects, and emitted events.

Rule: do not infer native blueprint method names from TypeScript helper names. The manifest call must match the Rust invocation constants and tuple shape.

Rule: role updates are object-module calls, not account or resource blueprint methods. For `set`, `set_owner`, and `lock_owner`, start from `object_modules/role_assignment/invocations.rs` and `package.rs` before tracing access-rule payloads.

Done when: the method string, argument tuple, auth requirements, state effects, and emitted events are all traced to source.

### Inspect manifest instruction semantics

Use this when an RTM instruction, manifest builder method, or decompiled alias behaves differently than expected.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/compiler.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/tests/test_manifest_compiler_error_diagnostics.rs`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/manifestHelper.ts`

Pattern: verify instruction effect and compiler behavior in Rust before changing TypeScript manifest strings.

Done when: instruction syntax, version support, resource effects, and compiler diagnostics are verified against `radix-transactions`.

### Inspect resources, vaults, buckets, and proofs

Use this when the task touches resource movement, deposits, withdrawals, auth zone proofs, or vault behavior.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/bucket.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/proof.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/vault.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/resource/bucket_common.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/resource/vault_common.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instruction_effects.rs`

Pattern: separate engine resource semantics from manifest handle semantics. Buckets and proofs in manifests are runtime handles, not persisted domain objects.

Done when: resource movement, vault state, bucket handles, and proof handles are described separately and tied to their source modules.

### Inspect subintent semantics

Use this when working on partial transactions, pre-authorizations, child intents, or parent/child yields.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/subintent_v2.rs`
- `./.repos/radix-web3.js/packages/cli/src/subintent.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintentAssembly.ts`

Pattern: verify Rust model and manifest requirements first, then update TypeScript assembly or inspection code.

Done when: parent/child yield counts, subintent hashes, and V2 model constraints are verified in Rust before changing CLI or tx-tool code.

### Inspect transaction scenarios before inventing examples

Use this when a test needs realistic manifests, receipts, protocol updates, or edge cases.

Start with:

- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenario.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/fungible_resource.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/transfer_xrd.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-protocol-updates/babylon/protocol_update_summary.txt`

Pattern: prefer scenario-derived examples over synthetic RTM when testing protocol-sensitive behavior.

Done when: the test fixture names its scenario source or explains why no scenario exists and what smaller Rust test backs the behavior.

## Reference Routes

- Account behavior: inspect `guide-account.md` first, then account blueprint and invocations source.
- Access rule behavior: inspect `guide-access-rules.md` first, then access rule types, auth zone behavior, and manifest proof instructions.
- Component or package publishing: inspect `scrypto/src`, `scrypto-compiler/`, `radix-transactions/src/builder/`, and examples.
- Transaction model structs: inspect `radix-transactions/src/model/` and V1/V2 intent/core definitions.
- Static resource movement analysis: inspect `radix-transactions/src/manifest/static_resource_movements/visitor.rs`, `types.rs`, `static_manifest_interpreter.rs`, and `manifest_instruction_effects.rs`.
- Substate store behavior: inspect `radix-substate-store-interface/`, `radix-substate-store-impls/`, and `radix-substate-store-queries/`.
- Address derivation: inspect `radix-common/src/types/addresses/component_address.rs`, `radix-common/src/types/entity_type.rs`, and TypeScript derivation call sites in `packages/core/src/account/index.ts` and `packages/core/src/persona/index.ts`.
- SBOR wire behavior: inspect `sbor/src`, `radix-common/src/data`, `sbor-tests/tests/`, and `guide-sbor.md`.
- Scrypto derive macros: inspect `scrypto-derive/src`, `radix-sbor-derive/src`, and examples using derives.
- Test environment helpers: inspect `scrypto-test/src/` and example blueprints under `examples/`.
- CLI/resim behavior: inspect `radix-clis/src/` and `radix-clis/tests/`.
- Native SDK behavior: inspect `radix-native-sdk/src/lib.rs`, `radix-native-sdk/src/account/`, `radix-native-sdk/src/resource/`, `radix-native-sdk/src/runtime/`, and `radix-native-sdk/src/modules/`.

Routing check: adjacent routing selects the narrow Rust crate or guide needed for the behavior instead of searching all of `radixdlt-scrypto`.

## Usage Notes

- Use Rust source for canonical behavior and TypeScript source for application API shape.
- For native blueprint behavior, prefer `radix-engine-interface` before searching broad engine internals.
- For manifest syntax and validation, inspect `radix-transactions`.
- For tests, search `radixdlt-scrypto` before inventing minimal examples.
