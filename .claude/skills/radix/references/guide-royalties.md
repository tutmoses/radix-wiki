# Royalties Guide

## Source Paths

Royalty model and module source paths:

- `./.repos/radixdlt-scrypto/radix-common/src/types/royalty_amount.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/constants/transaction_execution.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/types/royalty_config.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/royalty/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/royalty/substates.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/package/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/royalty/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/package/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/costing_module.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/fee_reserve.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/fee_summary.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/transaction/instructions.rs`
- `./.repos/radixdlt-scrypto/radix-native-sdk/src/modules/royalty/royalty.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/modules/royalty.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/macros.rs`

Manifest and test source paths:

- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/parser.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/e2e.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/royalty/royalty.rtm`
- `./.repos/radixdlt-scrypto/radix-engine-tests/assets/blueprints/royalty/src/lib.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/assets/blueprints/royalty-auth/src/lib.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/assets/blueprints/royalty-edge-cases/src/lib.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/royalty.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/royalty_auth.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/royalty_edge_cases.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/system_module_methods.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/auth_account.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/scenario_summary.txt`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/manifests/001--royalties--publish-package.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/manifests/002--royalties--instantiate-components.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/manifests/003--royalties--set-components-royalty.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/manifests/004--royalties--call_all_components_all_methods.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/receipts/004--royalties--call_all_components_all_methods.txt`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/costings/004--royalties--call_all_components_all_methods.txt`

## Mental Model

Royalties are protocol-level charges attached to package functions and component method calls. They are not ordinary application transfers, and they are not the same thing as execution, finalization, storage, or tipping fees.

There are two royalty surfaces:

- Package royalties live in package blueprint metadata. `PackageRoyaltyConfig` is disabled or enabled with a method-name map to `RoyaltyAmount`.
- Component royalties live in an attached component object module. `ComponentRoyaltyConfig` maps method names to `(RoyaltyAmount, locked)` entries and uses a native XRD vault accumulator.

The costing module applies package royalties for function and main-method invokes when a blueprint is known. It applies component royalties only for main or direct method calls on global objects that actually have the royalty module attached. Module calls such as role-assignment or metadata calls do not recursively charge component royalties.

`RoyaltyAmount` has three variants: `Free`, `Xrd(Decimal)`, and `Usd(Decimal)`. Free and zero values do not charge. Negative values and values above the configured per-function maximum are rejected at creation or update boundaries. USD royalties are converted through the protocol USD price in XRD when charged.

Claims and role checks are separate from charging. Charges go into package or component accumulators during successful finalization. Claim methods withdraw those accumulated XRD buckets, and the caller still needs the package owner authority or component royalty claimer authority.

## Examples

Use these examples when work touches package royalty config, component royalty modules, royalty amount validation, royalty RTM aliases, royalty role assignment, claims, accumulators, or generated royalty scenarios.

### Separate package royalties from component royalties

Use this when a task says "royalty" but does not say whether the charge belongs to a package function, a component method, or a component module update.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/types/royalty_config.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/royalty/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/royalty/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/assets/blueprints/royalty/src/lib.rs`
- `./references/guide-components-packages.md`

Pattern:

```text
PackageRoyaltyConfig
  package blueprint method name -> RoyaltyAmount

ComponentRoyaltyConfig
  component method name -> (RoyaltyAmount, locked)

Method call
  package royalty from blueprint method config
  component royalty from attached royalty module, if present
```

Rule: a package royalty is configured on package publication data. A component royalty is configured on an attached royalty module when the component is globalized or later updated through royalty module methods.

Done when: the explanation names the target package, blueprint, method, component address if any, royalty surface, amount variant, and whether a component royalty module is attached.

### Enable royalties in Scrypto code

Use this when writing or reviewing a blueprint that enables package royalties, component royalties, or royalty roles at component globalize time.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-tests/assets/blueprints/royalty/src/lib.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/assets/blueprints/royalty-auth/src/lib.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/macros.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/modules/royalty.rs`
- `./references/guide-access-rules.md`
- `./references/guide-role-assignment.md`

Pattern:

```rust
enable_package_royalties! {
    paid_method => Xrd(2.into());
    free_method => Free;
}

Self {}
    .instantiate()
    .prepare_to_globalize(owner_role)
    .enable_component_royalties(component_royalties! {
        roles {
            royalty_setter => rule!(allow_all);
            royalty_setter_updater => rule!(deny_all);
            royalty_locker => rule!(allow_all);
            royalty_locker_updater => rule!(deny_all);
            royalty_claimer => rule!(allow_all);
            royalty_claimer_updater => rule!(deny_all);
        },
        init {
            paid_method => Xrd(1.into()), updatable;
            free_method => Free, locked;
        }
    })
    .globalize()
