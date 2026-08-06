# Transaction Manifest Guide

## Source Paths

Rust source paths:

- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/static_resource_movements`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder`
- `./.repos/radixdlt-scrypto/radix-transactions/examples`
- `./.repos/radixdlt-scrypto/radix-transactions/tests`
- `./.repos/radixdlt-scrypto/radix-common/src/data/manifest`

TypeScript source paths:

- `./.repos/radix-web3.js/packages/core/src/manifests/sendResourceManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyValidateManifest.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintent.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintentAssembly.ts`

## Mental Model

A Radix transaction manifest is the executable program inside a transaction intent. It names instructions, manifest values, buckets, proofs, blobs, address reservations, and child subintents in a human-readable RTM format that compiles into typed transaction model structs.

Use V1 manifests for ordinary transactions. Use V2 manifests when the work involves subintents, child intents, `YIELD_TO_PARENT`, `YIELD_TO_CHILD`, `VERIFY_PARENT`, or V2 resource assertions.

Treat context docs as a map, not an authority. Verify instruction names, manifest value shapes, and V1/V2 support against `radix-transactions/src/manifest`, model files, examples, and tests before adding code.

## Examples

Use these examples to move from a requested transaction shape to the right source files and RTM pattern.

### Write a simple resource transfer manifest

Use this when a user needs to move fungibles or non-fungibles between accounts.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/examples/account/resource_transfer.rtm`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/account/multi_account_resource_transfer.rtm`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radix-web3.js/packages/core/src/manifests/sendResourceManifest.ts`

Pattern:

```rtm
CALL_METHOD
    Address("${from_account_address}")
    "withdraw"
    Address("${resource_address}")
    Decimal("1");

