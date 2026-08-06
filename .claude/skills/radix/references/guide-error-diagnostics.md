# Error Diagnostics Guide

## Source Paths

TypeScript source paths:

- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/gateway/src/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionStatus.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyValidateManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifestV2.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/compileTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/cli/src/index.ts`
- `./.repos/radix-web3.js/packages/cli/src/bin/rdx.ts`
- `./.repos/radix-web3.js/packages/cli/src/config.ts`
- `./.repos/radix-web3.js/packages/cli/src/artifacts.ts`
- `./.repos/radix-web3.js/packages/cli/src/signatureImport.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`
- `./.repos/radix-web3.js/packages/cli/src/submit.ts`
- `./.repos/radix-web3.js/packages/cli/src/status.ts`
- `./.repos/radix-web3.js/examples/x402/src/config.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentPayload.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentValidation.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentMiddleware.ts`
- `./.repos/radix-web3.js/examples/x402/src/settlement.ts`

Scrypto source paths:

- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/auth/auth_module.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/auth/authorization.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/resource/auth_zone/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/constants/transaction_execution.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/system_access_rule.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/auth_component.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/auth_account.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/subintent_auth.rs`

## Mental Model

Radix failures usually come from a boundary, not from one shared exception model. Diagnose by boundary first:

- Gateway clients turn SDK failures into Effect tagged errors and retry only rate limits.
- Tx-tool turns offline toolkit failures, preview failures, compile failures, signing failures, and status polling outcomes into typed Effect errors.
- The CLI turns internal tagged errors into machine-readable command output and process exit codes.
- x402 middleware turns missing payment, invalid payment headers, exact-payment mismatches, and settlement failures into HTTP responses.
- Scrypto authorization failures come from method accessibility, role assignment, and auth-zone proof checks.

Keep the original tag or protocol status visible. A good diagnostic path names the boundary, the exact tag or status, the input that crossed the boundary, and the source file that maps it.

## Examples

Use these examples to route failing Radix workflows to the source file that owns the error shape.

### Preserve Gateway error tags

Use this when Gateway calls are wrapped, retried, logged, or converted into application errors.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/gateway/src/schemas.ts`
- `./references/guide-gateway.md`
- `./references/guide-effect-services.md`

Pattern:

```ts
Effect.retry({
  while: (error) => error._tag === 'RateLimitExceededError',
});
```

Rule: Gateway SDK `ResponseError` values with `errorResponse.details.type` become specific tagged errors such as `InvalidRequestError`, `EntityNotFoundError`, `InvalidEntityError`, `InvalidTransactionError`, `NotSyncedUpError`, or `TransactionNotFoundError`. HTTP 429 becomes `RateLimitExceededError` with `retryAfter`, then sleeps and retries. Unknown thrown values become `UnknownGatewayError`.

Done when: the caller handles the exact `_tag`, rate-limit retry remains scoped to `RateLimitExceededError`, and tests cover at least one mapped Gateway error plus one unknown error branch if the wrapper changes.

### Diagnose transaction status polling

Use this when a transaction never resolves, resolves as failed, or times out while polling Gateway status.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/transactionStatus.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./references/guide-tx-tool.md`
- `./references/guide-transactions.md`

Pattern:

```text
CommittedSuccess -> success
CommittedFailure -> TransactionFailedError
PermanentlyRejected -> TransactionFailedError
other status -> TransactionNotResolvedError
poll timeout -> TimeoutError
```

Rule: `TransactionNotResolvedError` is the only normal retry branch. `TransactionFailedError` is logged and treated as permanent by lifecycle hook logic. Poll timeouts are normalized into `TimeoutError` with the transaction id.

Done when: the diagnostic records the transaction id, Gateway `intent_status`, `intent_status_description`, `error_message`, and whether lifecycle hooks saw the failure as permanent.

### Separate manifest validation from toolkit execution failures