```

Rule: `enable_package_royalties!` affects the package blueprint royalty config. `enable_component_royalties` attaches a royalty module to one component and writes initial method entries plus the `RoyaltyRoles` role assignment data.

Done when: the blueprint lists every charged method, every free method, every locked or updatable component royalty entry, and every royalty role needed to update, lock, or claim later.

### Write royalty manifest aliases

Use this when adding RTM, manifest-builder helpers, CLI examples, or docs for setting, locking, or claiming royalties.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/parser.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/e2e.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/royalty/royalty.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/manifests/003--royalties--set-components-royalty.rtm`
- `./references/guide-transaction-manifest.md`

Pattern:

```rtm
SET_COMPONENT_ROYALTY
    Address("${component_address}")
    "paid_method"
    Enum<RoyaltyAmount::Xrd>(Decimal("1"));

LOCK_COMPONENT_ROYALTY
    Address("${component_address}")
    "paid_method";

CLAIM_PACKAGE_ROYALTIES
    Address("${package_address}");

CLAIM_COMPONENT_ROYALTIES
    Address("${component_address}");
```

Rule: `SET_COMPONENT_ROYALTY`, `LOCK_COMPONENT_ROYALTY`, and `CLAIM_COMPONENT_ROYALTIES` decompile from `CallRoyaltyMethod`. `CLAIM_PACKAGE_ROYALTIES` decompiles from a package `CallMethod` on the package address.

Done when: the manifest target address type, method string, amount enum, required proof, worktop bucket deposit, and parser/decompiler alias are all verified against Rust source.

### Validate royalty amounts and limits

Use this when a royalty amount is negative, zero, very small, expressed in USD, or near a protocol maximum.

Start with:

- `./.repos/radixdlt-scrypto/radix-common/src/types/royalty_amount.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/constants/transaction_execution.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/royalty/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/assets/blueprints/royalty-edge-cases/src/lib.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/royalty_edge_cases.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/royalty.rs`
- `./references/guide-costing-fees.md`

Pattern:

```rust
RoyaltyAmount::Free
RoyaltyAmount::Xrd(dec!("1"))
RoyaltyAmount::Usd(dec!("1"))
```

Negative XRD and USD royalties fail. Zero XRD, zero USD, and `Free` are allowed and should not charge. Values above the configured per-function XRD or USD maximum fail with a greater-than-allowed royalty error.

Rule: validate amount semantics at the royalty boundary, not by checking receipt fee totals after the fact. Receipt totals prove charging, but they do not prove the config was valid.

Done when: the test covers `Free`, zero, positive, maximum, greater-than-maximum, and negative cases for the royalty surface being changed.

### Account for royalty costs and accumulators

Use this when a receipt includes royalty XRD, a package or component accumulator balance looks wrong, or a failed transaction unexpectedly did or did not credit royalties.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/costing_module.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/fee_reserve.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/fee_summary.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/royalty/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/royalty.rs`
- `./references/guide-costing-fees.md`
- `./references/guide-receipts-events.md`

Pattern:

```rust
assert_eq!(receipt.fee_summary.total_royalty_cost_in_xrd, dec!("3"));
assert_eq!(ledger.inspect_package_royalty(package_address), Some(dec!("2")));
assert_eq!(ledger.inspect_component_royalty(component_address).unwrap(), dec!(1));
```

The costing module applies package royalty first, then component royalty when the called global object has the royalty module attached. The fee reserve tracks royalty recipients and can revert pending royalty costs when execution is finalized as a failure path.

Rule: royalty cost in the receipt and royalty accumulation in a package or component vault are related but not identical diagnostic surfaces.

Done when: the package recipient, component recipient, XRD total, USD conversion if any, commit outcome, and accumulator state are each asserted separately.

### Claim package and component royalties

Use this when a transaction withdraws accumulated royalty XRD from a package or component accumulator.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/package/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/royalty/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/package/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/royalty/package.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/royalty/royalty.rtm`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/royalty.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/royalty_auth.rs`
- `./references/guide-resources-vaults.md`

Pattern:

```rtm
CLAIM_PACKAGE_ROYALTIES
    Address("${package_address}");

CLAIM_COMPONENT_ROYALTIES
    Address("${component_address}");

CALL_METHOD
    Address("${account_address}")
    "try_deposit_entire_worktop_or_abort"
    Expression("ENTIRE_WORKTOP")
    None;
```

Package claims return a bucket from the package royalty accumulator. Component claims return a bucket from the component royalty module accumulator. The manifest must still deposit or otherwise handle the bucket on the worktop.

Rule: claim authorization is not the same as royalty charging. The package owner or component royalty claimer can claim after accumulation, but the charged method caller does not automatically receive the bucket.

Done when: the claim transaction creates the right proof, calls the right package or royalty module method, deposits the returned bucket, and proves the accumulator is empty afterward.

### Wire royalty roles and authorization

Use this when `SET_COMPONENT_ROYALTY`, `LOCK_COMPONENT_ROYALTY`, or `CLAIM_COMPONENT_ROYALTIES` fails because the role assignment or proof source is wrong.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/royalty/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/royalty/package.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/modules/royalty.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/macros.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/assets/blueprints/royalty-auth/src/lib.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/royalty_auth.rs`
- `./references/guide-role-assignment.md`
- `./references/guide-access-rules.md`

