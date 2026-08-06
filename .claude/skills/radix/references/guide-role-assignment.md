# Role Assignment Guide

## Source Paths

Role assignment source paths:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/role_assignment/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/substates.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/events.rs`
- `./.repos/radixdlt-scrypto/radix-native-sdk/src/modules/role_assignment/role_assignment.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/modules/role_assignment.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/component/component.rs`

Manifest and test source paths:

- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/parser.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/e2e.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/system_role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/system_access_rule.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/system.rs`

## Mental Model

Role assignment answers "which access rule is currently stored for this named role?" It is a native object module attached to global objects. It stores:

- an owner-role field with an `OwnerRoleEntry`
- a key/value collection keyed by `ModuleRoleKey`, which combines `ModuleId` and `RoleKey`
- `AccessRule` values, or no role-specific value when a role falls back to owner

Keep three layers separate:

- Method accessibility says which role names can authorize a method.
- Role assignment stores the current access rule for those role names.
- Authorization checks whether proofs in the auth zone satisfy the resolved rule.

Owner role mutation is not the same as named role mutation. `OwnerRoleUpdater::None` makes owner updates impossible, `OwnerRoleUpdater::Owner` lets the current owner update itself, and `OwnerRoleUpdater::Object` lets the object update its own owner role. Named role updates are authorized by the role updater list in the blueprint auth template.

Reserved role names start with `_`. `_owner_` and `_self_` are reserved roles that can be referenced by auth definitions, but reserved role keys cannot be stored as normal role entries. `ModuleId::RoleAssignment` is reserved space; role entries belong to modules such as `Main`, `Metadata`, or `Royalty`.

## Examples

Use these examples when code or docs touch `RoleAssignmentInit`, owner role mutability, `SET_ROLE`, `SET_OWNER_ROLE`, `LOCK_OWNER_ROLE`, method role updates, module-specific roles, role-assignment events, or role-assignment validation failures.

### Map role assignment state before changing auth behavior

Use this when a change claims to alter who can call a method, update a role, or lock an owner role.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/role_assignment/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/substates.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./references/guide-access-rules.md`

Pattern:

```text
RoleAssignment
  owner field -> OwnerRoleEntry { rule, updater }
  role_assignment collection -> ModuleRoleKey { module, key } -> AccessRule

Method accessibility -> role list
Role assignment -> access rule for each role
Auth zone -> proofs checked against the resolved rule
```

Rule: do not collapse method auth, role storage, and proof checks into one concept. Trace the method to its role list, the role list to stored rules, and stored rules to auth-zone proofs.

Done when: the target method, module ID, role key, stored access rule, updater authority, and required proof source are each named separately.

### Choose owner role mutability

Use this when component, resource, package, account, pool, validator, or access-controller creation accepts an owner role.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./references/guide-access-rules.md`

Pattern:

```rust
let no_owner = OwnerRole::None;
let fixed_owner = OwnerRole::Fixed(rule!(require(admin_badge)));
let updatable_owner = OwnerRole::Updatable(rule!(require(admin_badge)));
```

Rule: `OwnerRole::None` becomes a deny-all owner rule with no updater. `OwnerRole::Fixed(rule)` stores the rule with no updater. `OwnerRole::Updatable(rule)` stores the rule with owner-controlled updater behavior.

Done when: the owner access rule, owner updater, owner proof source, and expected behavior after `LOCK_OWNER_ROLE` are tested.

### Define initial roles for a globalized object

Use this when a blueprint constructor, resource builder, or package publish path attaches initial role assignment data.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/role_assignment/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/role_assignment.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/component/component.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/modules/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/system_role_assignment.rs`
- `./references/guide-components-packages.md`

Pattern:

```rust
let component = state
    .instantiate()
    .prepare_to_globalize(OwnerRole::Updatable(rule!(require(admin_badge))))
    .roles(roles_init! {
        admin => rule!(require(admin_badge));
        minter => FallToOwner::OWNER;
    })
    .globalize();
```

Rule: `RoleAssignmentInit` maps role keys to either a concrete `AccessRule` or no concrete rule. `FallToOwner::OWNER` stores no role-specific access rule and delegates role resolution to owner behavior.

Done when: every role named by method auth has an intentional initial rule or owner fallback, and tests prove both successful and failed access.

### Update roles through manifests

Use this when writing RTM, `ManifestBuilder` helpers, CLI examples, or docs for changing roles after an entity exists.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/e2e.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/parser.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/role_assignment.rs`
- `./references/guide-transaction-manifest.md`

Pattern:

```rtm
SET_OWNER_ROLE
    Address("${resource_address}")
    Enum<0u8>();

LOCK_OWNER_ROLE
    Address("${resource_address}");

SET_ROLE
    Address("${component_address}")
    Enum<0u8>()
    "admin"
    Enum<1u8>();
```

Rule: the friendly RTM instructions decompile from `CallRoleAssignmentMethod`. `ManifestBuilder::set_owner_role`, `lock_owner_role`, `set_main_role`, and `set_role` call the role-assignment module on the target global address.

Done when: the manifest names the target entity, target module ID, role key, new rule, and proof that authorizes the update.

