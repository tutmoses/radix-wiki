# Access Controllers Guide

## Source Paths

Rust source paths:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/access_controller/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/access_controller/data.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/types.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/error.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/state.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/state_machine.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/access_controller.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/access_controller_big_vault.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/flash/access_controller.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/access_controller_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/bottlenose/access-controller-v2/manifests/001--access-controller-v2-instantiate.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/bottlenose/access-controller-v2/manifests/002--access-controller-v2-deposit-fees-xrd.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/bottlenose/access-controller-v2/manifests/003--access-controller-v2-lock-fee-and-recover.rtm`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/access_controller/new.rtm`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/util/securify.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/blueprint.rs`

TypeScript source paths:

- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radix-web3.js/packages/shared/src/schemas/account.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/manifestHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/addFeePayer.ts`

## Mental Model

An access controller is a native component that stores a controlled asset in a vault and gates actions through three role rules: primary, recovery, and confirmation. It is not the access-rule tree itself. The access-rule tree says what proof is required; the access controller state machine decides which recovery, locking, badge-withdraw, fee, and proof operations are currently valid.

Keep these nouns separate:

- `RuleSet` holds the primary, recovery, and confirmation `AccessRule` values.
- `RecoveryProposal` is a proposed replacement `RuleSet` plus a proposed timed recovery delay.
- the controlled asset vault is the asset the controller can prove or withdraw, often an account owner badge in securified-account flows.
- the recovery badge resource is created by the access controller and can be minted by primary or recovery roles.
- the optional XRD recovery fee vault is created by contributing XRD and is used for recovery-fee locking.

The V2 state is a tuple of state machines: primary role locking, primary-role recovery proposal, primary-role badge-withdraw attempt, recovery-role recovery proposal, and recovery-role badge-withdraw attempt. A primary lock blocks `create_proof`, but recovery and cancellation flows can still be progressed according to their method auth and state.

Authorization is asymmetric. Primary creates proofs and can start primary-side proposals. Recovery can lock or unlock primary and can start recovery-side proposals. Confirmation cannot initiate proposals, but it can confirm or stop certain proposals. Read `v2/package.rs` for method auth before inferring behavior from method names.

## Examples

Use these examples when code or docs touch access controller creation, securified account proofs, recovery proposals, timed recovery, controlled badge withdrawal, recovery fees, native events, or `accessControllerAddress` handling in TypeScript packages.

### Create an access controller from a controlled asset

Use this when instantiating a native access controller from RTM, ManifestBuilder, a scenario, or Scrypto engine tests.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/access_controller/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/access_controller/data.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/bottlenose/access-controller-v2/manifests/001--access-controller-v2-instantiate.rtm`
- `./references/guide-access-rules.md`

Pattern:

```rust
ManifestBuilder::new()
    .lock_fee_from_faucet()
    .get_free_xrd_from_faucet()
    .take_all_from_worktop(XRD, "controlled_asset")
    .create_access_controller(
        "controlled_asset",
        primary_rule,
        recovery_rule,
        confirmation_rule,
        Some(10),
    )
    .build()
```

Rule: creation takes a controlled asset bucket, a `RuleSet`, an optional timed recovery delay in minutes, and an optional address reservation. The blueprint stores the asset in a vault, creates a recovery badge resource, attaches role assignment from the rule set, and writes recovery badge metadata.

Done when: the code records the new access controller address, controlled asset resource, three role rules, timed recovery delay, and whether an address reservation was used.

### Map method authorization before wrapping a method

Use this when adding a TypeScript helper, manifest template, docs example, or test for an access controller method.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/access_controller/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/access_controller.rs`
- `./references/guide-access-rules.md`

Pattern:

```text
primary:
  create_proof
  initiate/cancel primary recovery proposal
  initiate/cancel primary badge-withdraw attempt
  quick-confirm recovery-role proposals
  withdraw recovery fee

recovery:
  initiate/cancel recovery recovery proposal
  initiate/cancel recovery badge-withdraw attempt
  quick-confirm primary-role proposals
  lock/unlock primary

confirmation:
  quick-confirm either proposer side where listed
  stop timed recovery
  lock recovery fee
```

Rule: this is a summary, not a substitute for `v2/package.rs`. Check the method auth table there for every method, especially `timed_confirm_recovery`, `stop_timed_recovery`, `mint_recovery_badges`, and recovery-fee methods.

Done when: the wrapper or template names the required role proof, has a negative unauthorized case, and distinguishes method authorization failure from state-machine failure.

### Create a proof for a securified account flow

Use this when account fee locking or account owner authorization needs a proof from an access controller address.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/state_machine.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/access_controller.rs`
- `./.repos/radix-web3.js/packages/shared/src/schemas/account.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/manifestHelper.ts`
- `./references/guide-account.md`

Pattern:

```rtm
CALL_METHOD
  Address("${access_controller_address}")
  "create_proof"
