# Account Guide

## Source Paths

Rust source paths:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/account/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/events.rs`
- `./.repos/radixdlt-scrypto/radix-native-sdk/src/account/account.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/types/addresses/component_address.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/types/entity_type.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/transfer_xrd.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/account_authorized_depositors.rs`

TypeScript source paths:

- `./.repos/radix-web3.js/packages/core/src/account/index.ts`
- `./.repos/radix-web3.js/packages/core/src/manifests/sendResourceManifest.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getFungibleBalance.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getNonFungibleBalance.ts`
- `./.repos/radix-web3.js/packages/gateway/src/rola.ts`
- `./.repos/radix-web3.js/packages/cli/src/accountReads.ts`

## Mental Model

Radix accounts are native components. They hold resource vaults, expose deposit and withdraw methods, lock fees, can be securified, and can apply deposit rules with authorized depositors and per-resource preferences.

Separate these concepts:

- account address derivation and virtual/preallocated accounts
- account ownership and `owner_keys` metadata used by ROLA
- vault contents and Gateway balance reads
- deposit rules, authorized depositors, and resource preferences
- manifest methods such as `withdraw`, `try_deposit_or_abort`, and `lock_fee`

## Examples

Use these examples when account behavior, account manifests, or account Gateway reads are involved.

### Build a transfer manifest between accounts

Use this when a helper should withdraw from one account and deposit into another.

Start with:

- `./.repos/radix-web3.js/packages/core/src/manifests/sendResourceManifest.ts`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/transfer_xrd.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/account/invocations.rs`
- `./references/guide-transaction-manifest.md`

Pattern:

```rtm
CALL_METHOD
    Address("${from_account}")
    "withdraw"
    Address("${resource_address}")
    Decimal("1");

CALL_METHOD
    Address("${to_account}")
    "try_deposit_batch_or_abort"
    Expression("ENTIRE_WORKTOP")
    None;
```

Rule: choose `try_deposit_*_or_abort` when failure should reject the transaction; choose `try_deposit_*_or_refund` when rejected deposits should be returned.

Rule: transfer manifests should use `try_deposit_*` for public recipient deposits. Plain `deposit` and `deposit_batch` are owner-protected account methods; they deposit after authorization and bypass default deposit-rule checks. Use them only when the manifest has the account owner's authority and that bypass is intentional.

Done when: the manifest has explicit withdraw and recipient deposit behavior, fee locking is appropriate for the submitter, and static validation or a scenario-derived test proves the deposit path is public-safe.

### Debug account deposit failures

Use this when a deposit is rejected by default deposit rule, resource preference, or authorized depositor checks.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/events.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/account_authorized_depositors.rs`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/example/index.ts`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/account_authorized_depositors/manifests/003--account-authorized-depositors-attempt-deposit-failure-if-badge-is-not-present.rtm`

Pattern: inspect account `DefaultDepositRule`, resource preference, and authorized depositor badge separately. A valid proof is not enough if the resource is explicitly disallowed.

Diagnosis matrix:

- `Reject` plus no proof: should reject unless the resource has an explicit `Allowed` preference.
- Authorized depositor badge not registered: proof should not help.
- Badge registered but proof absent from the auth zone: should reject.
- Badge registered and proof present: should pass unless the resource is explicitly `Disallowed`.
- Resource `Allowed`: should pass without an authorized depositor proof.
- Resource `Disallowed`: should reject even when the default rule would allow deposits.
- `AllowExisting`: XRD is accepted, and other resources require an existing account vault.

Rule: trace `try_deposit_or_refund` and `try_deposit_or_abort` separately in `blueprint.rs`. Refund behavior can make a rejected deposit look like a successful transaction with returned resources, while abort behavior rejects the transaction.

Rule: direct `deposit` and `deposit_batch` are protected methods that deposit after authorization and do not run the default deposit-rule checks. Use `try_deposit_*` methods when a public deposit should respect default rules, resource preferences, authorized depositor badges, and rejected-deposit events.

Done when: the diagnosis names both the account setting that rejected the deposit and the observable surface. For committed transactions, call `TransactionHelper.getCommittedDetails` or stream with `detailed_events` opt-in, then inspect decoded `RejectedDepositEvent::Fungible(ResourceAddress, Decimal)` or `RejectedDepositEvent::NonFungible(ResourceAddress, IndexSet<NonFungibleLocalId>)` payloads instead of inferring rejection from receipt text alone.

### Change account deposit settings from a manifest

Use this when a manifest should set default deposit behavior, resource preference, or authorized depositor badges.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/account/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/account_authorized_depositors.rs`
- `./references/guide-transaction-manifest.md`
- `./references/guide-access-rules.md`

