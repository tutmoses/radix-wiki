# Account Lockers Guide

## Source Paths

Rust source paths:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/locker/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/locker/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/locker/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/locker/state.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/locker/events.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/account_locker.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/account_locker.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/account_locker/manifests/002--account-locker-create-account-locker.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/account_locker/manifests/005--account-locker-send-fungibles-and-try-direct-deposit-succeeds.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/account_locker/manifests/006--account-locker-send-fungibles-and-try-direct-deposit-refunds.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/account_locker/manifests/018--account-locker-claim-fungibles-by-amount.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/account_locker/manifests/020--account-locker-claim-non-fungibles-by-ids.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/account_locker/manifests/021--account-locker-recover-fungibles-by-amount.rtm`

TypeScript source paths:

- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`

## Mental Model

An account locker is a native component for resources owed to accounts. It is useful when a sender needs to deliver or allocate resources but the recipient account deposit rules may reject a direct deposit.

Keep these roles separate:

- the locker component address is the method target
- the claimant is the account that owns the pending claim
- `storer` can call `store` and `airdrop`
- `recoverer` can call `recover` and `recover_non_fungibles`
- the claimant account owner can call public `claim` and `claim_non_fungibles`, because the blueprint reads and asserts the claimant account owner role
- `instantiate_simple` creates a locker plus an admin badge; `allow_recover` decides whether that badge can recover

The locker state is a collection keyed by account. Each account entry points to a key-value store keyed by resource address, with a vault for the resources owed to that claimant.

`try_direct_send` controls the first step of storage. When true, the locker first calls account `try_deposit_or_refund` using the locker as the authorized depositor badge. If the deposit succeeds, nothing is stored in the locker. If the deposit refunds, the returned bucket is stored and a `StoreEvent` is emitted. When false, the bucket is stored immediately.

## Examples

Use these examples when code or docs touch account locker creation, deposit fallback, airdrops, claimant claims, recoverer withdrawals, pending claim reads, account deposit rules, or locker events.

### Instantiate a simple account locker

Use this when creating a locker for an app or scenario and the default admin badge model is enough.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/locker/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/locker/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/account_locker.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/account_locker/manifests/002--account-locker-create-account-locker.rtm`
- `./references/guide-components-packages.md`

Pattern:

```rust
ManifestBuilder::new()
    .lock_fee_from_faucet()
    .call_function(
        LOCKER_PACKAGE,
        ACCOUNT_LOCKER_BLUEPRINT,
        ACCOUNT_LOCKER_INSTANTIATE_SIMPLE_IDENT,
        AccountLockerInstantiateSimpleManifestInput { allow_recover: true },
    )
    .try_deposit_entire_worktop_or_abort(admin_account, None)
    .build()
```

Rule: `instantiate_simple` returns the locker component and an admin badge bucket. Deposit the returned badge intentionally; it controls storer, updater, owner, and optionally recoverer authority.

Done when: the flow records the new locker address, admin badge resource address, admin badge destination account, and whether recover is enabled.

### Instantiate with explicit roles

Use this when a locker needs custom owner, storer, recoverer, updater, or address reservation behavior.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/locker/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/locker/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/account_locker.rs`
- `./references/guide-access-rules.md`
- `./references/guide-transaction-manifest.md`

Pattern:

```text
instantiate(
  owner_role,
  storer_role,
  storer_updater_role,
  recoverer_role,
  recoverer_updater_role,
  optional address reservation
)
```

Rule: locker roles live on the main module role assignment. `store` and `airdrop` use `storer`; `recover` and `recover_non_fungibles` use `recoverer`; claim methods are public but assert the claimant account owner role.

Done when: the manifest or constructor documents each role, each updater role, owner mutability, address reservation handling, and negative authorization coverage.

### Store resources for one claimant

