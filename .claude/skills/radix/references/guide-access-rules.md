# Access Rules Guide

## Source Paths

Rust source paths:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/proof_rule.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/package/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/role_assignment/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/macros.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/macros.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/modules/role_assignment.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/component/component.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/resource/resource_builder.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/substates.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/auth/auth_module.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/auth/authorization.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/checkers/role_assignment_db_checker.rs`
- `./.repos/radixdlt-scrypto/radix-native-sdk/src/modules/role_assignment/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/scrypto/custom_well_known_types.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/constants/transaction_execution.rs`

Manifest and scenario paths:

- `./.repos/radixdlt-scrypto/radix-transactions/examples/access_rule/access_rule.rtm`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/resources/auth_zone.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/system_access_rule.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/system_role_assignment.rs`

## Mental Model

Access rules answer "what proof must be present for this operation?" They are separate from session logic and app permissions:

- `AccessRule::AllowAll` means anyone can pass.
- `AccessRule::DenyAll` means nobody can pass.
- `AccessRule::Protected(CompositeRequirement)` checks resource, non-fungible, virtual signature, or caller proofs.

Read the rule hierarchy from leaf to root:

- `ResourceOrNonFungible` selects a fungible or exact non-fungible proof target.
- `BasicRequirement` selects proof semantics such as require, amount, count, all-of, or any-of.
- `CompositeRequirement` recursively combines basic requirements with all-of or any-of logic.
- `AccessRule` wraps the composite rule, or bypasses it with allow-all or deny-all.

Role assignment answers "which named rule protects which method or module operation?" The owner role is a special role that can be fixed, updatable by the owner, or absent.

Most mistakes come from confusing the rule tree, the role table, and the auth-zone proof lifecycle. Inspect all three when authorization behavior is surprising.

Read access-control behavior in this order: method or function accessibility chooses the permission shape, role assignment resolves named roles to access rules, then authorization checks whether the auth zone has matching explicit or virtual proofs.

## Examples

Use these examples to choose the right authorization source before changing Scrypto, manifests, or TypeScript wrappers.

### Map the access-rule hierarchy before changing behavior

Use this when a change touches authorization semantics, SBOR enum values, manifest access-rule values, or code that serializes and deserializes rules.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/proof_rule.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/scrypto/custom_well_known_types.rs`
- `./references/guide-sbor.md`

Pattern:

```text
AccessRule
  AllowAll
  DenyAll
  Protected(CompositeRequirement)

CompositeRequirement
  BasicRequirement(BasicRequirement)
  AnyOf(Vec<CompositeRequirement>)
  AllOf(Vec<CompositeRequirement>)

BasicRequirement
  Require(ResourceOrNonFungible)
  AmountOf(Decimal, ResourceAddress)
  CountOf(u8, Vec<ResourceOrNonFungible>)
  AllOf(Vec<ResourceOrNonFungible>)
  AnyOf(Vec<ResourceOrNonFungible>)
```

Rule: identify the exact layer before editing. `AccessRule` decides open, closed, or protected; `CompositeRequirement` handles recursive grouping; `BasicRequirement` handles proof semantics; `ResourceOrNonFungible` decides whether the proof target is a resource or an exact non-fungible global ID.

Done when: the change is mapped to one hierarchy layer, any manifest or SBOR discriminator is verified in `custom_well_known_types.rs`, and tests cover at least one satisfied proof and one missing or wrong proof.

### Define a simple badge requirement

Use this when a resource badge or non-fungible badge should guard a method.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/proof_rule.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/macros.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/resource/resource_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/resources/auth_zone.rtm`

Pattern:

```rust
let admin_rule = rule!(require(admin_badge_resource));
let nft_rule = rule!(require(admin_non_fungible_global_id));
```

Rule: `require(resource_address)` means a proof of that resource is enough. `require(non_fungible_global_id)` means that exact non-fungible proof is required.

