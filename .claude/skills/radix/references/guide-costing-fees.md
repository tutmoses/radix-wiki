# Costing And Fees Guide

## Source Paths

Primary source root: `./.repos/radixdlt-scrypto`

Key paths:

- `radix-common/src/constants/transaction_execution.rs`
- `radix-engine/src/transaction/transaction_executor.rs`
- `radix-engine/src/transaction/preview_executor.rs`
- `radix-engine/src/transaction/transaction_receipt.rs`
- `radix-engine/src/system/system_modules/costing/fee_reserve.rs`
- `radix-engine/src/system/system_modules/costing/costing_module.rs`
- `radix-engine/src/system/system_modules/costing/fee_summary.rs`
- `radix-engine/src/system/system_modules/costing/fee_table.rs`
- `radix-engine-interface/src/api/costing_api.rs`
- `radix-engine-interface/src/types/costing_reason.rs`
- `radix-engine/src/object_modules/royalty/package.rs`
- `radix-engine-interface/src/object_modules/royalty/invocations.rs`
- `radix-engine-interface/src/types/royalty_config.rs`
- `radix-engine-tests/tests/system/fee.rs`
- `radix-engine-tests/tests/system/fee_reserve_states.rs`
- `radix-engine-tests/tests/system/royalty.rs`
- `radix-engine-tests/tests/system/royalty_edge_cases.rs`
- `radix-engine-tests/tests/system/system_lock_fee.rs`
- `radix-engine-tests/tests/system/subintent_lock_fee.rs`
- `radix-engine-tests/tests/system/execution_cost.rs`
- `radix-engine-tests/tests/system/transaction_limits.rs`
- `radix-engine-tests/tests/application/preview.rs`
- `radix-engine-tests/tests/application/preview_v2.rs`

## Mental Model

Costing is an engine execution concern. Fee locking is a manifest or native method concern. Fee summaries are receipt output. Keep those three surfaces separate.

The engine starts a transaction with a fee reserve backed by a system loan and optional preview free credit. During execution, the costing module consumes execution, finalization, storage, and royalty costs. Lock-fee instructions add XRD from vaults to the reserve, but only non-contingent locked fees increase the spendable balance immediately.

At finalization, the reserve produces a structured summary:

- execution cost units and XRD
- finalization cost units and XRD
- tipping XRD
- storage XRD
- royalty XRD
- bad debt, locked fee vaults, and royalty recipients at the lower-level reserve summary

A successful preview can estimate fee behavior, but preview flags matter. Free credit, assumed signature proofs, skipped epoch checks, and disabled auth change what the preview proves.

Use this guide for engine-level fee semantics, not for Gateway response mapping alone. If the task starts from a Gateway receipt field or transaction stream opt-in, start with `guide-receipts-events.md` and switch here only when the fee value needs engine explanation.

## Examples

Use these examples when work touches fee locking, fee reserve errors, preview fee estimates, royalty fee totals, transaction limits, or execution-cost diagnostics.

### Diagnose missing or insufficient fee payment

Use this when a transaction rejects because no fee was paid, too little XRD was locked, non-XRD was used, or the system loan was not repaid.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/fee_reserve.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/costing_module.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/fee.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/fee_reserve_states.rs`
- `./references/guide-transaction-manifest.md`

Pattern:

```rust
let receipt = ledger.execute_manifest(
    ManifestBuilder::new()
        .lock_fee(account, 500)
        .withdraw_from_account(account, XRD, 66)
        .try_deposit_entire_worktop_or_abort(account2, None)
        .build(),
    vec![NonFungibleGlobalId::from_public_key(public_key)],
);
```

Check the failure boundary first:

1. No fee lock usually rejects before normal commit semantics.
2. An underfunded fee lock can fail loan repayment when deferred costs are applied.
3. Non-XRD fee locking is rejected because the fee reserve expects XRD.
4. A transaction that commits with failure can still charge fees.

Rule: do not diagnose all fee failures as account balance failures. Separate missing lock-fee instructions, non-XRD fee source, insufficient locked amount, system-loan repayment failure, and ordinary commit failure.

Done when: the diagnosis names the fee source, whether XRD was locked, whether the transaction rejected or committed with failure, and which `FeeReserveError` or fee test matches the behavior.

### Account for committed success, committed failure, and rejection

Use this when balances do not line up with `receipt.fee_summary.total_cost()` or a failed transaction still charged fees.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/transaction/transaction_receipt.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/fee_summary.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/fee.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/preview.rs`
- `./references/guide-receipts-events.md`