;

CALL_METHOD
  Address("${account_address}")
  "lock_fee"
  Decimal("${amount}")
;
```

Rule: `create_proof` requires primary-role authorization and an unlocked primary role. If primary is locked, the state machine returns `OperationRequiresUnlockedPrimaryRole` even if method authorization passed.

Done when: the account model distinguishes securified and unsecurified accounts, the securified branch uses `accessControllerAddress`, and tests cover locked-primary and missing-primary-proof failures.

### Initiate and quick-confirm a rule-set recovery

Use this when changing the primary, recovery, or confirmation role rules through an access controller proposal.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/access_controller/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/state_machine.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/access_controller.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/bottlenose/access-controller-v2/manifests/003--access-controller-v2-lock-fee-and-recover.rtm`

Pattern:

```rust
builder
    .call_method(
        access_controller,
        ACCESS_CONTROLLER_INITIATE_RECOVERY_AS_PRIMARY_IDENT,
        AccessControllerInitiateRecoveryAsPrimaryManifestInput {
            rule_set: new_rules.into(),
            timed_recovery_delay_in_minutes: None,
        },
    )
    .call_method(
        access_controller,
        ACCESS_CONTROLLER_QUICK_CONFIRM_PRIMARY_ROLE_RECOVERY_PROPOSAL_IDENT,
        AccessControllerQuickConfirmPrimaryRoleRecoveryProposalManifestInput {
            rule_set: new_rules.into(),
            timed_recovery_delay_in_minutes: None,
        },
    )
```

Rule: the confirm input must exactly match the stored `RecoveryProposal`. A primary proposer cannot quick-confirm its own primary proposal; recovery or confirmation can. A recovery proposer is confirmed by primary or confirmation.

Done when: the proposal side, confirming role, exact proposed rule set, proposed timed delay, and `RecoveryProposalMismatch` negative case are covered.

### Use timed recovery and stop timed recovery

Use this when recovery should become possible only after the configured delay, or when an authorized role should stop a timed recovery timer.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/state.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/state_machine.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/error.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/access_controller.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/flash/access_controller.rs`

Pattern:

```text
recovery role initiates recovery
  -> state stores TimedRecovery { proposal, timed_recovery_allowed_after }
  -> timed_confirm_recovery checks current time
  -> stop_timed_recovery converts timed recovery to untimed recovery
```

Rule: timed recovery exists only for recovery-role proposals when the controller has a timed recovery delay. `timed_confirm_recovery` fails before the delay elapses and returns `NoTimedRecoveriesFound` if no timed recovery exists.

Done when: tests cover delay-not-elapsed, delay-elapsed, disabled timed recovery, and `stop_timed_recovery` authorization for primary, recovery, and confirmation.

### Withdraw the controlled asset through a badge-withdraw attempt

Use this when the controlled asset itself must be removed from the access controller instead of only used as a proof.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/access_controller/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/state_machine.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/access_controller.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/access_controller_big_vault.rs`
- `./references/guide-resources-vaults.md`

Pattern:

```rust
builder
    .call_method(
        access_controller,
        ACCESS_CONTROLLER_INITIATE_BADGE_WITHDRAW_ATTEMPT_AS_PRIMARY_IDENT,
        manifest_args!(),
    )
    .call_method(
        access_controller,
        ACCESS_CONTROLLER_QUICK_CONFIRM_PRIMARY_ROLE_BADGE_WITHDRAW_ATTEMPT_IDENT,
        manifest_args!(),
    )
    .deposit_entire_worktop(destination_account)
```

Rule: primary and recovery each have their own badge-withdraw attempt state. Quick confirmation returns a bucket containing the controlled asset and then locks role assignment through `locked_role_assignment()`.

Done when: the manifest deposits the returned bucket, tests cover wrong confirming role, cancellation, and maximum-vault proof or withdraw behavior.

### Manage recovery badges and recovery fee XRD

Use this when a wallet, recovery service, or scenario needs recovery badges or XRD available for recovery-fee locking.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/access_controller/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/flash/access_controller.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/bottlenose/access-controller-v2/manifests/002--access-controller-v2-deposit-fees-xrd.rtm`

Pattern:

```text
contribute_recovery_fee(bucket) -> public, creates or fills the XRD fee vault
lock_recovery_fee(amount)      -> primary, recovery, or confirmation
withdraw_recovery_fee(amount)  -> primary only
mint_recovery_badges(ids)      -> primary or recovery
```

Rule: `lock_recovery_fee` and `withdraw_recovery_fee` require the XRD fee vault to exist. Contribute XRD before locking or withdrawing fees, and test `NoXrdFeeVault` when a caller skips that setup.

Done when: manifests include recovery-fee contribution before fee locking, output buckets are deposited after withdrawals, and role-specific tests prove who can mint, lock, withdraw, and contribute.

### Decode access-controller events from receipts

Use this when transaction receipts, transaction stream handlers, or docs need to interpret native access-controller events.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/flash/access_controller.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/bottlenose/access-controller-v2/receipts/003--access-controller-v2-lock-fee-and-recover.txt`
- `./references/guide-receipts-events.md`