Done when: the rule names the required badge type, the proof source is known, and a negative test or scenario proves a missing or wrong badge fails authorization.

### Require a fungible proof amount

Use this when a fungible badge should authorize only above a minimum proof amount.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/proof_rule.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/macros.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/resources/auth_zone.rtm`
- `./references/guide-sbor.md`

Pattern:

```rust
let large_holder = rule!(require_amount(dec!("10"), admin_badge_resource));
```

Rule: `AmountOf(Decimal, ResourceAddress)` checks the amount carried by proofs for that resource. It is not the same as `Require(ResourceAddress)`, which only needs some proof of the resource.

Done when: the minimum amount, resource address, proof creation path, and insufficient-amount failure are covered by a scenario or test.

### Combine requirements with all, any, or M-of-N logic

Use this when access should require multiple proofs or one of several proof options.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/proof_rule.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/macros.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system_folder.rs`

Pattern:

```rust
let either = rule!(require(badge_a) || require(badge_b));
let both = rule!(require(badge_a) && require(badge_b));
let quorum = AccessRule::Protected(require_n_of(2, vec![badge_a, badge_b, badge_c]));
```

Rule: prefer the `rule!` macro for readable static rules. Use helper functions such as `require_n_of`, `require_amount`, `require_any_of`, and `require_all_of` when the rule is generated from data.

Done when: every branch of the composite rule has a success and failure case, including insufficient quorum for M-of-N requirements.

### Use virtual badges for signatures and callers

Use this when authorization depends on a transaction signer, global caller, or package caller rather than a vault-backed badge.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/proof_rule.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/constants/auth_addresses.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/resource/auth_zone/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/auth/authorization.rs`

Pattern:

```rust
let signer_rule = rule!(require(signature(public_key)));
let component_rule = rule!(require(global_caller(component_address)));
let package_rule = rule!(require(package_of_direct_caller(package_address)));
```

Rule: virtual badges are synthesized by the engine. Do not look for vault contents when debugging signature or caller rules; inspect auth-zone and authorization code.

Done when: the transaction signer, global caller, or package caller requirement is traced to engine-synthesized auth-zone data, not to a resource vault.

### Choose an owner access rule

Use this when a component, resource, package, or account needs an owner proof rule.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/role_assignment.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/resource/resource_builder.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/component/component.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./references/guide-role-assignment.md`

Pattern:

```rust
let owner_proof = rule!(require(admin_badge));
let owner_signature = rule!(require(signature(admin_public_key)));
```

Rule: choose the proof rule that should identify the owner first. Owner mutability, updater policy, `OwnerRole::None`, `OwnerRole::Fixed`, and `OwnerRole::Updatable` are role-assignment decisions; route those details through `./references/guide-role-assignment.md`.

Done when: the owner access rule is explicit, the proof source is known, and role-assignment mutability is checked in the role-assignment guide.

### Configure method authorization in a Scrypto blueprint

Use this when a blueprint method should be public, private, or role protected.

Start with:

- `./.repos/radixdlt-scrypto/scrypto/src/macros.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/role_assignment.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/component/component.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/modules/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/substates.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/events.rs`

Pattern:

```rust
enable_method_auth! {
    roles {
        admin => updatable_by: [OWNER];
        minter => updatable_by: [OWNER, admin];
    },
    methods {
        mint => restrict_to: [minter];
        burn => restrict_to: [admin, minter];
        get_balance => PUBLIC;
        internal_only => NOBODY;
    }
}
```

Rule: method auth maps method names to role names. The actual role rules are supplied when the component or resource is instantiated.

Done when: method-level access is classified as public, nobody, or role-protected, and the role name is traced to an instantiated role rule.

### Configure function authorization in a Scrypto blueprint

Use this when static blueprint functions, especially constructors, need access control before an object exists.

Start with:

- `./.repos/radixdlt-scrypto/scrypto/src/macros.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/package/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/proof_rule.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/auth/auth_module.rs`

Pattern:

