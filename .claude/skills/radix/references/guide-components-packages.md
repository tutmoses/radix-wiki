# Components And Packages Guide

## Source Paths

Scrypto and engine source paths:

- `./.repos/radixdlt-scrypto/scrypto/src/component/component.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/component/package.rs`
- `./.repos/radixdlt-scrypto/scrypto-test/src/sdk/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/component.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/package/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/role_assignment/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/royalty/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/package/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/metadata/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/royalty/package.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/package/publish.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/metadata/manifests/002--metadata-create-component-with-metadata.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/manifests/002--royalties--instantiate-components.rtm`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/allocated_address.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/package_schema.rs`

TypeScript source paths:

- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radix-web3.js/packages/sbor/src/native.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getComponentState.ts`
- `./.repos/radix-web3.js/packages/gateway/src/state/getEntityDetailsVaultAggregated.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifestV2.ts`

## Mental Model

A package is a global code container. It exposes blueprint definitions, function schemas, auth configuration, royalties, and package metadata.

A blueprint is the type-level contract inside a package. It names functions, methods, state fields, events, role definitions, and module behavior.

A component is a global instance created from a blueprint. Scrypto usually creates an owned object first, then globalizes it with owner role, role assignment, metadata, optional royalties, and optional address reservation.

Keep these boundaries separate:

- package address plus blueprint plus function is a `CALL_FUNCTION` target
- component or other global address plus method is a `CALL_METHOD` target
- metadata and role assignment are object modules attached to packages, components, resources, and accounts
- Gateway component reads are ledger read models, not proof that a manifest call is valid
- TypeScript branded `PackageAddress` and `ComponentAddress` are lightweight type boundaries; source and manifest validation still decide protocol validity

## Examples

Use these examples when code or docs touch Scrypto package publishing, blueprint functions, component instantiation, global addresses, component metadata, role assignment, Gateway component state, or package/component address types.

### Publish a Scrypto package

Use this when adding package publish instructions, reviewing package deploy manifests, or explaining how a package address is produced.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/package/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/package/package.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/package/publish.rtm`
- `./.repos/radixdlt-scrypto/scrypto-test/src/sdk/package.rs`

Pattern:

```rtm
PUBLISH_PACKAGE_ADVANCED
    Enum<AccessRule::AllowAll>()
    Tuple(Map<String, Tuple>())
    Blob("${code_blob_hash}")
    Map<String, Tuple>()
    None;
```

Rule: package publishing is a package blueprint function under the native package package. For Rust builder code, prefer `publish_package_advanced` when owner role, metadata, or address reservation matters; use the simpler helper only when those defaults are intentional.

Done when: the guide, manifest, or helper names the Wasm blob source, package definition source, owner role, metadata, address reservation policy, and the resulting package address handling.

### Instantiate and globalize a component

Use this when a blueprint function creates a component, a manifest calls a constructor, or Scrypto code uses `instantiate`, `prepare_to_globalize`, or `globalize`.

Start with:

- `./.repos/radixdlt-scrypto/scrypto/src/component/component.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/component.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/manifests/002--royalties--instantiate-components.rtm`
- `./references/guide-transaction-manifest.md`
- `./references/guide-royalties.md`

Pattern:

```rust
let component = state
    .instantiate()
    .prepare_to_globalize(owner_role)
    .metadata(metadata_config)
    .roles(role_assignment)
    .globalize();
```

Rule: a component address exists after globalize. Before globalize, the object is owned or being globalized and can still receive module configuration such as metadata, royalties, roles, and address reservation. Use `./references/guide-royalties.md` for the component royalty config and role details.

Done when: the flow identifies the blueprint function, owned state creation, globalize call, attached modules, and resulting component address.

### Choose `CALL_FUNCTION` or `CALL_METHOD`

Use this when a manifest or helper is calling package code, a native blueprint, an account, a resource manager, or an existing component.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/royalties/manifests/002--royalties--instantiate-components.rtm`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifest.ts`
- `./references/guide-transaction-manifest.md`

Pattern:

```rtm
CALL_FUNCTION
    Address("${package_address}")
    "BlueprintName"
    "new";

CALL_METHOD
    Address("${component_address}")
    "method_name";
```

Rule: `CALL_FUNCTION` targets package address, blueprint name, and function name. `CALL_METHOD` targets an existing global address and method name. Do not infer the instruction from English words such as "create" or "call"; verify the target shape.

Done when: every invocation in the manifest has a target classification, argument tuple shape, and source-backed instruction type.

### Reserve a component address before instantiation

Use this when a manifest needs to know a component address before the component exists, such as setting metadata on the future address or passing the address into the constructor.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/allocated_address.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/metadata/manifests/002--metadata-create-component-with-metadata.rtm`
- `./references/guide-transaction-manifest.md`

Pattern:

```rtm
ALLOCATE_GLOBAL_ADDRESS
    Address("${package_address}")
    "BlueprintName"
    AddressReservation("component_reservation")
    NamedAddress("component_address");

CALL_FUNCTION
    Address("${package_address}")
    "BlueprintName"
    "new_with_address"
    AddressReservation("component_reservation");
```

Rule: the address reservation is consumed by the constructor or globalize path. The named address is for later manifest references. Tests should cover missing, duplicated, mismatched, or unconsumed reservation behavior when helpers accept dynamic names.

Done when: the manifest proves the reservation is created, consumed by the intended blueprint, and referenced only where a future global address is valid.

### Attach metadata to packages or components

