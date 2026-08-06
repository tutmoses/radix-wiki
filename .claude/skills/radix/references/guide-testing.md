# Testing Guide

## Source Paths

TypeScript source paths:

- `./.repos/radix-web3.js/package.json`
- `./.repos/radix-web3.js/packages/core/src/client/index.spec.ts`
- `./.repos/radix-web3.js/packages/core/src/network/pollTransactionStatus.spec.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getFungibleBalance.test.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getResourceHolders.test.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getKeyValueStore.test.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntent.spec.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/compileTransaction.spec.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.spec.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/inspectSignedPartialTransaction.spec.ts`
- `./.repos/radix-web3.js/packages/cli/src/cli.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/addSignatures.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/notarize.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/submit.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/status.test.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.test.ts`
- `./.repos/radix-web3.js/packages/connect/src/crypto/encryption.spec.ts`
- `./.repos/radix-web3.js/packages/connect/src/transports/radix-connect-relay/RadixConnectRelayTransport.spec.ts`
- `./.repos/radix-web3.js/packages/connect/src/rola/createRolaMessage.spec.ts`
- `./.repos/radix-web3.js/packages/shared/src/schemas.test.ts`
- `./.repos/radix-web3.js/packages/sbor/src/native.test.ts`
- `./.repos/radix-web3.js/packages/agent-toolkit/src/plugins/astrolecent/tools.test.ts`

Rust and scenario source paths:

- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/transfer_xrd.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/account_authorized_depositors.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/basic_subintents.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/bottlenose/transfer_xrd/manifests/002--transfer--try_deposit_or_abort.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/bottlenose/account_authorized_depositors/manifests/003--account-authorized-depositors-attempt-deposit-failure-if-badge-is-not-present.rtm`
- `./.repos/radixdlt-scrypto/radix-transactions/tests/test_manifest_compiler_error_diagnostics.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/tests/assets/manifest_parser_error_unexpected_eof_1.rtm`
- `./.repos/radixdlt-scrypto/radix-transactions/tests/assets/manifest_parser_error_unexpected_eof_1.diag`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/preview.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/preview_v2.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/auth_zone.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/auth_account.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/subintent_auth.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/subintent_lock_fee.rs`

## Mental Model

Testing is evidence selection. Choose the smallest test surface that can prove the behavior:

- Package-local TypeScript tests prove wrapper shape, schemas, file artifacts, layer wiring, and API contracts.
- Gateway and stream tests prove request shape, pagination, ledger-state consistency, opt-ins, retries, and typed errors without a live ledger.
- Tx-tool tests prove transaction model assembly, signing, hashes, compiled bytes, polling, and lifecycle hooks.
- CLI tests prove durable files, command output, config merging, and non-interactive workflows.
- Scrypto engine tests and transaction scenarios prove protocol semantics, generated RTM, receipts, auth behavior, and manifest diagnostics.

Do not use a broad integration test as the first proof for a small schema or helper change. Do not use a local unit test as proof of engine behavior when the source of truth is a Scrypto scenario, validator, or generated receipt.

## Examples

Use these examples when deciding what to test after changing Radix package code, transaction behavior, manifests, account/auth rules, Gateway reads, wallet transport, or scenario-derived guidance.

### Pick the smallest test surface

Use this when a change could be tested at multiple layers and it is unclear whether to add a unit, service, CLI, Gateway, or Scrypto scenario test.

Start with:

- `./.repos/radix-web3.js/package.json`
- `./.repos/radix-web3.js/packages/core/src/client/index.spec.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.spec.ts`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/application/preview.rs`
- `./references/guide-radix-web3-js.md`

Pattern:

```text
schema/helper change -> package test
Effect service dependency -> layer test
CLI file workflow -> CLI artifact test
Gateway request/response -> mocked Gateway service test
engine semantics -> Scrypto engine test or scenario
```

Rule: match the test to the authority for the behavior. Package tests are enough for wrapper contracts; Scrypto tests are required for claims about engine authorization, receipt semantics, or transaction validation.

Done when: the chosen test names the behavior source of truth and does not rely on a broader layer to prove a lower-level invariant.

### Test Effect services with layers

Use this when a service depends on Gateway, signer, config, epoch, stream state, or another Effect service.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/getFungibleBalance.test.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.spec.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.test.ts`
- `./references/guide-effect-services.md`

