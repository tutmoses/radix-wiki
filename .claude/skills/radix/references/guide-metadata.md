# Metadata Guide

## Source Paths

Metadata module source paths:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/models/mod.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/models/url.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/models/origin.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/roles.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/metadata/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/metadata/events.rs`
- `./.repos/radixdlt-scrypto/radix-native-sdk/src/modules/metadata/metadata.rs`

Manifest and scenario source paths:

- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/parser.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/e2e.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/metadata/manifests/001--metadata-create-package-with-metadata.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/metadata/manifests/002--metadata-create-component-with-metadata.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/metadata/manifests/003--metadata-create-resource-with-metadata.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/metadata/manifests/007--metadata-lock-metadata.rtm`

Test source paths:

- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata_component.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata_package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata_validator.rs`

## Mental Model

Metadata is an object module attached to global entities such as packages, components, resources, accounts, pools, validators, and access-controller-related objects. It is not a Scrypto blueprint method on the main object. The manifest layer compiles friendly metadata instructions into a call against the metadata module.

Think of metadata as a typed, SBOR-encoded key/value store:

- keys are strings with a protocol length limit
- values are `MetadataValue` enum variants
- scalar and array value variants use different discriminators
- URL and origin values have extra validation
- entries can be initialized as updatable, initialized as locked, locked later, removed, or read

The native module has a small operation set: `create`, `create_with_data`, `set`, `lock`, `get`, and `remove`. Mutation is role-gated by metadata roles. Reads are public. Locks are per key and use the engine's locked key/value entry behavior, so a later `SET_METADATA` on that key fails even if the caller otherwise has permission.

Do not flatten metadata into plain JSON. For protocol behavior, start at `MetadataValue`, `ManifestMetadataValue`, validation, and module roles. For user-facing code, separately decide how Gateway or application schemas represent decoded values.

## Examples

Use these examples when code or docs touch `SET_METADATA`, `REMOVE_METADATA`, `LOCK_METADATA`, `MetadataValue`, package/component/resource metadata, account metadata, metadata roles, metadata events, or metadata validation failures.

### Map the metadata module operation before editing

Use this when changing a helper, manifest compiler, native module wrapper, or diagnostic that says metadata is set, removed, locked, read, or initialized.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/metadata/package.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./references/guide-transaction-manifest.md`

Pattern:

```text
SET_METADATA -> Metadata::set(key, value) -> SetMetadataEvent
REMOVE_METADATA -> Metadata::remove(key) -> RemoveMetadataEvent
LOCK_METADATA -> Metadata::lock(key) -> locked key/value entry
get -> public module method returning Option<MetadataValue>
create_with_data -> validates MetadataInit before object creation
```

Rule: identify whether the code is using a manifest instruction, `ManifestBuilder`, the native SDK wrapper, or the engine implementation. The friendly RTM instructions decompile from `CallMetadataMethod`; the engine still executes metadata module methods.

Done when: the operation name, target global address, key, value or absence of value, role requirement, and event or return value are all traced to source.

### Choose the correct metadata value shape

Use this when adding metadata values, writing RTM, decoding Gateway payloads, or building typed tests for metadata values.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/models/mod.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/models/url.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/models/origin.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata_component.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/metadata/manifests/002--metadata-create-component-with-metadata.rtm`
- `./references/guide-sbor.md`

Pattern:

```rtm
SET_METADATA
    Address("${component_address}")
    "name"
    Enum<0u8>("My Component");

SET_METADATA
    Address("${component_address}")
    "u8_array"
    Enum<130u8>(Bytes("0102"));

SET_METADATA
    Address("${component_address}")
    "url"
    Enum<13u8>("https://www.radixdlt.com");
```

Rule: scalar and array values have separate enum discriminators. Use `MetadataValue` and the generated metadata scenarios as the source of truth for RTM shape. URL values allow HTTP or HTTPS URLs with paths, queries, and fragments; origin values allow only scheme, host, and optional port.

Done when: the key has an explicit metadata value type, the RTM or SBOR discriminator matches `MetadataValue`, and URL/origin validation is tested for both accepted and rejected values.

### Initialize metadata during entity creation

Use this when package publishing, component globalizing, resource creation, or tests need metadata before the entity is first used.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/models/mod.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/component/component.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/resource/resource_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/metadata/manifests/001--metadata-create-package-with-metadata.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/metadata/manifests/003--metadata-create-resource-with-metadata.rtm`
- `./references/guide-components-packages.md`

Pattern:

```rust
let metadata = metadata! {
    init {
        "name" => "Example Component", updatable;
        "icon_url" => UncheckedUrl::of("https://example.com/icon.png"), locked;
    }
};
```

Rule: initialization uses `MetadataInit` or `ManifestMetadataInit`. `set_metadata` initializes an updatable value; `set_and_lock_metadata` initializes a locked value; a `None` metadata entry can create a locked empty key.

Done when: creation code records which metadata entries are updatable, which are locked, which owner or metadata roles can change them later, and which scenario or test proves the initial state.

### Update, remove, and lock metadata in manifests

Use this when writing RTM, `ManifestBuilder` code, CLI examples, or docs for changing metadata after an entity already exists.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/e2e.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/parser.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata_component.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/metadata/manifests/007--metadata-lock-metadata.rtm`
- `./references/guide-transaction-manifest.md`

Pattern:

```rtm
SET_METADATA
    Address("${resource_address}")
    "name"
    Enum<0u8>("Updated Name");

LOCK_METADATA
    Address("${resource_address}")
    "name";