```rust
enable_function_auth! {
    instantiate_private => rule!(require(admin_badge));
    instantiate_open => rule!(allow_all);
}
```

Rule: function auth belongs to package auth config and produces `FunctionAuth::AccessRules`. It is separate from method auth, because no component role assignment exists until after instantiation.

Done when: every exposed function is classified as open, protected, or intentionally inaccessible, and constructor authorization is tested before any method role logic is considered.

### Initialize roles for a component or resource

Use this when instantiation must bind named roles to concrete rules.

Start with:

- `./.repos/radixdlt-scrypto/scrypto/src/macros.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/component/component.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/resource/resource_builder.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/role_assignment.rs`

Pattern:

```rust
let roles = roles! {
    admin => rule!(require(admin_badge));
    minter => FallToOwner::OWNER;
};

ResourceBuilder::new_fungible(OwnerRole::Updatable(rule!(require(admin_badge))))
    .mint_roles(mint_roles! {
        minter => rule!(require(admin_badge));
        minter_updater => rule!(deny_all);
    });
```

Rule: use this guide to choose the access rules stored under each role name. Use `./references/guide-role-assignment.md` for `FallToOwner::OWNER`, role storage, updater roles, and role-assignment events.

Done when: owner role, named roles, updater roles, and fallback-to-owner behavior are all accounted for in the instantiated component or resource.

### Trace how a method call becomes an authorization check

Use this when a protected method fails unexpectedly or a blueprint macro change needs to be checked against engine behavior.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/auth/auth_module.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/auth/authorization.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/role_assignment.rs`

Pattern:

```text
MethodAuthTemplate
  -> MethodAccessibility
  -> ResolvedPermission
  -> RoleList or AccessRule
  -> AccessRule::AllowAll | DenyAll | Protected(requirement)
  -> auth-zone proof checks
```

Rule: `Public` resolves to `AllowAll`. `OwnPackageOnly` and `OuterObjectOnly` become virtual caller requirements. `RoleProtected(role_list)` resolves each role key against the role-assignment module; role lists use any-of semantics.

Rule: the reserved `_self_` role resolves to `require(global_caller(role_assignment_of))`. A missing stored role rule falls back to the owner role rule, not to allow-all.

Done when: the failed call is traced from method name to `MethodAccessibility`, resolved role list or access rule, and the exact auth-zone proof source checked by `authorization.rs`.

### Keep generated role rules inside engine limits

Use this when access rules or roles are generated from user input, config, an admin UI, or a manifest builder.

Start with:

- `./.repos/radixdlt-scrypto/radix-common/src/constants/transaction_execution.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/checkers/role_assignment_db_checker.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/system_access_rule.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/system_role_assignment.rs`

Pattern:

```text
MAX_ACCESS_RULE_DEPTH = 8
MAX_COMPOSITE_REQUIREMENTS = 64
```

Rule: `verify_access_rule` walks composite requirement nodes and rejects excessive depth or node count. Role-key length, reserved names, reserved module space, invalid names, and role counts belong to role-assignment validation.

Done when: generated access rules are bounded before submission and tests cover at least one too-deep rule and one too-wide rule. If role names are generated, route those checks to `./references/guide-role-assignment.md`.

### Encode an access rule as manifest enum payloads

Use this when TypeScript emits RTM or a manifest helper needs exact enum values for an `AccessRule`.

Start with:

- `./.repos/radixdlt-scrypto/radix-common/src/data/scrypto/custom_well_known_types.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/proof_rule.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/role_assignment/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/access_rule/access_rule.rtm`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/createFungibleToken.ts`
- `./references/guide-role-assignment.md`

Pattern:

```rtm
Enum<0u8>()

Enum<1u8>()

Enum<2u8>(
    Enum<0u8>(
        Enum<0u8>(
            Enum<1u8>(
                Address("${resource_address}")
            )
        )
    )
);
```

