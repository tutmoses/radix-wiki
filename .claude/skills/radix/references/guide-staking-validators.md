# Staking And Validators Guide

## Source Paths

TypeScript source paths:

- `./.repos/radix-web3.js/packages/gateway/src/state/getValidators.ts`
- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`

Rust source paths:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/consensus_manager/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/consensus_manager/validator.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/consensus_manager/consensus_manager.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/consensus_manager/events/validator.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/consensus_manager/events/consensus_manager.rs`
- `./.repos/radixdlt-scrypto/radix-native-sdk/src/consensus_manager/validator.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/validator.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/consensus_manager.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/stake_reconciliation.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata_validator.rs`

## Mental Model

A validator is a native component owned by the consensus manager package. It is not a generic pool component, even though it exposes a pool-like stake unit resource.

The validator component owns five separate concerns:

- registration and consensus participation
- whether delegated stake is accepted
- the XRD stake vault and pending XRD withdrawal vault
- the liquid stake unit resource minted during staking
- the claim NFT resource minted during unstaking
- owner-only operations guarded by the validator owner badge

Staking is a resource flow plus a native method call. XRD goes into `stake` or `stake_as_owner` and a bucket of liquid stake units comes out. Unstaking sends a stake unit bucket into `unstake`; the validator burns those stake units, moves redeemable XRD into a pending vault, and mints a claim NFT containing `claim_epoch` and `claim_amount`. Claiming sends the claim NFT into `claim_xrd` after the unlock epoch and returns an XRD bucket.

Keep the validator component address, LSU resource address, claim NFT resource address, account address, consensus manager address, and owner badge proof separate. They appear together in staking flows but they are different protocol entities.

## Examples

Use these examples when code or docs touch validator discovery, staking, unstaking, claim NFTs, liquid stake units, consensus manager behavior, validator owner operations, validator metadata, or validator events.

### List validators through Gateway

Use this when TypeScript code needs validator names, validator addresses, LSU resource addresses, or claim NFT resource addresses.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/state/getValidators.ts`
- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./references/guide-gateway.md`

Pattern:

```text
gatewayClient.state.getValidators()
-> each item address is ValidatorAddress
-> metadata key name with typed String becomes display name
-> metadata key pool_unit with typed GlobalAddress becomes LSU resource address
-> metadata key claim_nft with typed GlobalAddress becomes claim NFT resource address
```

Rule: validator discovery is a Gateway read model over native validator metadata. Do not infer the LSU or claim NFT resource from display names, resource symbols, or address prefixes when `pool_unit` and `claim_nft` metadata are available.

Done when: the code validates the Gateway response shape, handles missing or mistyped metadata intentionally, and keeps validator address, LSU resource address, and claim NFT resource address in separate branded fields.

### Distinguish validator, LSU, and claim NFT addresses

Use this when a helper, schema, UI, or manifest accepts more than one validator-related address.

Start with:

- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radix-web3.js/packages/gateway/src/state/getValidators.ts`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/consensus_manager/validator.rs`
- `./references/guide-resources-vaults.md`

Pattern:

```text
validator address -> component address for validator methods
pool_unit metadata -> fungible resource address for liquid stake units
claim_nft metadata -> non-fungible resource address for stake claim NFTs
owner_badge metadata -> local ID for validator owner proof construction
```

Rule: staking manifests call methods on the validator component address but move buckets of XRD, LSU, or claim NFTs. A resource address is not a method target for `stake`, `unstake`, or `claim_xrd`.

Done when: every address parameter is named by protocol role, validated through the matching schema or source API, and never reused as a different entity type.

### Build a delegated stake manifest

Use this when a user stakes account XRD to a validator and expects liquid stake units back.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/consensus_manager/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-native-sdk/src/consensus_manager/validator.rs`
- `./references/guide-transaction-manifest.md`
- `./references/guide-resources-vaults.md`

Pattern:

```rust
ManifestBuilder::new()
    .lock_fee_from_faucet()
    .withdraw_from_account(account, XRD, amount)
    .take_all_from_worktop(XRD, "stake")
    .stake_validator(validator_address, "stake")
    .try_deposit_entire_worktop_or_abort(account, None)
    .build()
```

Rule: delegated staking calls the validator method `stake` with an XRD bucket. The output is a bucket of stake units which must be deposited or otherwise handled before the manifest ends. Verify the validator accepts delegated stake before presenting this as a user-safe flow.

Done when: the manifest locks a fee, withdraws XRD from the intended account, passes the XRD bucket into `stake`, handles the returned LSU bucket, and tests the behavior for a validator that rejects delegated stake.

### Register and stake as validator owner

Use this when managing validator owner flows such as register, unregister, owner stake, key update, fee update, delegated-stake toggle, or metadata update.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/consensus_manager/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/stake_reconciliation.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/metadata_validator.rs`
- `./references/guide-access-rules.md`

Pattern:

```rust
ManifestBuilder::new()
    .lock_fee_from_faucet()
    .create_proof_from_account_of_non_fungibles(
        owner_account,
        VALIDATOR_OWNER_BADGE,
        [NonFungibleLocalId::bytes(validator_address.as_node_id().0).unwrap()],
    )
    .register_validator(validator_address)
    .build()
```

Rule: owner operations require the validator owner badge proof. Keep owner stake flows separate from delegated stake flows because `stake_as_owner` and `stake` have different authorization and validator-state implications.

Done when: the manifest creates the owner badge proof from the correct account, calls only owner-authorized validator methods under that proof, and includes a negative authorization test without the proof.

### Unstake and claim XRD