Use this when a sender should deliver to one account if allowed, otherwise hold the resources for later claim.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/locker/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/locker/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/account_locker.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/account_locker/manifests/005--account-locker-send-fungibles-and-try-direct-deposit-succeeds.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/account_locker/manifests/006--account-locker-send-fungibles-and-try-direct-deposit-refunds.rtm`
- `./references/guide-account.md`

Pattern:

```rust
builder
    .create_proof_from_account_of_amount(admin_account, admin_badge, dec!(1))
    .take_all_from_worktop(resource_address, "bucket")
    .with_bucket("bucket", |builder, bucket| {
        builder.call_method(
            account_locker,
            ACCOUNT_LOCKER_STORE_IDENT,
            AccountLockerStoreManifestInput {
                claimant: claimant_account.into(),
                bucket,
                try_direct_send: true,
            },
        )
    })
```

Rule: `try_direct_send: true` can result in direct account deposit and no locker storage. `try_direct_send: false` always stores the bucket in the locker. Use receipt events and balance changes to distinguish direct delivery from stored claims.

Done when: the code proves storer authorization, claimant account address type, direct-send choice, final bucket location, and behavior for both accepted and refunded deposits.

### Airdrop one bucket across many claimants

Use this when one bucket should be split into per-account fungible amounts or non-fungible IDs.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/locker/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/locker/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/account_locker.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/account_locker.rs`
- `./references/guide-resources-vaults.md`

Pattern:

```rust
AccountLockerAirdropManifestInput {
    bucket,
    try_direct_send,
    claimants: indexmap! {
        account_a.into() => ResourceSpecifier::Fungible(dec!(100)),
        account_b.into() => ResourceSpecifier::Fungible(dec!(50)),
    },
}
```

Rule: `airdrop` takes from the input bucket for each `ResourceSpecifier` and internally calls `store` for every claimant. If the input bucket has resources left, the method returns the leftover bucket.

Done when: the manifest accounts for every requested claimant allocation, leftover bucket behavior, direct-send choice, and tests the limit or under-allocation behavior when relevant.

### Claim pending resources as the claimant

Use this when a claimant account should withdraw fungible or non-fungible resources owed by a locker.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/locker/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/locker/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/account_locker.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/account_locker/manifests/018--account-locker-claim-fungibles-by-amount.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/account_locker/manifests/020--account-locker-claim-non-fungibles-by-ids.rtm`
- `./references/guide-access-rules.md`

Pattern:

```rust
builder
    .call_method(
        account_locker,
        ACCOUNT_LOCKER_CLAIM_IDENT,
        AccountLockerClaimManifestInput {
            claimant: claimant_account.into(),
            resource_address: resource_address.into(),
            amount,
        },
    )
    .deposit_entire_worktop(claimant_account)
```

Rule: `claim` and `claim_non_fungibles` are public methods, but the blueprint reads the claimant account owner role and asserts it. The caller must provide whatever proof satisfies the claimant account owner role, then deposit the returned bucket.

Done when: the claim manifest includes claimant owner authority, uses the fungible or non-fungible method that matches the resource, deposits the returned bucket, and tests unauthorized claim attempts.

### Recover resources with recoverer authority

Use this when an admin or recovery path should remove resources from a claimant's locker entry instead of waiting for the claimant.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/locker/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/locker/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/account_locker.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/account_locker/manifests/021--account-locker-recover-fungibles-by-amount.rtm`
- `./references/guide-access-rules.md`

Pattern:

```rust
builder
    .create_proof_from_account_of_amount(admin_account, admin_badge, dec!(1))
    .call_method(
        account_locker,
        ACCOUNT_LOCKER_RECOVER_IDENT,
        AccountLockerRecoverManifestInput {
            claimant: claimant_account.into(),
            resource_address: resource_address.into(),
            amount,
        },
    )
    .try_deposit_entire_worktop_or_abort(admin_account, None)
```

Rule: recover methods are not claimant methods. They require the locker recoverer role and return the recovered bucket to the manifest worktop, so the manifest must route it to the intended destination.