The first payload is `AccessRule::AllowAll`, the second is `AccessRule::DenyAll`, and the nested payload is `AccessRule::Protected(BasicRequirement::Require(Resource(resource_address)))`.

Rule: `AccessRule`, `CompositeRequirement`, `BasicRequirement`, and `ResourceOrNonFungible` are well-known Scrypto types starting at `ROLE_ASSIGNMENT_TYPES_START`. Manifest text still exposes compatibility names such as `AccessRuleNode` and `ProofRule`, so verify both the Rust enum and `custom_well_known_types.rs` before changing numeric enum payloads. Use `./references/guide-role-assignment.md` for `OwnerRole`, `RoleKey`, and role update instructions.

Done when: every numeric discriminator is tied to the Rust enum definition, the manifest helper has a test or golden RTM fixture, and protected-rule payloads distinguish resource requirements from non-fungible requirements.

### Debug an authorization failure

Use this when a method call fails despite apparently correct signatures or badges.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/auth/authorization.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/auth/auth_module.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/resource/auth_zone/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/resources/auth_zone.rtm`

Pattern:

1. Confirm the method is protected by the expected role.
2. Confirm the role resolves to the expected access rule.
3. Confirm the required proof exists in the auth zone at the call site.
4. Confirm the rule does not exceed depth or node limits.

Rule: if the proof exists as a named proof but was never pushed or made available to the auth zone, authorization still fails.

Done when: the debug note identifies the protected method, resolved role rule, proof location at the call site, and whether failure came from missing proof, wrong proof, or rule shape.

### Work with SBOR or manifest encodings

Use this when access rules appear as manifest values, Gateway values, schema output, or transaction model payloads.

Start with:

- `./.repos/radixdlt-scrypto/radix-common/src/data/scrypto/custom_well_known_types.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/proof_rule.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/manifest/custom_value.rs`
- `./references/guide-sbor.md`

Pattern: decode by type first: `AccessRule`, `CompositeRequirement`, `BasicRequirement`, `ResourceOrNonFungible`, `OwnerRole`, and `RoleKey` have well-known Scrypto type data. Manifest text may preserve older names such as `AccessRuleNode` and `ProofRule` for compatibility.

Done when: the encoded value is tied to the Rust type and manifest/Scrypto encoding path, and numeric enum discriminators are verified against source before use.

## Reference Routes

- Owner role updates, reserved roles, role assignment storage, updater roles, `SET_ROLE`, `SET_OWNER_ROLE`, `LOCK_OWNER_ROLE`, and role-assignment events: use `./references/guide-role-assignment.md`.
- Resource role builders: inspect `resource_builder.rs` role examples for mint, burn, withdraw, deposit, recall, freeze, and metadata roles.
- Function-level auth: inspect `enable_function_auth!` in `scrypto/src/macros.rs`.
- Access-controller state machines: use `./references/guide-access-controllers.md` for recovery proposals, timed recovery, primary locking, and controlled-asset proof flows.
- Account deposit authorization: inspect account authorized depositor scenarios and generated examples.
- Engine limits: inspect `transaction_execution.rs`, `verify_access_rule`, and `system_access_rule.rs` before generating dynamic role rules.
- Manifest enum payloads: inspect `custom_well_known_types.rs`, `access_rule.rtm`, and tx-tool manifest helpers before writing numeric `Enum<...>` values.

Routing check: adjacent routing sends proof lifecycle issues to manifest/auth-zone docs, role storage issues to role-assignment source, and account deposit authorization to `guide-account.md`.

## Usage Notes

- Do not treat access rules as application sessions. Access rules only decide whether a proof satisfies on-ledger authorization.
- Keep role names, role rules, and method accessibility distinct.
- Prefer `rule!` and Scrypto role macros for Scrypto code; use manifest enum values only in RTM.
- Route role-key naming, reserved roles, and owner-role mutability through `./references/guide-role-assignment.md`.
- When a context document claims a discriminator or enum shape, verify it against `custom_well_known_types.rs` and the Rust enum definition.