CALL_METHOD
    Address("${to_account_address}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    None;
```

Rule: for wallet-submitted manifests, check the source example comments before adding `lock_fee`; wallet flows may inject fee locking differently from simulator flows.

Done when: the transfer manifest names withdraw source, deposit target, resource address, amount, and submitter fee-locking policy, and it has been checked against either Rust RTM examples or a package manifest helper test.

### Add V1 worktop assertions

Use this when the manifest should fail early if expected resources are missing.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/examples/resources/worktop.rtm`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instruction_effects.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/static_manifest_interpreter.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/tests/assets/manifest_generator_error_undefined_bucket_1.rtm`

Pattern:

```rtm
ASSERT_WORKTOP_CONTAINS_ANY Address("${resource_address}");
ASSERT_WORKTOP_CONTAINS Address("${resource_address}") Decimal("1");
ASSERT_WORKTOP_CONTAINS_NON_FUNGIBLES
    Address("${nft_resource_address}")
    Array<NonFungibleLocalId>(NonFungibleLocalId("#1#"))
;
```

Rule: V1 worktop assertions prove minimum presence. They do not prove that no other resources remain unless the manifest drains or returns the rest.

Done when: each assertion has a named invariant and a test or static-validation check proves the manifest fails when that invariant is violated.

### Use V2 resource constraints

Use this when the manifest must constrain exact worktop, call return, or bucket contents.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/examples/subintents/child.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/basic_subintents_part2.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/manifest/model/manifest_resource_assertion.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/instruction_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/generator.rs`

Pattern:

```rtm
ASSERT_WORKTOP_IS_EMPTY;

ASSERT_WORKTOP_RESOURCES_INCLUDE
    Map<Address, Enum>(
        Address("${fungible_resource_address}") => Enum<ResourceConstraint::ExactAmount>(
            Decimal("1")
        ),
    )
;

ASSERT_NEXT_CALL_RETURNS_ONLY
    Map<Address, Enum>(
        Address("${nft_resource_address}") => Enum<ResourceConstraint::ExactNonFungibles>(
            Array<NonFungibleLocalId>(NonFungibleLocalId("#234#"))
        ),
    )
;

CALL_METHOD
    Address("${component_address}")
    "${method_returning_the_expected_resources}";
```

Rule: choose V2 when the desired invariant is "only these resources" or "the next call returns exactly this". Do not emulate those guarantees with loose V1 assertions.

Rule: `ASSERT_NEXT_CALL_RETURNS_ONLY` and other next-call assertions must immediately precede a `CALL_*` or `YIELD_*` invocation. Do not insert logging, proof cleanup, worktop movement, or another assertion between the next-call assertion and the invocation it constrains.

Done when: the constrained invocation immediately follows the next-call assertion and the test covers both accepted resources and at least one extra or missing resource case.

### Analyze static resource movements

Use this when code needs to classify which resources a manifest withdraws, deposits, returns, or constrains before signing.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/static_resource_movements/visitor.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/static_resource_movements/types.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/static_manifest_interpreter.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instruction_effects.rs`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifestV2.ts`

Pattern:

```rust
let interpreter = StaticManifestInterpreter::new(ValidationRuleset::all(), manifest);
let mut visitor = StaticResourceMovementsVisitor::new(manifest.is_subintent());
interpreter.validate_and_apply_visitor(&mut visitor)?;

let output = visitor.output();
let deposits = output.resolve_account_deposits();
let withdrawals = output.resolve_account_withdraws();
let (net_withdraws, net_deposits) = output.resolve_account_changes()?;
```

Rule: use Rust static movement analysis to understand worktop and bucket effects, then keep TypeScript analysis results close to Radix Engine Toolkit output. Do not infer resource movements from string matching RTM instructions.

Rule: pass `manifest.is_subintent()` into `StaticResourceMovementsVisitor::new`. Subintent analysis starts with an unknown initial worktop because the parent can yield resources into the child; ordinary transaction manifests do not have that initial parent-yielded state.

Done when: analysis output distinguishes gross deposits/withdrawals from net changes, and subintent tests prove parent-yielded unknown worktop state is handled intentionally.

### Manage proofs and the auth zone

Use this when a protected method needs proof creation, cloning, pushing, popping, or cleanup.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/examples/resources/auth_zone.rtm`
- `./.repos/radixdlt-scrypto/radix-common/src/data/manifest/model/manifest_proof.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/auth/authorization.rs`

Pattern:

```rtm
CREATE_PROOF_FROM_AUTH_ZONE_OF_ALL Address("${badge_resource_address}") Proof("admin_proof");
PUSH_TO_AUTH_ZONE Proof("admin_proof");
CALL_METHOD Address("${component_address}") "restricted_method";
DROP_AUTH_ZONE_PROOFS;
DROP_NAMED_PROOFS;
```

Rule: named proofs and auth-zone proofs have different lifecycles. When debugging authorization, inspect both manifest proof instructions and the access rule guide.

Done when: every proof created by the manifest is either consumed, dropped, or intentionally left in the auth zone, and the protected call's access rule is traced to the required proof.

### Allocate an address for later use

Use this when a manifest needs to reserve a global address before the entity exists.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/examples/address_allocation/allocate_address.rtm`
- `./.repos/radixdlt-scrypto/radix-common/src/data/manifest/model/manifest_address.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/manifest/model/manifest_address_reservation.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_namer.rs`

Pattern:

```rtm
ALLOCATE_GLOBAL_ADDRESS
    Address("${package_address}")
    "BlueprintName"
    AddressReservation("reservation")
    NamedAddress("new_component")
;
```

Rule: after allocation, pass the named address or reservation into later calls exactly as the blueprint expects. Name collisions and undefined names are caught by the manifest generator tests.

Done when: the manifest proves the reservation is consumed by the intended blueprint call and tests cover undefined-name or duplicate-name failure if the helper accepts dynamic names.

### Build a subintent manifest

Use this when a workflow mentions pre-authorization, partial transactions, child intents, or V2 subintents.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/examples/subintents/child.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/basic_subintents_part2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/subintent_manifest_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/transaction_manifest_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/validation/transaction_structure_validator.rs`
- `./.repos/radix-web3.js/packages/cli/src/subintent.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintentAssembly.ts`

Pattern:

```rtm
USE_CHILD NamedIntent("my_child") Intent("${subintent_hash}");
VERIFY_PARENT Enum<AccessRule::AllowAll>();
YIELD_TO_PARENT Tuple() Tuple();
YIELD_TO_CHILD NamedIntent("my_child");
YIELD_TO_PARENT;
```

Rule: a `SubintentManifestV2` is not executable by itself and must end by yielding to the parent. Check transaction structure validation when parent/child yields do not line up.

Rule: use `basic_subintents_part2.rs` for realistic V2 workflows. It covers `VERIFY_PARENT`, nested children, repeated partials, and resource constraints better than the standalone RTM syntax example.

Rule: when using the CLI assembly path, root manifests reference children with `YIELD_TO_CHILD NamedIntent("id")`; `subintentAssembly.ts` injects matching `USE_CHILD` declarations before root instructions. It rejects invalid IDs, missing child hashes, and provided child hashes that are not yielded by the root manifest.

Done when: the root and child manifests have matching yield counts, child IDs, and expected subintent hashes, and validation proves a standalone subintent is not submitted as a root transaction.

### Debug manifest compiler errors

Use this when RTM text fails to parse, generate, validate, or decompile.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/lexer.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/parser.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/generator.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/compiler.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/tests/test_manifest_compiler_error_diagnostics.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/tests/assets/manifest_parser_error_unexpected_eof_1.rtm`

Pattern: classify the failure as lexing, parsing, generation, unsupported manifest version, missing blob/name, or validation. The tests under `tests/assets` usually show the exact diagnostic shape to preserve.

Done when: the user-facing error names the compiler phase and includes the smallest source location, token, name, or instruction needed to reproduce the failure.

### Add a TypeScript manifest helper

Use this when a `radix-web3.js` package needs reusable RTM generation.

Start with:

- `./.repos/radix-web3.js/packages/core/src/manifests/sendResourceManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/manifestHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyValidateManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifest.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/account/resource_transfer.rtm`

Pattern: keep TypeScript helpers small and test their emitted RTM against static validation or analysis where the package already exposes those APIs. Use Rust examples for exact instruction text and argument order.

Done when: the helper's public parameters map one-to-one to manifest variables, generated RTM has a focused snapshot or validation test, and lifecycle concerns stay outside the helper.

## Reference Routes

- Manifest struct behavior: inspect `transaction_manifest_v2.rs`, `subintent_manifest_v2.rs`, `manifest_v1.rs`, and `manifest_traits.rs`.
- Instruction inventory: inspect `instruction_v1.rs`, `instruction_v2.rs`, `manifest_instructions.rs`, and `manifest_instruction_effects.rs`.
- Decompilation aliases: inspect `decompiler.rs`, `dumper.rs`, and examples that contain `CREATE_ACCOUNT`, `SET_OWNER_ROLE`, or `ASSERT_WORKTOP_IS_EMPTY`.
- Manifest value syntax: inspect `radix-common/src/data/manifest/model`, `custom_value.rs`, `custom_value_kind.rs`, and `guide-sbor.md`.
- Blobs: inspect `blob_provider.rs`, manifest compiler code, and transaction builder tests.
- Royalty aliases such as `SET_COMPONENT_ROYALTY`, `LOCK_COMPONENT_ROYALTY`, `CLAIM_PACKAGE_ROYALTIES`, and `CLAIM_COMPONENT_ROYALTIES`: use `./references/guide-royalties.md`.
- Gateway or signing lifecycle: switch to `guide-transactions.md` or `guide-tx-tool.md` after the manifest compiles.

Routing check: adjacent routing preserves the boundary between manifest syntax, transaction lifecycle, Gateway reads, and access-rule semantics.

## Usage Notes

- Do not infer V2 support from V1 examples. Check `InstructionV2` and generator version checks.
- Do not hand-roll manifest value encoders when package helpers or toolkit APIs exist.
- Keep manifest generation separate from signing, notarization, Gateway submission, and polling.
- For access-rule values embedded in RTM, read `guide-access-rules.md` before editing enum payloads.
- For royalty amount enums, component royalty module calls, and claim authorization, read `guide-royalties.md` before editing aliases.