Use this when a manifest fails before preview or when static analysis output is missing.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyValidateManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifestV2.ts`
- `./references/guide-transaction-manifest.md`
- `./references/guide-radix-engine-toolkit.md`

Pattern:

```text
RadixEngineToolkit throws -> FailedToStaticallyValidateManifestError
Validation result is Invalid -> InvalidManifestError
V1 analysis throws -> FailedToStaticallyAnalyzeManifestError
V2 analysis throws -> FailedToStaticallyAnalyzeManifestV2Error
```

Rule: invalid manifest content and toolkit invocation failures are different diagnostics. Keep the `InvalidManifestError.message` for user-facing manifest fixes, and keep the wrapped `error` for toolkit or binary boundary failures.

Done when: the report names the manifest string or source file, network id, V1 or V2 path, and whether failure came from validation result data or from a thrown toolkit error.

### Diagnose preview, compile, and notarization failures

Use this when transaction construction succeeds but preview, notarization, or compilation fails.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/compileTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./references/guide-tx-tool.md`

Pattern:

```text
Gateway preview receipt.status != Succeeded -> TransactionPreviewError
RET notarization throws -> FailedToNotarizeTransactionError
RET compile throws -> FailedToCompileTransactionError
```

Rule: preview errors are receipt diagnostics and should keep `receipt.error_message`. Compile and notarization errors are toolkit boundary failures and should keep the original wrapped error. `transactionHelper.ts` dies on some construction and compile errors, so inspect the Effect cause when a failure skips the normal typed error channel.

Done when: preview, notarization, compile, and lifecycle-hook observations are separated, and each branch retains either the receipt error message or the original toolkit error.

### Keep CLI failures machine-readable

Use this when changing CLI command parsing, output formatting, validation, or process exit behavior.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/index.ts`
- `./.repos/radix-web3.js/packages/cli/src/bin/rdx.ts`
- `./.repos/radix-web3.js/packages/cli/src/cli.ts`
- `./.repos/radix-web3.js/packages/cli/src/json.ts`
- `./references/guide-cli.md`

Pattern:

```json
{
  "type": "error",
  "code": "MISSING_ARGUMENT",
  "message": "tx prepare requires --manifest"
}
```

Rule: `runRdxEffect` returns `RdxResult` with structured JSON errors on `stderr`. The binary wrapper normalizes Effect CLI validation and tagged errors into JSON with `type`, `code`, and `message`, and sets `process.exitCode = 64` for CLI validation failures.

Done when: JSON and text modes still produce machine-readable errors, unknown commands map to `UNKNOWN_COMMAND`, missing arguments map to `MISSING_ARGUMENT`, and tagged errors produce stable upper-snake codes unless a source-specific `code` field exists.

### Diagnose CLI config, artifacts, and signatures

Use this when `rdx` cannot read config, find workflow files, import signatures, submit, or update transaction status.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/config.ts`
- `./.repos/radix-web3.js/packages/cli/src/artifacts.ts`
- `./.repos/radix-web3.js/packages/cli/src/signatureImport.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`
- `./.repos/radix-web3.js/packages/cli/src/submit.ts`
- `./.repos/radix-web3.js/packages/cli/src/status.ts`
- `./references/guide-cli.md`
- `./references/guide-configuration.md`

Pattern:

```text
ConfigResolutionError -> bad .rdxconfig.json or global config
ArtifactStoreError -> unreadable workflow artifact
SignatureImportError -> invalid file, placeholder, unknown request, or invalid signature
PreparePreviewError -> Gateway preview rejected prepared transaction
SubmitError -> submit workflow precondition or IO failure
TransactionStatusError -> Gateway status query failure
```

Rule: prefer the CLI-specific error over a generic thrown `Error`. Many CLI errors include `path`, `code`, or `reason`; keep those fields because the command runner turns them into the final diagnostic message.

Done when: the failing command, artifact root, config path, transaction id, and tagged error fields are all present in the diagnostic or failing test.

### Diagnose x402 config and payment header failures

Use this when an x402 server starts with bad config, returns `invalid_payment_payload`, or sends the initial 402 payment requirements response.

Start with:

- `./.repos/radix-web3.js/examples/x402/src/config.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentPayload.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentMiddleware.ts`
- `./references/guide-x402.md`
- `./references/guide-configuration.md`

Pattern:

```text
ConfigParseError -> JSON or schema decode failure
ConfigPlaceholderError -> template placeholder was not replaced
missing X-PAYMENT header -> 402 with accepts
InvalidPaymentPayloadError -> 402 invalid_payment_payload
```

