# Pools Guide

## Source Paths

Rust source paths:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/one_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/two_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/multi_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/constants.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/errors.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/substates.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/v1_1/one_resource_pool_blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/v1_1/two_resource_pool_blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/v1_1/multi_resource_pool_blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/src/pool_stubs.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_one_resource.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_two_resource.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_multi_resource.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_states.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_arithmetic.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/radiswap.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish-part2/radiswap/manifests/003--radiswap-publish-and-create-pools.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish-part2/radiswap/manifests/004--radiswap-add-liquidity.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/cuttlefish-part2/radiswap/manifests/007--radiswap-remove-tokens.rtm`

TypeScript source paths:

- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`

## Mental Model

Radix native pools are components in the native pool package. There are three pool blueprints:

- `OneResourcePool` holds one fungible resource vault
- `TwoResourcePool` holds exactly two fungible resource vaults
- `MultiResourcePool` holds one or more fungible resource vaults in an ordered map

Each pool mints a separate fungible pool unit resource. Pool units represent a share of the pool reserves, not the reserves themselves. The pool component metadata links the pool to `pool_vault_number`, `pool_resources`, and `pool_unit`; the pool unit resource metadata links back to `pool`.

Keep these surfaces separate:

- instantiate creates the pool component and its pool unit resource
- contribute moves reserve resource buckets into the pool and returns pool units plus optional change
- redeem burns pool units and returns reserve resource buckets
- protected deposit and protected withdraw are pool-manager operations for reserve correction
- redemption value and vault amount reads are query surfaces, not proof that a future transaction will succeed
- Radiswap scenarios are app-level examples that use pools, not the native pool source of truth

Native pool methods are not all public. `redeem`, `get_redemption_value`, and vault amount getters are public. `contribute`, `protected_deposit`, and `protected_withdraw` require the `pool_manager_role` configured at instantiation.

## Examples

Use these examples when code or docs touch native pool creation, pool units, contribution math, redemption, protected reserve movement, pool metadata, pool events, or pool arithmetic tests.

### Instantiate a native pool

Use this when creating a one-, two-, or multi-resource pool component or documenting the returned pool unit resource.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/one_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/two_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/multi_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/v1_1/one_resource_pool_blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/v1_1/two_resource_pool_blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/v1_1/multi_resource_pool_blueprint.rs`
- `./references/guide-components-packages.md`

Pattern:

```text
call POOL_PACKAGE function:
OneResourcePool.instantiate(resource_address)
TwoResourcePool.instantiate((resource_a, resource_b))
MultiResourcePool.instantiate(IndexSet<resource_address>)
```

Rule: native pools accept fungible resources only. Two-resource pools reject duplicate resource addresses. Multi-resource pools reject an empty resource set. Instantiation also creates the pool unit resource with mint and burn roles restricted to the pool component caller badge.

Done when: the manifest or helper records pool component address, pool unit resource address, owner role, pool manager rule, resource list, address reservation behavior, and negative tests for unsupported resource sets.

### Read pool metadata and address types

Use this when TypeScript, Gateway, docs, or UI code needs to distinguish pool address, pool unit resource address, and reserve resource addresses.

Start with:

- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/v1_1/one_resource_pool_blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/v1_1/multi_resource_pool_blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_one_resource.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_multi_resource.rs`
- `./references/guide-gateway.md`

Pattern:

```text
pool component metadata:
pool_vault_number -> number of reserve vaults
pool_resources -> reserve resource addresses
pool_unit -> pool unit resource address

pool unit resource metadata:
pool -> pool component address
```

Rule: `PoolAddress`, `ResourceAddress`, and pool unit resource address are different concepts. Pool metadata keys are locked; arbitrary metadata still depends on owner authority.

Done when: code or docs name the pool component, pool unit resource, reserve resources, metadata source, and owner-authorized metadata behavior separately.

### Contribute to a one-resource pool

Use this when one reserve resource bucket should be exchanged for pool units.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/one_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/v1_1/one_resource_pool_blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_one_resource.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_arithmetic.rs`
- `./references/guide-resources-vaults.md`

Pattern:

```text
reserve bucket -> OneResourcePool.contribute(bucket) -> pool unit bucket
```

Rule: contribution requires `pool_manager_role`. The bucket must be non-empty and must use the pool reserve resource. If pool units are concentrated enough that a contribution would mint zero pool units, the engine rejects it.

Done when: the manifest proves pool-manager authority, reserve resource identity, non-empty bucket handling, returned pool unit deposit, and a test for wrong resource or zero-minted-pool-unit behavior.

### Contribute to a two-resource pool

Use this when two reserve resource buckets should be contributed while preserving pool ratios.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/two_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/v1_1/two_resource_pool_blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/src/pool_stubs.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_two_resource.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_states.rs`
- `./references/guide-transaction-manifest.md`

Pattern:

```text
(bucket_a, bucket_b)
-> TwoResourcePool.contribute((bucket_a, bucket_b))
-> (pool_unit_bucket, optional_change_bucket)
```

Rule: the engine sorts buckets and vaults by resource address before checking membership. New pools mint from the geometric mean of contributions; existing pools preserve reserve ratios and can return change.

Done when: the flow handles both output values, deposits pool units, routes optional change, and tests new-pool, dusty-pool, one-sided, and normal-operation states when the helper depends on those cases.

### Contribute to a multi-resource pool

