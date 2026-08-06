# Receipts And Events Guide

## Source Paths

TypeScript source paths:

- `./.repos/radix-web3.js/packages/tx-tool/src/transactionStatus.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/verifyTransaction.ts`
- `./.repos/radix-web3.js/packages/core/src/network/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/core/src/network/eventData.ts`
- `./.repos/radix-web3.js/packages/gateway/src/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/schemas.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/example/index.ts`

Rust source paths:

- `./.repos/radixdlt-scrypto/radix-engine/src/transaction/transaction_receipt.rs`
- `./.repos/radixdlt-scrypto/radix-engine-toolkit-common/src/receipt/receipt/base.rs`
- `./.repos/radixdlt-scrypto/radix-engine-toolkit-common/src/receipt/receipt/runtime.rs`
- `./.repos/radixdlt-scrypto/radix-engine-toolkit-common/src/receipt/receipt/serializable.rs`
- `./.repos/radixdlt-scrypto/radix-substate-store-queries/src/typed_native_events.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/preview.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/preview_v2.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/assets/blueprints/events/src/scrypto_events.rs`

## Mental Model

A transaction receipt is the execution result surface. It is not the same thing as a Gateway transaction status response, a preview response, or a transaction-stream page.

Keep these surfaces separate:

- status polling decides whether an intent is pending, committed, permanently rejected, failed, or unresolved
- preview receipts estimate and diagnose a transaction before submission
- committed details expose ledger transaction data after commit
- stream opt-ins decide which receipt, event, balance, manifest, and fee fields are present in transaction pages
- native event Rust types define payload semantics for known blueprints and modules
- Gateway event programmatic JSON still needs schema decoding before domain code can trust it

Do not parse human error strings when a structured receipt, status, fee summary, balance change, or event payload is available.

## Examples

Use these examples when a task touches transaction status, preview receipts, committed details, fee summaries, receipt opt-ins, event payloads, native event definitions, or transaction outcome diagnostics.

### Classify transaction status responses

Use this when polling should distinguish pending, committed success, committed failure, permanent rejection, timeout, and retry behavior.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/transactionStatus.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/verifyTransaction.ts`
- `./.repos/radix-web3.js/packages/cli/src/status.ts`
- `./references/guide-transactions.md`
- `./references/guide-error-diagnostics.md`

Pattern:

```text
CommittedSuccess -> complete
CommittedFailure -> terminal failed execution
PermanentlyRejected -> terminal rejection before commit
Pending or uncertain status -> retry until schedule or timeout ends
timeout -> unresolved local polling outcome
```

Rule: a submitted transaction can have multiple distinct outcomes. Keep unresolved polling errors separate from committed failure and permanent rejection, and keep both separate from Gateway HTTP errors.

Done when: the code or diagnostic names the intent hash, status, status description, Gateway error message if present, retry policy, and terminal versus retryable classification.

### Interpret preview receipts and fee summaries

Use this when a helper previews a transaction, estimates fees, fails notarization preview, or maps preview errors into user-facing diagnostics.

Start with:

- `./.repos/radix-web3.js/packages/core/src/network/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/core/src/network/index.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`
- `./.repos/radix-web3.js/packages/cli/src/notarize.ts`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/preview.rs`

Pattern:

```text
preview request -> receipt.status
Succeeded -> read fee_summary fields
Failed or Rejected -> surface receipt.error_message
fee estimate -> execution + finalization + royalty + storage + tipping
```

Rule: preview is not submission. Preview flags such as signature proof assumptions, epoch checks, free credit, and auth disabling affect what the preview proves. Do not treat a successful preview as committed settlement.

Done when: the preview request fields, flags, receipt status, error message, and every fee component used by the estimate are visible in code or test output.

### Fetch committed transaction details