Pattern:

```ts
const testLayer = Service.DefaultWithoutDependencies.pipe(
  Layer.provide(Layer.mergeAll(fakeDependencyA, fakeDependencyB)),
)

layer(testLayer)("Service", (it) => {
  it.effect("covers the behavior", Effect.gen(function* () {
    const service = yield* Service
    // assert source-shaped input and output
  }))
})
```

Rule: use `DefaultWithoutDependencies` when testing service behavior and provide fakes through `Layer.succeed` or `Layer.effect`. Use the full `Default` layer only when the test intentionally crosses real dependency boundaries.

Done when: the test asserts the dependency call shape, success output, and a relevant tagged failure without requiring a live Gateway unless the test is explicitly integration-level.

### Test CLI artifact workflows

Use this when changing `rdx` prepare, add-signatures, notarize, submit, status, list, path, config, or template behavior.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/prepare.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/addSignatures.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/notarize.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/submit.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/status.test.ts`
- `./references/guide-cli.md`

Pattern:

```ts
const cwd = yield* makeTempDir("prepare-cwd")
const artifactRoot = join(cwd, ".rdx", "transactions")
const result = yield* prepareTransactionArtifacts({ artifactRoot, ...input })
const prepared = Schema.decodeUnknownSync(PreparedTransactionSchema)(
  JSON.parse(yield* Effect.tryPromise(() => readFile(result.preparedPath, "utf8"))),
)
```

Rule: CLI tests should prove durable file contents, not only returned values. Assert `prepared.json`, signing requests, signature files, notarized hex, submit results, and read-only status behavior at the phase that creates or consumes them.

Done when: tests cover success, malformed input, missing files, duplicate or placeholder signatures, and artifact mutation rules for the command being changed.

### Test transaction hashes, signatures, and compiled bytes

Use this when changing intent construction, signing requests, compile/decompile helpers, notarization, subintent inspection, or transaction ID output.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntent.spec.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/compileTransaction.spec.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/inspectSignedPartialTransaction.spec.ts`
- `./.repos/radix-web3.js/packages/cli/src/signingRequests.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/signatureImport.test.ts`
- `./references/guide-radix-engine-toolkit.md`

Pattern:

```ts
const intentHash = yield* IntentHashService.hash(intent)
const compiled = yield* CompileTransaction.compile(notarizedTransaction)
```

Rule: tie every signature to the exact hash, scope, public key, and transaction model it signs. V1 intent hashes, V2 transaction intent hashes, notary hashes, and subintent hashes are separate identities.

Done when: tests assert both the human-facing ID and raw hash or hex value at the artifact boundary, and invalid hash/scope/signature combinations fail before submission.

### Test Gateway reads and pagination

Use this when changing Gateway services that fetch balances, resource holders, key-value store data, entity details, ledger state, or preview responses.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/getFungibleBalance.test.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getResourceHolders.test.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getKeyValueStore.test.ts`
- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./references/guide-gateway.md`

Pattern:

```ts
const fakeLayer = Layer.succeed(DependencyService, fakeImplementation)
assert.deepStrictEqual(input.at_ledger_state, {
  state_version: ledgerState.state_version,
})
```

Rule: Gateway read tests should pin request shape, pagination cursor handling, stable `at_ledger_state`, response decoding, and typed Gateway errors. Do not prove pagination by checking only the first page.

Done when: tests cover first page, follow-up pages, empty or zero-value filtering if applicable, and at least one failure path mapped to the package error type.

### Test wallet transport and crypto boundaries