Use this when more than two reserve resource buckets may be contributed or change handling can include many resources.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/multi_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/v1_1/multi_resource_pool_blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/src/pool_stubs.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_multi_resource.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_states.rs`
- `./references/guide-resources-vaults.md`

Pattern:

```text
Vec<Bucket>
-> MultiResourcePool.contribute(buckets)
-> (pool_unit_bucket, Vec<change_bucket>)
```

Rule: multi-resource contribution matches each bucket by resource address. Missing or empty buckets, unknown resources, no minimum ratio, and too-small ratio contributions are protocol error cases, not UI-only validation cases.

Done when: the code handles every returned change bucket, preserves resource-address matching, validates missing resources deliberately, and tests at least one ratio-change case.

### Redeem pool units

Use this when pool unit tokens should be burned for underlying reserve resources.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/one_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/two_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/multi_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/v1_1/one_resource_pool_blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_arithmetic.rs`
- `./references/guide-resources-vaults.md`

Pattern:

```text
OneResourcePool.redeem(pool_unit_bucket) -> reserve bucket
TwoResourcePool.redeem(pool_unit_bucket) -> (reserve_a_bucket, reserve_b_bucket)
MultiResourcePool.redeem(pool_unit_bucket) -> Vec<reserve_bucket>
```

Rule: redeem is public but the bucket must be the exact pool unit resource. Very small redemptions can fail when the calculated reserve amount rounds to zero at the reserve resource divisibility.

Done when: the flow validates pool unit resource identity, handles the blueprint-specific return shape, deposits every returned reserve bucket, and tests invalid pool unit resources plus zero-redemption behavior.

### Use protected reserve movement

Use this when a pool manager intentionally adjusts reserves without minting or burning pool units.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/one_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/two_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/multi_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_states.rs`
- `./references/guide-access-rules.md`

Pattern:

```text
protected_deposit(bucket) -> ()
protected_withdraw(resource_address, amount, withdraw_strategy) -> bucket
```

Rule: protected methods require `pool_manager_role` and directly mutate reserve vaults. They can create dusty, one-sided, or invalid reserve states that affect later contribution math.

Done when: the manifest proves pool-manager authority, names the reserve resource and withdraw strategy, routes returned buckets, and tests the follow-on contribution behavior after the protected operation.

### Read redemption values and vault amounts

Use this when UI, preview code, or diagnostics need expected reserve amounts without executing redemption.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/one_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/two_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/pool/multi_resource_pool/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_arithmetic.rs`
- `./references/guide-gateway.md`

Pattern:

```text
get_redemption_value(amount_of_pool_units) -> Decimal or IndexMap<ResourceAddress, Decimal>
get_vault_amount() -> Decimal
get_vault_amounts() -> IndexMap<ResourceAddress, Decimal>
```

Rule: redemption-value reads are source-backed calculations at a ledger state. They do not reserve liquidity and can become stale before a transaction executes.

Done when: the read path includes ledger state, pool unit amount, expected reserve resources, divisibility handling, and stale-read behavior in diagnostics.

### Decode pool events

Use this when receipts, streams, or tests need to reconcile pool contributions, redemptions, protected deposits, or protected withdrawals.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_one_resource.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_multi_resource.rs`
- `./.repos/radixdlt-scrypto/radix-substate-store-queries/src/typed_native_events.rs`
- `./references/guide-receipts-events.md`
- `./references/guide-sbor.md`

Pattern:

```text
ContributionEvent -> contributed resources plus pool_units_minted
RedemptionEvent -> pool_unit_tokens_redeemed plus redeemed resources
DepositEvent -> protected reserve deposit
WithdrawEvent -> protected reserve withdrawal
```

Rule: one-resource pool events use scalar amounts; two- and multi-resource pool events use `IndexMap<ResourceAddress, Decimal>` for contributed and redeemed resources. Event name alone is not enough; identify the native pool blueprint and emitter.

Done when: the decoder checks emitter, blueprint family, event name, scalar versus map payload shape, transaction ID, state version, and unsupported custom pool events.

### Test pool behavior from engine sources

Use this when code or documentation makes claims about pool contribution math, redemption rounding, invalid resources, metadata locks, or authorization.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_one_resource.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_two_resource.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_multi_resource.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_states.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/pool_arithmetic.rs`
- `./references/guide-testing.md`

Pattern:

```text
metadata lock tests -> pool metadata and pool unit metadata
state tests -> new, dusty, invalid, one-sided, and normal operation
arithmetic tests -> divisibility, atto amounts, zero minted units, zero redemption
auth tests -> pool manager protected methods versus public redeem/read methods
```

Rule: pool math claims need engine tests or source formulas. Radiswap scenario receipts are useful app-level evidence, but they are not enough to prove native pool edge behavior.

Done when: every behavior claim cites the matching pool source, engine test, or generated manifest and distinguishes native pool behavior from Radiswap app behavior.

## Reference Routes

- For reserve resources, buckets, vaults, pool units, worktop routing, and deposits, read `./references/guide-resources-vaults.md` with this guide.
- For RTM and manifest builder instruction shape, read `./references/guide-transaction-manifest.md` with this guide.
- For pool manager roles, owner roles, metadata auth, and protected method failures, read `./references/guide-access-rules.md` with this guide.
- For pool events and receipt evidence, read `./references/guide-receipts-events.md` with this guide.
- For Radiswap app scenarios, read this guide first for native pool behavior, then inspect `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/radiswap.rs`.
Routing check: if the task involves native pools, pool units, contribution math, redemption values, protected reserve movement, pool metadata, or pool events, keep this guide loaded.

## Usage Notes

- Do not treat validators' liquid stake units as native pool units; use `./references/guide-staking-validators.md` for validator staking.
- Do not infer pool math from AMM intuition. Use the native pool source and tests for contribution, change, and redemption behavior.
- Keep pool component address, pool unit resource address, and reserve resource addresses as separate fields.
- Preserve every returned change or reserve bucket in manifests.
- Treat protected reserve movement as an administrative operation with downstream arithmetic effects.
- When a guide or doc cites Radiswap, state whether the claim is native pool behavior or app-level scenario behavior.