Use this when code needs balance changes, created resources, new entities, receipt data, or transaction details after submission.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/schemas.ts`
- `./references/guide-gateway.md`
- `./references/guide-transactions.md`

Pattern:

```text
submit transaction -> poll CommittedSuccess -> getCommittedDetails -> map only needed fields
```

Rule: committed details should be read after a committed outcome. If a helper derives a resource address or event result from committed details, keep the raw transaction ID and original Gateway response available for debugging.

Done when: the implementation distinguishes submit result, status response, committed details response, and derived domain value.

### Add receipt and event opt-ins to streams

Use this when streamed transaction pages need receipts, fee summaries, fee sources, detailed events, balance changes, affected entities, raw hex, or manifest instructions.

Start with:

- `./.repos/radix-web3.js/packages/transaction-stream/src/schemas.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/example/index.ts`
- `./references/guide-transaction-stream.md`
- `./references/guide-gateway.md`

Pattern:

```ts
makeTransactionDetailsOptIns({
  receipt_fee_summary: true,
  detailed_events: true,
  balance_changes: true,
  manifest_instructions: true
})
```

Rule: opt-ins affect response size and field availability. Some opted-in fields may still be absent for recent or partial responses, so consumers must handle missing receipt, event, fee, and balance fields explicitly.

Done when: tests or logs prove the requested opt-ins are sent and the consumer handles both present and absent optional receipt fields.

### Decode detailed event payloads

Use this when a stream, committed transaction, or Gateway response includes detailed events that must become typed application data.

Start with:

- `./.repos/radix-web3.js/packages/transaction-stream/example/index.ts`
- `./.repos/radix-web3.js/packages/core/src/network/eventData.ts`
- `./.repos/radix-web3.js/packages/sbor/src/native.ts`
- `./.repos/radix-web3.js/packages/gateway/src/sbor.ts`
- `./references/guide-sbor.md`
- `./references/guide-transaction-stream.md`

Pattern:

```text
request detailed_events
validate programmatic_json with Gateway SBOR schema
decode expected payload with @radix-effects/sbor schema
attach transaction ID and state version to decode failures
```

Rule: event field extraction is not validation by itself. Use generic Gateway SBOR validation first, then decode the expected domain event with a typed schema when the application depends on field names or value kinds.

Done when: each decoded event stores transaction ID, state version, emitter, event name, raw payload, decoded payload, and decode failure reason if decoding fails.

### Map native event payloads to source definitions

Use this when an app handles account, resource, vault, pool, validator, metadata, role-assignment, package, or native blueprint events.

Start with:

- `./.repos/radixdlt-scrypto/radix-substate-store-queries/src/typed_native_events.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/pool/v1/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/metadata/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/events.rs`
- `./references/guide-sbor.md`

Pattern:

```text
EventTypeIdentifier -> emitter module or native package -> typed native event key -> SBOR payload type
```

Rule: native event typing depends on emitter, module ID, entity type, blueprint package, and event name. Do not identify an event by event name alone; several blueprints can share names such as `DepositEvent` or `WithdrawEvent`.

Done when: the handler checks emitter, module, event name, payload schema, and unsupported native or custom blueprint behavior.

### Diagnose account deposit and rejected deposit events

Use this when a transaction commits but a deposit was refunded, rejected, or only visible as an event.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/account_authorized_depositors.rs`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./references/guide-account.md`
- `./references/guide-resources-vaults.md`

Pattern:

```text
try_deposit_or_refund -> committed transaction can include rejected deposit event
try_deposit_or_abort -> rejected deposit can fail the transaction
event payload -> resource address plus amount or non-fungible local IDs
```

Rule: committed success does not imply every attempted deposit was accepted. Inspect account events and balance changes before claiming a deposit succeeded.

Done when: the diagnostic names deposit method, account setting, event type, resource address, amount or IDs, and final worktop or balance outcome.

### Interpret Toolkit receipt summaries

Use this when Radix Engine Toolkit receipt data is used for new entities, metadata updates, worktop changes, fee summary, or minted non-fungibles.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-toolkit-common/src/receipt/receipt/base.rs`
- `./.repos/radixdlt-scrypto/radix-engine-toolkit-common/src/receipt/receipt/runtime.rs`
- `./.repos/radixdlt-scrypto/radix-engine-toolkit-common/src/receipt/receipt/serializable.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/transaction/transaction_receipt.rs`
- `./references/guide-radix-engine-toolkit.md`
- `./references/guide-sbor.md`

Pattern:

```text
CommitSuccess -> state_updates_summary + worktop_changes + fee_summary + locked_fees
CommitFailure -> debug reason string
Reject -> debug reason string
Abort -> debug reason string
```

Rule: the Toolkit receipt model intentionally receives already-derived data. Preserve that boundary; do not re-derive worktop changes or minted non-fungibles in TypeScript unless the Toolkit output does not cover the required use case.

Done when: derived fields name whether they came from Gateway, Toolkit receipt summary, engine receipt, state updates, execution trace, or event payloads.

### Test receipt and event behavior

Use this when changing preview, status, committed details, stream opt-ins, event decoding, or domain diagnostics from receipts.

Start with:

- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/notarize.test.ts`
- `./.repos/radix-web3.js/packages/core/src/network/pollTransactionStatus.spec.ts`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/preview.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/events.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/assets/blueprints/events/src/scrypto_events.rs`

Pattern:

```text
status tests -> terminal and retryable status
preview tests -> succeeded and failed receipt
stream tests -> opt-ins and optional fields
engine event tests -> emitted event count, emitter, name, and decoded payload
```

Rule: test the layer that owns the behavior. Do not prove event decoding with a status poll test, and do not prove terminal transaction classification with a stream opt-in test.

Done when: each changed outcome has one positive and one negative case at the layer where the behavior is owned.

## Reference Routes

- Transaction construction, signing, submission, and polling flow: use `./references/guide-transactions.md`.
- Stream checkpointing, page advancement, and transaction-page polling: use `./references/guide-transaction-stream.md`.
- Engine-level fee reserve, costing, contingent fee, royalty fee totals, preview-estimate, and transaction-limit semantics: use `./references/guide-costing-fees.md`.
- Royalty setup, claims, roles, accumulators, and generated royalty scenarios: use `./references/guide-royalties.md`.
- Generic SBOR value decoding and typed `@radix-effects/sbor` schemas: use `./references/guide-sbor.md`.
- Account deposit rules and rejected-deposit behavior: use `./references/guide-account.md`.
- Gateway request shape, pagination, and ledger-state consistency: use `./references/guide-gateway.md`.
- Error tags and user-facing diagnostics: use `./references/guide-error-diagnostics.md`.

Routing check: choose this guide when the task starts from a receipt, status response, preview result, committed transaction, event payload, or fee summary. Switch to `guide-costing-fees.md` when the task asks why a fee was charged or how engine costing works.

## Usage Notes

- Preserve raw transaction IDs and original Gateway responses in diagnostics.
- Request detailed events before trying to decode event payloads.
- Treat preview, status, committed details, and stream pages as different source surfaces.
- Prefer structured receipt, status, fee, balance, and event fields over text parsing.