REMOVE_METADATA
    Address("${resource_address}")
    "legacy_key";
```

Rule: `ManifestBuilder::set_metadata` emits `set` when `ToMetadataEntry` returns `Some(value)` and emits `remove` when it returns `None`. RTM also has explicit `REMOVE_METADATA` and `LOCK_METADATA` instructions.

Done when: update, remove, and lock paths are tested separately, and a locked-key failure proves that later writes to the locked key are rejected.

### Wire metadata roles and owner proofs

Use this when metadata mutation succeeds for one entity type but fails for another, or when adding owner-badge, validator-badge, package-owner, or custom role behavior.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/roles.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/metadata/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata_package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata_validator.rs`
- `./references/guide-access-rules.md`
- `./references/guide-account.md`

Pattern:

```text
metadata_setter -> set and remove
metadata_locker -> lock
metadata_setter_updater -> updates metadata_setter role rule
metadata_locker_updater -> updates metadata_locker role rule
get -> public
```

Rule: metadata mutation is a module authorization check. Package and validator tests show owner-badge proof requirements; account metadata uses account owner proofs; custom components can provide metadata role config at globalize time.

Done when: the caller proof, target entity type, metadata role, updater rule, and negative unauthorized case are explicit.

### Read and type-convert metadata safely

Use this when code reads metadata and expects a string, address, public key hash, URL, array, or other concrete type.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/metadata/models/mod.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/metadata/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata_component.rs`
- `./references/guide-sbor.md`

Pattern:

```rust
let value = ledger.get_metadata(entity.into(), "key");
let Some(value) = value else {
    return None;
};
let typed = String::from_metadata_value(value)?;
```

Rule: a missing key is `None`, not an empty string. A present key can still be the wrong metadata variant. Use `MetadataVal::from_metadata_value` or explicit matching so type mismatches surface as `UnexpectedType` instead of silently coercing values.

Done when: missing-key behavior, wrong-type behavior, scalar-versus-array behavior, and successful typed conversion are all covered.

### Decode metadata events from receipts or streams

Use this when committed transaction details, transaction streams, or receipt tests need to identify metadata changes.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/metadata/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/metadata/package.rs`
- `./.repos/radixdlt-scrypto/radix-substate-store-queries/src/typed_native_events.rs`
- `./.repos/radix-web3.js/packages/transaction-stream/src/schemas.ts`
- `./references/guide-receipts-events.md`
- `./references/guide-transaction-stream.md`

Pattern:

```text
SetMetadataEvent { key, value }
RemoveMetadataEvent { key }
```

Rule: metadata event names are not enough. Decode by emitter/module context, then validate payload shape. `SetMetadataEvent` carries the full `MetadataValue`; `RemoveMetadataEvent` carries only the key.

Done when: the handler records transaction ID, state version, emitting entity, event name, metadata key, decoded value when present, and unsupported-value handling.

### Test metadata validation and lock failures

Use this when changing validation, adding a metadata wrapper, or diagnosing a transaction that fails after a metadata instruction.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/metadata/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata2.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata_component.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/metadata/manifests/005--metadata-update-initially-locked-metadata-fails.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/metadata/manifests/010--metadata-update-recently-locked-metadata-fails.rtm`
- `./references/guide-error-diagnostics.md`

Pattern:

```text
key too long -> MetadataKeyValidationError::InvalidLength
value SBOR too long -> MetadataValueValidationError::InvalidLength
bad URL -> MetadataValueValidationError::InvalidURL
bad origin -> MetadataValueValidationError::InvalidOrigin
locked key -> SystemError::KeyValueEntryLocked
missing proof -> AuthError::Unauthorized
```

Rule: validation failures are not all authorization failures. Keep key/value validation, URL/origin validation, locked-entry errors, and missing-proof errors in separate diagnostic branches.

Done when: each expected failure maps to a structured error variant and the test proves the target metadata entry was not changed.

## Reference Routes

- Metadata values, metadata keys, `SET_METADATA`, `REMOVE_METADATA`, `LOCK_METADATA`, metadata roles, metadata events, and metadata validation: use this guide first.
- Package publishing, component instantiation, address reservations, globalize-time module attachment, and component state reads: use `./references/guide-components-packages.md`.
- Resource manager metadata, pool metadata, account metadata, or validator metadata at a domain level: use the matching resource, pool, account, or validator guide after this guide.
- Manifest instruction syntax, RTM value shape, worktop/proof interactions, and address allocation: use `./references/guide-transaction-manifest.md`.
- Authorization failures, owner roles, role assignment, and auth-zone proof requirements: use `./references/guide-access-rules.md`.
- Event decoding, detailed events opt-ins, transaction stream payloads, and native event routing: use `./references/guide-receipts-events.md`.

Routing check: choose this guide when metadata itself is the behavior being changed; choose adjacent guides when metadata is only part of a broader package, resource, account, pool, validator, manifest, or event task.

## Usage Notes

- Treat metadata source facts from scraped context as candidates only; verify against `radixdlt-scrypto` source before using them.
- Keep metadata module calls separate from primary blueprint method calls in manifests and diagnostics.
- Prefer `MetadataValue`, `ManifestMetadataValue`, and `ToMetadataEntry` over ad hoc strings or JSON when writing protocol-facing code.
- Include a negative test for every metadata mutation helper: unauthorized caller, locked key, invalid value, or wrong value type.
- When user-facing code reads metadata, preserve enough raw value information to debug unsupported or newly added metadata variants.