Done when: the flow proves recoverer authorization, identifies the claimant whose locker entry is reduced, and records where the recovered bucket is deposited.

### Read pending locker balances

Use this when UI, CLI, or tests need to show claimable fungibles or non-fungible IDs for an account.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/locker/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/locker/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/locker/state.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/account_locker.rs`
- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./references/guide-gateway.md`

Pattern:

```text
get_amount(claimant, resource_address) -> Decimal
get_non_fungible_local_ids(claimant, resource_address, limit) -> IndexSet<NonFungibleLocalId>
```

Rule: locker reads return zero or an empty set when the claimant/resource vault does not exist. Preserve that empty state instead of treating it as a missing account or Gateway error.

Done when: the read path keeps locker address, claimant account address, resource address, and pagination or limit handling separate.

### Decode account locker events

Use this when transaction streams, receipts, or tests need to reconcile stored, claimed, and recovered resources.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/locker/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/account_locker.rs`
- `./.repos/radixdlt-scrypto/radix-substate-store-queries/src/typed_native_events.rs`
- `./references/guide-receipts-events.md`
- `./references/guide-sbor.md`

Pattern:

```text
StoreEvent { claimant, resource_address, resources }
RecoverEvent { claimant, resource_address, resources }
ClaimEvent { claimant, resource_address, resources }
ResourceSpecifier::Fungible(amount)
ResourceSpecifier::NonFungible(ids)
```

Rule: identify account locker events by emitter entity type plus event name. Event names alone are not enough. Store events add to pending state; claim and recover events subtract from pending state.

Done when: the event decoder checks emitter, event name, payload schema, claimant account, resource address, and fungible versus non-fungible `ResourceSpecifier`.

### Test invalid claimant addresses and deposit-rule edges

Use this when adding helpers around lockers, direct-send fallback, account deposit preferences, or claim/recover flows.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/account_locker.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/account_locker.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish/account_locker/manifests/004--account-locker-setting-up-account-deposit-rules.rtm`
- `./references/guide-account.md`
- `./references/guide-testing.md`

Pattern:

```text
non-account claimant -> blueprint payload validation failure
try_direct_send accepted -> account deposit, no stored claim
try_direct_send refunded -> stored claim and StoreEvent
recover disabled -> recoverer role denies
claim without claimant owner authority -> authorization failure
```

Rule: account lockers are defined around accounts. Tests should reject faucet, component, or other non-account addresses in claimant positions instead of silently accepting generic component addresses.

Done when: tests cover account type validation, storer authorization, recoverer authorization, claimant owner authorization, direct-send success, and direct-send refund.

## Reference Routes

- For account deposit rules and `try_deposit_or_refund`, read `./references/guide-account.md` with this guide.
- For bucket movement, vault state, fungibles, non-fungibles, and worktop handling, read `./references/guide-resources-vaults.md` with this guide.
- For locker role rules, admin badges, owner role assertions, and authorization failures, read `./references/guide-access-rules.md` with this guide.
- For RTM or manifest builder instruction shape, read `./references/guide-transaction-manifest.md` with this guide.
- For event decoding and receipt evidence, read `./references/guide-receipts-events.md` with this guide.
Routing check: if the task involves account lockers, pending account claims, direct-send fallback, airdrops, claimant claims, locker recovery, or account locker events, keep this guide loaded.

## Usage Notes

- Treat an account locker as a pending-claim component, not as an account balance.
- Use `try_direct_send` only when the direct deposit path and fallback storage path are both acceptable.
- Do not claim resources are stored in the locker unless a store path ran and a `StoreEvent` or state read confirms it.
- Keep claim and recover flows separate in naming, authorization, destination account, and tests.
- When decoding events, apply `StoreEvent` as an addition and `ClaimEvent` or `RecoverEvent` as a subtraction for the claimant/resource pair.
- When docs mention account locker scenario outputs, verify against the generated manifest or receipt for the network version being documented.