Pattern: first identify the account method string and argument tuple in `invocations.rs`, then copy only the manifest instruction shape into TypeScript or RTM. Test allowed and rejected deposits after the setting change, not just the setting method itself.

Done when: tests or source notes prove the setting method changed account state and at least one later deposit succeeds or fails because of that setting.

### Read account balances through Gateway

Use this when TypeScript needs fungible balances, NFTs, or account resource ownership.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/getFungibleBalance.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getNonFungibleBalance.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getNftResourceManagers.ts`
- `./.repos/radix-web3.js/packages/cli/src/accountReads.ts`
- `./references/guide-gateway.md`

Pattern: read balances through Gateway services, not by parsing account vault substates directly, unless the task is explicitly engine-level source work.

Done when: balance reads use a stable ledger state across paginated calls and preserve empty-account, missing-resource, and multi-resource cases in output.

### Verify account ownership for ROLA

Use this when login, account proof verification, or owner key lookup fails.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/rola.ts`
- `./.repos/radix-web3.js/packages/connect/src/rola/createRolaMessage.ts`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/blueprint.rs`
- `./references/guide-wallet-rola.md`
- `./references/guide-access-rules.md`

Pattern: for accounts, treat `owner_keys` metadata as authoritative. The account blueprint explicitly sets `owner_keys` on virtual accounts so that deleting the metadata removes owner-key authority; do not implement a local "missing metadata means derive virtual account address" fallback for account proofs. If replacing the ROLA SDK, verify persona/identity fallback semantics separately against source before copying account behavior.

Done when: account proof code distinguishes wallet proof shape from Gateway ROLA proof shape and has tests for present `owner_keys`, deleted `owner_keys`, and wrong-network addresses.

### Work with account fee locking

Use this when a manifest needs `lock_fee`, `lock_contingent_fee`, or combined fee-lock-and-withdraw behavior.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/account/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/package.rs`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/addFeePayer.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`

Pattern: keep fee-payer injection in transaction tooling. For wallet-submitted manifests, confirm whether the wallet adds fee locking before inserting `lock_fee` into RTM.

Done when: the manifest or helper names the fee payer, lock amount, and submitter path, and wallet-submitted RTM has been checked against the Babylon Wallet `lock_fee` warning in Rust examples.

### Create or securify accounts

Use this when account creation, `create_advanced`, preallocated addresses, owner role, or securification is involved.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/account/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/types/addresses/component_address.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/types/entity_type.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/account/new.rtm`
- `./references/guide-access-rules.md`

Pattern: account creation returns an account and owner badge for normal `create`; advanced creation takes an owner role and optional address reservation. Verify exact output shape in invocations before writing TypeScript assumptions.

Rule: virtual and preallocated addresses are address/entity-type behavior, not Gateway lookup behavior. For ROLA work, compare account `owner_keys` metadata semantics in the account blueprint with TypeScript derivation in `packages/core/src/account/index.ts`; derivation helpers are useful for creating or testing virtual addresses, not as an implicit replacement for deleted `owner_keys` metadata.

Done when: creation or securification code proves the returned account, owner badge, owner role, and address reservation behavior against the invocation output shape.

## Reference Routes

- Account method inventory: inspect constants in `invocations.rs` and exports in account `package.rs`.
- Deposit event behavior: inspect account `events.rs` and the note in `blueprint.rs` that deposits should go through `deposit` so events are emitted.
- Account locker behavior: read `./references/guide-account-lockers.md`.
- CLI account reads: inspect `packages/cli/src/accountReads.ts`, `gatewayHttp.ts`, and `schemas.ts`.
- Account address helpers: inspect `packages/core/src/account/index.ts` and Radix Engine Toolkit derivation call sites.

Routing check: adjacent routing sends account transaction behavior to manifest/transaction guides and account read behavior to Gateway/CLI guides.

## Usage Notes

- Do not confuse account ownership with dApp session authorization.
- Use Gateway services for ordinary balance reads.
- Use account blueprint source for deposit, withdrawal, fee, and securification semantics.
- Treat wallet fee-locking and simulator fee-locking differently; check the submit path before adding `lock_fee`.