Pattern:

```rust
receipt.expect_commit(false);
let charged = receipt.fee_summary.total_cost();
let new_balance = old_balance.checked_sub(charged).unwrap();
```

A committed success applies both user state changes and fees. A committed failure rolls back application effects but still charges fees. A rejection does not commit state and the fee-accounting tests expect the account balance to remain unchanged.

Rule: `TransactionOutcome::Failure` is inside `TransactionResult::Commit`; it is not the same surface as `TransactionResult::Reject`.

Done when: balance assertions distinguish application resource movement from fee movement, and the expected receipt branch is proven with `expect_commit_success`, `expect_commit(false)`, or `expect_rejection`.

### Work with contingent fees

Use this when a root transaction, subintent flow, or multi-party manifest locks contingent fees and the expected refund or charge behavior is unclear.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/fee_reserve.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/transaction/transaction_receipt.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/fee.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/subintent_lock_fee.rs`
- `./references/guide-subintents.md`

Pattern:

```rust
let manifest = ManifestBuilder::new()
    .lock_fee(account1, 500)
    .lock_contingent_fee(account2, dec!("0.001"))
    .build();
```

Non-contingent locked fees immediately add to the fee reserve balance. Contingent locked fees are tracked as locked fee movement, but they should be charged only when the transaction succeeds. In failure accounting tests, the non-contingent payer covers the fee while the contingent payer balance remains unchanged.

Rule: contingent fee behavior is about commit outcome, not just about who signed. Check both the fee locks and final account balances.

Done when: tests prove success and failure paths, the payer accounts are named separately, and any subintent explanation keeps root fee payment separate from child intent authorization.

### Interpret fee summaries and fee details

Use this when code displays, compares, or logs execution cost, finalization cost, storage cost, royalty cost, tipping cost, fee destination, or detailed cost breakdowns.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/transaction/transaction_receipt.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/fee_summary.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/costing_module.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/execution_cost.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/preview_v2.rs`
- `./references/guide-receipts-events.md`

Pattern:

```rust
let total = receipt.fee_summary.total_cost();
let details = receipt.fee_details.as_ref();
```

`TransactionFeeSummary` is always present on a receipt. `TransactionFeeDetails` is present only when cost breakdown is enabled on `ExecutionConfig`. Debug information and detailed execution breakdowns are a different surface again and require debug execution config, not ordinary preview.

Rule: do not reconstruct total fee from Gateway display strings. Use structured summary fields and only read `fee_details` after checking it is present.

Done when: every displayed fee number maps to a `TransactionFeeSummary` or `TransactionFeeDetails` field, and missing breakdown data is handled as a disabled-execution-config case.

### Compare preview estimates with actual execution

Use this when preview fees differ from submitted transaction fees or a preview succeeds without the same proof, fee lock, epoch, or auth conditions as the submitted transaction.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/transaction/preview_executor.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/transaction/transaction_executor.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/fee_table.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/preview.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/preview_v2.rs`
- `./references/guide-gateway.md`

Pattern:

```rust
let flags = PreviewFlags {
    use_free_credit: true,
    assume_all_signature_proofs: false,
    skip_epoch_check: false,
    disable_auth: false,
};
```

Preview execution uses `ExecutionConfig::for_preview` or `for_preview_no_auth`, enables cost breakdown, and can enable execution trace. The preview tests compare preview fee estimates to actual execution by adding differences for payload size, archive storage, and signature validation where needed.

Rule: a preview without fee locking can still show positive execution and storage costs when free credit is enabled. That does not prove the submitted transaction can repay fees.

Done when: preview flags, fee-lock presence, payload size differences, signature validation differences, and network ID are all accounted for before treating preview cost as an execution estimate.

### Account for package and component royalty costs

Use this when fees include royalty XRD, royalty recipients look wrong, or a failed transaction unexpectedly did or did not accumulate royalties.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/costing_module.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/fee_reserve.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/costing/fee_summary.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/royalty/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/object_modules/royalty/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/types/royalty_config.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/royalty.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/royalty_edge_cases.rs`
- `./references/guide-royalties.md`

Pattern:

```rust
assert_eq!(receipt.fee_summary.total_royalty_cost_in_xrd, dec!("3"));
assert_eq!(ledger.inspect_package_royalty(package_address), Some(dec!("2")));
assert_eq!(ledger.inspect_component_royalty(component_address).unwrap(), dec!(1));
```