Use this when changing Connect relay transport, encrypted wallet responses, message hashes, ROLA messages, or agent-toolkit wallet adapters.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/crypto/encryption.spec.ts`
- `./.repos/radix-web3.js/packages/connect/src/transports/radix-connect-relay/RadixConnectRelayTransport.spec.ts`
- `./.repos/radix-web3.js/packages/connect/src/transports/radix-connect-relay/helpers/createMessageHash.spec.ts`
- `./.repos/radix-web3.js/packages/connect/src/rola/createRolaMessage.spec.ts`
- `./.repos/radix-web3.js/packages/agent-toolkit/src/plugins/astrolecent/tools.test.ts`
- `./references/guide-connect.md`

Pattern:

```text
schema failure -> reject before transport
relay failure -> surface relay error
crypto failure -> name key, hash, sealbox, or AES-GCM layer
wallet rejection -> preserve wallet error response shape
```

Rule: separate framework schema errors, transport errors, crypto errors, wallet rejection, and Radix transaction failures. Tests should fail at the first broken boundary.

Done when: valid round trips, malformed payloads, relay errors, and wallet failure responses are covered without accepting alternate origins, challenges, or response discriminators.

### Use Scrypto scenarios for engine behavior

Use this when TypeScript code or guide text makes a claim about account deposits, auth zones, resource behavior, subintent rules, generated RTM, or receipts.

Start with:

- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/transfer_xrd.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/account_authorized_depositors.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/basic_subintents.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/bottlenose/transfer_xrd/manifests/002--transfer--try_deposit_or_abort.rtm`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/auth_zone.rs`
- `./references/guide-scrypto.md`

Pattern:

```text
scenario source -> generated manifest -> generated receipt or engine test -> guide or code claim
```

Rule: scenario source explains intent and protocol bounds; generated examples show concrete RTM. Use both before copying a manifest pattern into TypeScript docs or tests.

Done when: the implementation note cites the scenario source and generated artifact used as evidence, and the TypeScript test covers only the package adaptation around that source-backed behavior.

### Test manifest compiler diagnostics

Use this when changing manifest text generation, parser/compiler error messages, generated RTM, or user-facing diagnostics around invalid manifests.

Start with:

- `./.repos/radixdlt-scrypto/radix-transactions/tests/test_manifest_compiler_error_diagnostics.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/tests/assets/manifest_parser_error_unexpected_eof_1.rtm`
- `./.repos/radixdlt-scrypto/radix-transactions/tests/assets/manifest_parser_error_unexpected_eof_1.diag`
- `./.repos/radix-web3.js/packages/cli/src/prepare.test.ts`
- `./references/guide-transaction-manifest.md`

Pattern:

```text
invalid RTM fixture -> expected .diag fixture -> TypeScript wrapper error mapping
```

Rule: keep parser, compiler, generator, and wrapper diagnostics distinct. A CLI or tx-tool error should preserve enough manifest location or compiler phase to find the failing RTM fixture class.

Done when: malformed RTM tests assert the smallest useful diagnostic surface and do not collapse manifest parser errors into generic transaction submission failures.

## Reference Routes

- Package-level test placement: inspect `./references/guide-radix-web3-js.md` and the owning package guide.
- Effect service layer tests: inspect `./references/guide-effect-services.md`.
- CLI artifacts and command output: inspect `./references/guide-cli.md` and `./references/cli-command-reference.md`.
- Transaction hashes, signatures, and compiled bytes: inspect `./references/guide-radix-engine-toolkit.md`, `./references/guide-tx-tool.md`, and `./references/guide-subintents.md`.
- Gateway request shape, pagination, and typed errors: inspect `./references/guide-gateway.md`.
- Wallet transport, relay, crypto, and ROLA messages: inspect `./references/guide-connect.md` and `./references/guide-wallet-rola.md`.
- Engine semantics, scenarios, and generated RTM: inspect `./references/guide-scrypto.md` and `./references/guide-transaction-manifest.md`.

Routing check: use this guide to choose evidence and test shape; route the actual implementation behavior to the owning package, transaction, manifest, account, access-rule, or Scrypto guide.

## Usage Notes

- Prefer nearby package tests before adding a cross-package integration test.
- Use Effect layers to replace dependencies instead of mutating global state when the package already uses services.
- For CLI tests, assert files and JSON schemas as well as command output.
- For engine behavior, verify against Scrypto tests or generated scenarios before encoding a TypeScript assumption.
- Keep success, invalid input, dependency failure, and durable artifact mutation as separate test cases when the behavior has separate failure modes.