Use this when a staking workflow converts LSU back into XRD or needs to explain the delay between unstaking and claiming.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/consensus_manager/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/consensus_manager/validator.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./references/guide-transaction-manifest.md`
- `./references/guide-receipts-events.md`

Pattern:

```text
withdraw LSU from account
-> take LSU bucket from worktop
-> call validator.unstake(lsu_bucket)
-> deposit returned claim NFT
-> after claim_epoch, withdraw claim NFT
-> call validator.claim_xrd(claim_nft_bucket)
-> deposit returned XRD
```

Rule: unstaking does not immediately return XRD. The validator creates a claim NFT whose data includes `claim_epoch` and `claim_amount`; `claim_xrd` is the later redemption step.

Done when: the flow records the LSU resource, claim NFT resource, claim NFT local ID, claim epoch, claim amount, validator address, and the account that will receive returned XRD.

### Query delegated-stake state and redemption value

Use this when code previews a staking action, displays validator availability, or estimates XRD returned for LSU.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/consensus_manager/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-native-sdk/src/consensus_manager/validator.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/validator.rs`
- `./references/guide-transaction-manifest.md`

Pattern:

```text
accepts_delegated_stake() -> bool
total_stake_xrd_amount() -> Decimal
total_stake_unit_supply() -> Decimal
get_redemption_value(amount_of_stake_units) -> Decimal
```

Rule: redemption value is a validator method result, not a local multiplication unless the source explicitly supplies the same formula and edge cases. Tests cover invalid zero, minimum, and maximum redemption amounts.

Done when: the query path handles false delegated-stake state, invalid redemption amounts, missing method return values, and preview-versus-commit differences.

### Handle validator events from receipts

Use this when a transaction stream, committed details reader, or event decoder needs staking outcomes.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/consensus_manager/events/validator.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/stake_reconciliation.rs`
- `./.repos/radixdlt-scrypto/radix-substate-store-queries/src/typed_native_events.rs`
- `./references/guide-receipts-events.md`
- `./references/guide-sbor.md`

Pattern:

```text
RegisterValidatorEvent
UnregisterValidatorEvent
StakeEvent { xrd_staked }
UnstakeEvent { stake_units }
ClaimXrdEvent { claimed_xrd }
UpdateAcceptingStakeDelegationStateEvent { accepts_delegation }
ProtocolUpdateReadinessSignalEvent { protocol_version_name }
```

Rule: event name alone is not enough. Identify the emitter as a validator native component event, decode the SBOR payload against the source event type, and attach transaction ID and state version to decode failures.

Done when: the event handler checks emitter, event name, payload schema, validator address, resource movement, and unsupported event behavior.

### Signal protocol update readiness

Use this when validator owner tooling or governance diagnostics needs protocol readiness status.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/consensus_manager/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/consensus_manager/validator.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/blueprints/validator.rs`
- `./references/guide-access-rules.md`
- `./references/guide-receipts-events.md`

Pattern:

```rust
ManifestBuilder::new()
    .lock_fee_from_faucet()
    .create_proof_from_account_of_non_fungibles(owner_account, VALIDATOR_OWNER_BADGE, owner_badge_ids)
    .signal_protocol_update_readiness(validator_address, protocol_version_name)
    .build()
```

Rule: `signal_protocol_update_readiness` is owner-authorized and validates the protocol version name length. Source tests cover success, missing owner proof, and invalid length.

Done when: the tool proves owner authorization, validates or reports protocol name length, emits or reads the readiness signal, and tests both unauthorized and invalid-name failures.

### Test consensus manager and epoch behavior

Use this when validator logic depends on current epoch, next round, active validator set, emissions, rewards, or unstake unlock timing.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/consensus_manager/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/consensus_manager/consensus_manager.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/consensus_manager.rs`
- `./references/guide-network-addresses.md`
- `./references/guide-testing.md`

Pattern:

```text
consensus manager state -> current epoch, round, validator set, protocol config
validator state -> registered flag, stake vault, claim NFT, owner stake-unit vaults
tests -> simulate round or epoch movement before asserting unlocks or emissions
```

Rule: epoch-sensitive staking behavior belongs in simulator or source-backed integration tests. Do not make wall-clock assumptions about claim availability; use consensus manager epoch state and configured unstake epochs.

Done when: tests drive epoch or round state explicitly, assert validator substate changes, and separate protocol timing from application UI time.

## Reference Routes

- For Gateway validator lists and metadata extraction, read `./references/guide-gateway.md` with this guide.
- For XRD, LSU, claim NFT, bucket, vault, and proof movement, read `./references/guide-resources-vaults.md` with this guide.
- For RTM or manifest builder instruction shape, read `./references/guide-transaction-manifest.md` with this guide.
- For staking receipt and event decoding, read `./references/guide-receipts-events.md` with this guide.
- For owner badge proofs and authorization failures, read `./references/guide-access-rules.md` with this guide.
- For consensus manager known addresses and network-specific address handling, read `./references/guide-network-addresses.md` with this guide.
Routing check: if the task involves validator addresses, LSU resources, claim NFTs, staking, unstaking, consensus manager epochs, or validator owner methods, keep this guide loaded.

## Usage Notes

- Treat validator source as native blueprint behavior. Application code should not reimplement stake, unstake, reward, emission, or redemption math from memory.
- Keep delegated stake and owner stake as separate branches in code, docs, and tests.
- Use Gateway metadata keys for validator list display, but use validator methods or transaction previews for behavior that depends on live validator state.
- Store claim NFT information as a pending redemption, not as a completed withdrawal.
- When tests need owner behavior, include both the owner proof success case and the unauthorized failure case.
- When docs mention a command, helper, event, or method name, verify it against `invocations.rs`, `manifest_builder.rs`, or the validator event source before publishing.