Package royalties are applied from the package royalty native blueprint. Component royalties are applied from the component royalty module when the actor has a royalty module. XRD royalties charge directly; USD royalties are converted using the protocol USD price in XRD.

Rule: use this guide for fee summary, fee reserve, and accumulator accounting. Use `./references/guide-royalties.md` for package royalty setup, component module setup, setter/locker/claimer roles, claim manifests, and generated royalty scenarios.

Done when: the package royalty cost, component royalty cost, receipt total, recipient breakdown, commit outcome, and accumulator behavior are all traced to source.

### Override costing and limits in engine tests

Use this when a source-backed test needs custom fee limits, large transaction limits, disabled costing, disabled auth, debug info, or explicit cost breakdowns.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/transaction/transaction_executor.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/transaction_limits.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/execution_cost.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/preview.rs`
- `./references/guide-testing.md`

Pattern:

```rust
let mut execution_config = ExecutionConfig::for_test_transaction();
execution_config.system_overrides = Some(SystemOverrides {
    costing_parameters: Some(CostingParameters::babylon_genesis().with_execution_cost_unit_limit(1_000_000_000)),
    limit_parameters: Some(limit_parameters),
    ..Default::default()
});
```

`ExecutionConfig` controls side channels such as kernel trace, cost breakdown, execution trace, and debug information. `SystemOverrides` can disable costing, limits, or auth, or replace costing and limit parameters for a test.

Rule: test overrides are not production network policy. Keep them in simulator or engine-test contexts, and cite why the default protocol parameters are not suitable for the test.

Done when: the test names every override, proves the expected failure or success under that override, and avoids using disabled auth or disabled costing to justify production behavior.

### Diagnose transaction limit failures

Use this when execution fails due to substate size, invoke payload size, event/log size, call depth, track size, heap size, or number-of-events/logs limits rather than lack of XRD.

Start with:

- `./.repos/radixdlt-scrypto/radix-common/src/constants/transaction_execution.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/transaction/transaction_executor.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/limits/module.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/transaction_limits.rs`
- `./references/guide-error-diagnostics.md`

Pattern:

```rust
receipt.expect_specific_failure(|e| {
    matches!(
        e,
        RuntimeError::SystemModuleError(SystemModuleError::TransactionLimitsError(_))
    )
});
```

Limit failures come from the limits system module, not the fee reserve. Increasing the fee lock does not fix max substate value size, heap total bytes, track total bytes, invoke payload size, log size, event size, or count failures.

Rule: only use custom limit parameters in tests. For application code and docs, surface the exact limit failure instead of suggesting a larger fee lock.

Done when: the error is classified as a `TransactionLimitsError`, the relevant constant or limit parameter is named, and the test does not conflate size/limit failure with costing failure.

## Reference Routes

- Manifest-level fee locking: use `guide-transaction-manifest.md` for `lock_fee`, `lock_contingent_fee`, wallet fee-locking caveats, and RTM instruction shape.
- Account fee sources: use `guide-account.md` for account vault methods and account authorization around fee locking.
- Gateway receipt fields and transaction stream opt-ins: use `guide-receipts-events.md`.
- Transaction lifecycle placement of preview, submit, and polling: use `guide-transactions.md` or `guide-tx-tool.md`.
- Subintent delegated fee questions: use `guide-subintents.md` with this guide.
- Scrypto package and component royalty setup, setter/locker/claimer roles, and claim manifests: use `guide-royalties.md` with this guide.
- Engine tests and simulator fixtures: use `guide-testing.md` with this guide.

Routing check: choose this guide when the task says costing, fee reserve, execution cost, finalization cost, storage cost, royalty cost, contingent fee, system loan, fee destination, fee details, cost breakdown, preview estimate, or transaction limits.

## Usage Notes

- Keep lock-fee instructions, fee reserve accounting, and receipt presentation in separate reasoning steps.
- Do not treat successful preview as proof of settlement unless preview flags match the intended submission assumptions.
- Prefer structured receipt fields over display strings for fee, royalty, and destination logic.
- Use `guide-royalties.md` when the task is about configuring, updating, locking, or claiming royalties rather than explaining fee totals.
- Use engine tests for protocol semantics and TypeScript tests only for package response mapping.
- When fee behavior seems wrong, first classify the transaction result as commit success, commit failure, reject, or abort.