Pattern:

```text
InitiateRecoveryEvent { proposer, proposal }
RuleSetUpdateEvent { proposer, proposal }
CancelRecoveryProposalEvent { proposer }
InitiateBadgeWithdrawAttemptEvent { proposer }
BadgeWithdrawEvent { proposer }
DepositRecoveryXrdEvent { amount }
WithdrawRecoveryXrdEvent { amount }
```

Rule: event names are source-level event structs, not arbitrary log labels. Decode through typed native event helpers when available and keep proposer-specific events separate from access-rule values embedded in proposals.

Done when: receipt handling identifies the event type, proposer, proposal or amount payload, and the transaction phase that emitted it.

### Handle V1-to-V2 state and protocol-specific behavior

Use this when reading existing access controller state, debugging a protocol update, or writing tests around Bottlenose recovery-fee behavior.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/state.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/access_controller/v2/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/flash/access_controller.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/assets/access_controller_v1_package_definition.rpd`

Pattern:

```text
V1 substate
  -> lazy full update on method access
  -> V2 substate adds optional xrd_fee_vault
  -> Bottlenose package exposes recovery-fee methods and events
```

Rule: a component created before the protocol update can still hold V1 state until read or mutated through the V2 blueprint. Do not assume the fee vault exists just because the package has V2 methods.

Done when: state-reading code handles V1 and V2 variants, tests cover pre-update and post-update controllers, and recovery-fee tests distinguish missing vault from unauthorized access.

### Thread access controller addresses through TypeScript account models

Use this when a radix-web3.js package accepts accounts and must decide whether to call an account directly or first call an access controller.

Start with:

- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radix-web3.js/packages/shared/src/schemas/account.ts`
- `./.repos/radix-web3.js/packages/shared/src/schemas.test.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/addFeePayer.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/manifestHelper.ts`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/access_controller/invocations.rs`

Pattern:

```ts
if (account.type === 'unsecurifiedAccount') {
  return lockFeeFromAccount(account.address, amount);
}

return createAccessControllerProofThenLockFee(
  account.accessControllerAddress,
  account.address,
  amount,
);
```

Rule: `AccessControllerAddress` is a branded string in shared schemas. It does not prove that the address is on the correct network or that the primary role is unlocked; transaction preview or execution must still surface native failures.

Done when: schema tests cover securified and unsecurified accounts, generated manifests call `create_proof` only for securified accounts, and failures preserve the native access-controller method context.

## Reference Routes

- Access-rule syntax: use `./references/guide-access-rules.md` for `AccessRule`, `CompositeRequirement`, `rule!`, manifest enum payloads, and role assignment basics.
- Account securification: use `./references/guide-account.md` for account owner role, `securify`, account deposits, and fee locking behavior.
- Manifest syntax: use `./references/guide-transaction-manifest.md` for `CALL_METHOD`, `CREATE_ACCESS_CONTROLLER`, worktop buckets, and proof placement.
- Receipt and event decoding: use `./references/guide-receipts-events.md` for native event payload extraction and transaction status handling.
- Resource movement: use `./references/guide-resources-vaults.md` for buckets, vaults, proofs, non-fungible IDs, and returned worktop resources.
- TypeScript account models: use `./references/guide-shared.md` and `./references/guide-tx-tool.md` for account schemas and manifest helper wiring.

Routing check: if the task involves access controllers, primary/recovery/confirmation roles, timed recovery, recovery proposals, primary locking, badge-withdraw attempts, recovery badges, recovery fees, or `accessControllerAddress`, keep this guide loaded.

## Usage Notes

- Do not infer access controller behavior from access-rule shape alone. Always inspect the method auth table and the state-machine transition.
- Keep proposal input values stable between initiate and confirm calls. A matching role proof is not enough if the `RecoveryProposal` payload differs.
- Treat `timed_recovery_delay_in_minutes: None` as disabled timed recovery for the controller or proposal path being tested.
- Deposit buckets returned by badge-withdraw or recovery-fee withdraw methods. Dropping a non-empty bucket is a transaction failure unrelated to access-controller authorization.
- For TypeScript packages, preserve the distinction between an account address and an access controller address in schemas, logs, and manifest helpers.