Pattern:

```rust
royalty_setter => rule!(require(owner_badge));
royalty_setter_updater => rule!(require(owner_badge));
royalty_locker => rule!(require(owner_badge));
royalty_locker_updater => rule!(require(owner_badge));
royalty_claimer => rule!(require(owner_badge));
royalty_claimer_updater => rule!(require(owner_badge));
```

The component royalty native blueprint authorizes `set_royalty` with `royalty_setter`, `lock_royalty` with `royalty_locker`, and `claim_royalties` with `royalty_claimer`. Those roles are stored under `ModuleId::Royalty`, not under the main component module.

Rule: when debugging authorization, prove both the role entry and the proof location. A proof held in a local variable or returned to the worktop is not the same as a proof available to the auth zone at the module call.

Done when: the attempted royalty method, royalty role key, role updater, stored access rule, proof resource, auth-zone placement, and positive and negative auth tests are all named.

### Debug missing or locked royalty modules

Use this when setting or claiming component royalties fails even though the target address is global and the manifest syntax is valid.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/system/transaction/instructions.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/system_module_methods.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/auth_account.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/royalty.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/assets/blueprints/royalty-edge-cases/src/lib.rs`
- `./references/guide-error-diagnostics.md`
- `./references/guide-account.md`

Pattern:

```text
CallRoyaltyMethod -> AttachedModuleId::Royalty
account or package without component royalty module -> ObjectModuleDoesNotExist
locked method entry -> KeyValueEntryLocked
missing method entry -> no component royalty charge
```

Accounts, packages, and resource managers are global addresses, but they are not components with the component royalty module attached. A component can also have no entry for a method, in which case charging uses `Free` for that component royalty.

Rule: distinguish a missing royalty module from a missing method entry and from a locked method entry. The remediation is different for each case.

Done when: the failure names the target entity type, attached modules, method entry state, lock state, and structured error variant before suggesting a role or manifest fix.

### Use generated royalty scenarios as golden fixtures

Use this when docs, examples, or tests need source-backed RTM and expected costing behavior for royalties.

Start with:

- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/scenario_summary.txt`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/manifests/001--royalties--publish-package.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/manifests/002--royalties--instantiate-components.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/manifests/003--royalties--set-components-royalty.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/manifests/004--royalties--call_all_components_all_methods.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/receipts/004--royalties--call_all_components_all_methods.txt`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/costings/004--royalties--call_all_components_all_methods.txt`
- `./references/guide-testing.md`

Pattern:

```text
001 publish package
002 instantiate components
003 set component royalties
004 call all components and all methods

Compare manifest, receipt, and costing output for the same scenario step.
```

Generated royalty scenarios are useful for exact RTM shape and end-to-end costing expectations. They should not replace focused engine tests when the question is about a specific failure variant or authorization rule.

Rule: use generated scenarios for golden examples and broad regression checks; use `royalty.rs`, `royalty_auth.rs`, and `royalty_edge_cases.rs` for narrow protocol semantics.

Done when: the example links a manifest step to its receipt and costing file, and any copied RTM is checked against the generated source instead of being reconstructed from memory.

## Reference Routes

- Package publishing, component instantiation, globalize-time module attachment, and `CALL_FUNCTION` versus `CALL_METHOD`: use `./references/guide-components-packages.md`.
- Exact RTM instruction syntax, manifest value enum shape, parser aliases, and decompiler output: use `./references/guide-transaction-manifest.md`.
- Fee reserve accounting, receipt fee totals, cost breakdown, preview estimates, and transaction limits: use `./references/guide-costing-fees.md`.
- Royalty setter, locker, claimer, and updater roles stored under `ModuleId::Royalty`: use `./references/guide-role-assignment.md`.
- Access-rule trees, proofs, auth-zone lifecycle, and authorization failures: use `./references/guide-access-rules.md`.
- Buckets, vault accumulators, and worktop deposit handling after claims: use `./references/guide-resources-vaults.md`.
- Engine tests, generated scenario fixtures, and fixture selection: use `./references/guide-testing.md`.

Routing check: choose this guide when the task says package royalty, component royalty, royalty amount, royalty roles, royalty accumulator, claim royalties, set or lock component royalty, or generated royalty scenarios.

## Usage Notes

- Keep royalty configuration, royalty charging, royalty accumulation, and royalty claiming as separate steps.
- Do not assume every global address has a royalty module. Component royalty module calls require the module to be attached.
- Use the generated RTM scenarios for syntax examples, then use focused engine tests for edge cases and authorization failures.
- Treat USD royalties as protocol-priced XRD charges when they hit the fee reserve.
- Route pure fee-summary display bugs to `guide-costing-fees.md`; route royalty setup, role, claim, and module-attachment bugs here.