Use this when writing `SET_METADATA`, `LOCK_METADATA`, component metadata, package metadata, or dApp definition metadata.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/metadata/package.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/metadata/manifests/002--metadata-create-component-with-metadata.rtm`
- `./references/guide-metadata.md`
- `./references/guide-access-rules.md`

Pattern:

```rtm
SET_METADATA
    Address("${component_or_package_address}")
    "name"
    Enum<0u8>("My Component");

LOCK_METADATA
    Address("${component_or_package_address}")
    "name";
```

Rule: metadata is an object module call, not a main blueprint method. Verify detailed metadata value enum shape, key limits, setter role, and locker role in `./references/guide-metadata.md` before changing manifests or helper defaults.

Done when: the metadata target, key, value type, mutability, setter role, and locker role are all explicit.

### Wire owner roles and method roles

Use this when a component, resource, package, or module needs owner role behavior, method roles, or role updates after creation.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/role_assignment/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/component/component.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/modules/role_assignment.rs`
- `./references/guide-role-assignment.md`
- `./references/guide-access-rules.md`

Pattern:

```rust
let component = state
    .instantiate()
    .prepare_to_globalize(OwnerRole::Updatable(rule!(require(admin_badge))))
    .roles(roles_init! {
        admin => rule!(require(admin_badge));
    })
    .globalize();
```

Rule: role assignment resolves named roles to access rules for a module. Owner role mutability and method role updates are separate decisions; use `./references/guide-role-assignment.md` when role storage, updater roles, or role update manifests matter.

Done when: the owner role, owner updater, method role names, role updater list, and protected method mapping are all traceable to source.

### Read component state through Gateway

Use this when TypeScript needs component state, attached vault data, or component details for application logic.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/getComponentState.ts`
- `./.repos/radix-web3.js/packages/gateway/src/state/getEntityDetailsVaultAggregated.ts`
- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radix-web3.js/packages/sbor/src/native.ts`
- `./references/guide-gateway.md`
- `./references/guide-sbor.md`

Pattern:

```text
state.getEntityDetailsVaultAggregated -> filter Component details -> decode state with Effect Schema
```

Rule: Gateway component state is a decoded read model at a ledger state. Keep the component address, ledger state, response detail type, SBOR shape, and application schema separate in TypeScript.

Done when: the read path validates component details, handles non-component results intentionally, pins or passes ledger state when needed, and tests malformed state decoding.

### Keep package and component address types distinct

Use this when adding schemas, helpers, manifests, or Gateway calls that accept both package and component addresses.

Start with:

- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radix-web3.js/packages/sbor/src/native.ts`
- `./.repos/radixdlt-scrypto/radix-common/src/types/addresses/package_address.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/types/addresses/component_address.rs`
- `./references/guide-network-addresses.md`

Pattern:

```text
PackageAddress -> package code and blueprint definitions
ComponentAddress -> global component instance
SBOR Reference -> address value crossing Gateway or manifest boundaries
```

Rule: TypeScript brands are compile-time guidance only. Validate network, entity type, and SBOR type at boundaries when addresses come from users, Gateway, manifests, or environment config.

Done when: package and component addresses have different parameter names, schemas, tests, and error messages.

### Test component and package behavior

Use this when adding tests for package schemas, component constructors, address allocation, metadata, or function argument validation.

Start with:

- `./.repos/radixdlt-scrypto/scrypto-test/src/sdk/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/package_schema.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/allocated_address.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata2.rs`
- `./references/guide-testing.md`

Pattern:

```rust
let package_address = ledger.publish_package_simple(PackageLoader::get("package_name"));
let manifest = ManifestBuilder::new()
    .lock_fee_from_faucet()
    .call_function(package_address, "Blueprint", "function", manifest_args!())
    .build();
```

Rule: test the protocol boundary you are relying on. Schema mismatch belongs in package schema tests, address reservation belongs in allocation tests, metadata bounds belong in metadata tests, and TypeScript wrappers should keep fixtures close to the generated manifest or Rust test they mirror.

Done when: each success case has a source-backed negative case for wrong argument shape, wrong address type, missing role, invalid metadata, or bad address reservation as appropriate.

## Reference Routes

- Package publishing, component instantiation, `CALL_FUNCTION`, `CALL_METHOD`, address reservation, and package/component lifecycle: use this guide first.
- Metadata value shape, metadata roles, `SET_METADATA`, `REMOVE_METADATA`, `LOCK_METADATA`, metadata events, and metadata validation: use `./references/guide-metadata.md`.
- Owner role mutation, named role storage, role update manifests, module-specific roles, and role-assignment events: use `./references/guide-role-assignment.md`.
- Package royalties, component royalty modules, royalty amounts, royalty roles, and claim manifests: use `./references/guide-royalties.md`.
- Manifest instruction syntax and V1/V2 constraints: use `./references/guide-transaction-manifest.md`.
- Owner roles, method roles, protected methods, auth-zone proofs, and authorization failures: use `./references/guide-access-rules.md`.
- Resource managers, buckets, vaults, and proofs attached to component behavior: use `./references/guide-resources-vaults.md`.
- Gateway component reads, component state schemas, and ledger state consistency: use `./references/guide-gateway.md`.
- Address HRP, entity type validation, network IDs, and known native addresses: use `./references/guide-network-addresses.md`.

Routing check: choose this guide when the task is about package or component lifecycle; choose adjacent guides only after the package/component boundary is clear.

## Usage Notes

- Use Scrypto source for owned versus global component behavior and module attachment.
- Use `radix-transactions` source for manifest instruction shape, generated RTM, and builder helpers.
- Use Gateway package source for reading component state; do not infer execution semantics from Gateway responses.
- Keep package, blueprint, component, resource manager, account, and object-module calls separate in code and docs.