### Route main, metadata, and royalty roles to the correct module

Use this when a role name looks correct but the update or authorization affects the wrong module.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/role_assignment/invocations.rs`
- `./.repos/radixdlt-scrypto/scrypto/src/modules/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-native-sdk/src/modules/role_assignment/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./references/guide-metadata.md`
- `./references/guide-royalties.md`

Pattern:

```rust
role_assignment.set_role(ModuleId::Main, "admin", rule!(require(admin_badge)), api)?;
role_assignment.set_role(ModuleId::Metadata, "metadata_setter", rule!(require(admin_badge)), api)?;
role_assignment.set_role(ModuleId::Royalty, "royalty_setter", rule!(require(admin_badge)), api)?;
```

Rule: role keys are scoped by `ModuleId`. The same role string on `Main`, `Metadata`, and `Royalty` is not the same stored entry. `ModuleId::RoleAssignment` is reserved and cannot be used for normal role entries. Use `./references/guide-royalties.md` for the meaning of `royalty_setter`, `royalty_locker`, and `royalty_claimer`.

Done when: the change names the module ID explicitly and tests prove the intended module's behavior changed while adjacent modules did not change accidentally.

### Respect reserved roles and validation limits

Use this when a dynamic role name, generated role table, or role update fails before authorization reaches the target method.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/system_role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/system.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/system_access_rule.rs`
- `./references/guide-error-diagnostics.md`

Pattern:

```text
role key starts with "_" -> UsedReservedRole or unauthorized reserved role update
module is RoleAssignment -> UsedReservedSpace
role name too long -> ExceededMaxRoleNameLen
too many roles -> ExceededMaxRoles
access rule too deep or broad -> ExceededMaxAccessRuleDepth or ExceededMaxAccessRuleNodes
unattached module role update -> CannotSetRoleIfNotAttached
```

Rule: validation failures can occur while creating role assignment state or while later setting a role. Keep validation errors separate from auth-zone proof failures.

Done when: every generated role key is checked for reserved prefix, length, module ID, access-rule limits, and attached-module state before blaming missing proofs.

### Decode role assignment events

Use this when committed transaction details, transaction streams, or receipt tests need to explain role changes.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/radix-substate-store-queries/src/typed_native_events.rs`
- `./.repos/radix-web3.js/packages/transaction-stream/src/schemas.ts`
- `./references/guide-receipts-events.md`
- `./references/guide-sbor.md`

Pattern:

```text
SetRoleEvent { role_key, rule }
SetOwnerRoleEvent { rule }
LockOwnerRoleEvent {}
```

Rule: role assignment events describe the role-assignment module operation, not whether all future protected methods are now callable. Interpret the emitted rule with the target module and method auth template.

Done when: the event handler records transaction ID, state version, target entity, event name, role key if present, decoded access rule, and owner-lock state if present.

### Diagnose role update authorization failures

Use this when `SET_ROLE`, `SET_OWNER_ROLE`, or `LOCK_OWNER_ROLE` fails with `AuthError::Unauthorized`.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/auth/authorization.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/role_assignment.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/auth_scenarios.rs`
- `./references/guide-access-rules.md`
- `./references/guide-error-diagnostics.md`

Pattern:

```text
set owner or lock owner -> resolve owner updater -> require owner rule or deny-all
set named role -> resolve updater role list from blueprint method auth template
reserved role or RoleAssignment module -> no authorizing role list
proof created but not in auth zone -> authorization still fails
```

Rule: failed role updates can mean the owner updater is locked, the role updater list does not include a satisfiable role, the role is reserved, or the needed proof was never present at the module call site.

Done when: the diagnostic names the attempted role-assignment method, owner updater or updater role list, expected proof, actual proof location, and structured failure variant.

## Reference Routes

- Role assignment state, owner role mutation, role update manifests, module-specific roles, role-assignment events, and role-assignment validation: use this guide first.
- Access-rule tree shape, `rule!` macro behavior, composite requirements, virtual badges, and auth-zone proof lifecycle: use `./references/guide-access-rules.md`.
- Package publishing, component instantiation, globalize-time roles, and object-module attachment: use `./references/guide-components-packages.md`.
- Metadata setter/locker roles and metadata value behavior: use `./references/guide-metadata.md`.
- Royalty setter, locker, claimer, and updater roles: use `./references/guide-royalties.md`.
- RTM syntax, manifest values, and transaction model instruction boundaries: use `./references/guide-transaction-manifest.md`.
- Receipt decoding, detailed events, and transaction stream opt-ins: use `./references/guide-receipts-events.md`.

Routing check: choose this guide when the role table or owner-role updater is being changed; choose access-rules when the proof rule shape is being changed.

## Usage Notes

- Treat role assignment as storage and mutation policy for rules; treat access rules as the values being stored.
- Keep `ModuleId` explicit in helper names and error messages when roles can target `Main`, `Metadata`, or `Royalty`.
- Do not create application role names that start with `_`; reserved roles are protocol names, not normal user roles.
- When tests update a role, assert both the role assignment result and at least one protected method behavior after the update.
- For dynamic role generation, test role count, name length, invalid characters, and access-rule depth before adding feature-specific cases.