Rule: x402 config is intentionally strict. The example schema uses `networkId: 1`, rejects placeholder template values, and expects the payment header to decode as JSON with `payload.transaction`.

Done when: startup errors name parse versus placeholder failure, payment responses distinguish missing payment from malformed payment, and tests check both the 402 requirements body and invalid header body.

### Diagnose exact payment and settlement failures

Use this when a signed partial transaction is present but the facilitator rejects it or settlement returns another status.

Start with:

- `./.repos/radix-web3.js/examples/x402/src/paymentValidation.ts`
- `./.repos/radix-web3.js/examples/x402/src/settlement.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentMiddleware.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/inspectSignedPartialTransaction.ts`
- `./references/guide-x402.md`
- `./references/guide-subintents.md`

Pattern:

```text
UNSUPPORTED_NETWORK
MISSING_SIGNATURE
NESTED_SUBINTENTS_UNSUPPORTED
PAYER_ACCOUNT_NOT_FOUND
NON_EXACT_PAYMENT_SUBINTENT
```

Rule: exact x402 payment validation inspects the signed partial transaction, verifies mainnet, validates the intent discriminator, rejects nested subintents, extracts the payer account from `withdraw`, and compares the normalized manifest to the expected exact payment manifest. Settlement wraps inspection failures as `SignedPartialTransactionInspectionError`; middleware converts non-success settlement statuses into `payment_not_settled`.

Done when: the diagnostic names the validation code, payer account extraction result, subintent hash, settlement status, and whether the failure happened before or after exact-payment validation.

### Trace Scrypto authorization failures

Use this when a manifest, Scrypto scenario, account operation, or component method fails authorization.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/auth/auth_module.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/system/system_modules/auth/authorization.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/object_modules/role_assignment/package.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/resource/auth_zone/blueprint.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/auth_component.rs`
- `./references/guide-access-rules.md`
- `./references/guide-transaction-manifest.md`

Pattern:

```text
method or function call
role assignment lookup
AccessRule::AllowAll | AccessRule::DenyAll | AccessRule::Protected
auth-zone proof checks
AuthError::Unauthorized
```

Rule: authorization failure is not only a missing signature. Check method accessibility, role-list resolution, owner-role fallback, explicit proofs, virtual proofs, and auth-zone scope. The failed access rules in `Unauthorized` are the source for a useful user-facing explanation.

Done when: the failed call is traced to the resolved role or access rule, the auth-zone proof source is identified, and a source-backed scenario proves the same missing-proof or wrong-proof failure.

## Reference Routes

- Gateway diagnostics: route SDK `ResponseError`, rate limits, schema validation, and Gateway preview receipt failures through `guide-gateway.md`.
- Tx-tool diagnostics: route manifest validation, static analysis, compile, signing, preview, submission, and status polling through `guide-tx-tool.md` and `guide-transactions.md`.
- CLI diagnostics: route command parsing, output shape, artifact IO, config resolution, and signature import through `guide-cli.md`.
- x402 diagnostics: route config, payment header, exact-payment validation, settlement, and duplicate-settlement behavior through `guide-x402.md`.
- Authorization diagnostics: route method auth, role assignment, auth-zone proof lifecycle, owner role, and access-rule shape through `guide-access-rules.md`.
- Manifest diagnostics: route RTM syntax, proof instructions, enum payloads, and static validation through `guide-transaction-manifest.md`.
- Testing diagnostics: route expected failure branches, tagged error assertions, CLI exit codes, and golden workflow files through `guide-testing.md`.

Routing check: select the guide by the boundary that produced the error tag or protocol status, then load adjacent guides only for the input that crossed that boundary.

## Usage Notes

- Preserve `_tag`, `code`, `path`, `reason`, transaction id, network id, and Gateway status fields in diagnostics.
- Do not collapse Gateway, toolkit, CLI, x402, and Scrypto failures into a generic `Error` unless the source already does that at the boundary.
- For user-facing fixes, distinguish invalid input from transport failure and from protocol rejection.
- For tests, assert the typed error branch first, then assert message text only where the CLI or HTTP contract requires it.
- If context notes disagree with source, use the source files listed here and update the guide only after source-backed verification.
