# Effect Services Guide

## Source Paths

TypeScript service paths:

- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getFungibleBalance.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getFungibleBalance.test.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.spec.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionStatus.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/compileTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyValidateManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/signer/signer.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/config.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/addSignatures.ts`
- `./.repos/radix-web3.js/packages/cli/src/signatureImport.ts`
- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radix-web3.js/packages/shared/src/schemas.test.ts`

## Mental Model

Radix packages use Effect as the service boundary for Gateway IO, transaction orchestration, file-backed CLI workflows, schemas, retries, and test injection. Treat each service as a small module with explicit dependencies and a layer that wires its default implementation.

The common package shape is:

- A `Context.Service` class names the capability.
- `make` reads dependencies with `yield* ServiceName` and returns plain functions or an object of functions.
- `DefaultWithoutDependencies` builds the service itself.
- `Default` provides the package's production dependencies.
- Tests provide `DefaultWithoutDependencies` and replace downstream services with `Layer.succeed` or `Layer.effect`.

Keep errors typed with `Data.TaggedError`, validate external data with `Schema`, and keep Promise SDK boundaries inside `Effect.tryPromise`.

## Examples

Use these examples when changing Effect code inside `packages/gateway`, `packages/tx-tool`, `packages/transaction-stream`, `packages/cli`, or shared schema packages.

### Add a service with explicit dependencies

Use this when a package needs a new reusable capability instead of a loose helper function.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/getFungibleBalance.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyValidateManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./references/guide-gateway.md`

Pattern:

```ts
export class MyService extends Context.Service<MyService>()("MyService", {
  make: Effect.gen(function*() {
    const dependency = yield* DependencyService

    return Effect.fn("MyService.operation")(function*(input: Input) {
      return yield* dependency(input)
    })
  })
}) {
  static readonly DefaultWithoutDependencies = Layer.effect(this, this.make)
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(DependencyService.Default)
  )
}
```

Rule: read dependencies in `make`, not at module load. Return functions from `make` so tests can invoke the service through Effect context.

Done when: the service name is stable, dependencies are explicit, `DefaultWithoutDependencies` exists for tests, and `Default` provides only production dependencies.

### Wire tests with replacement layers

Use this when a test needs to replace Gateway, signer, file IO, or a lower service.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/getFungibleBalance.test.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.spec.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.test.ts`
- `./references/guide-tx-tool.md`

Pattern:

```ts
const fakeDependencyLayer = Layer.succeed(
  DependencyService,
  Effect.fn("testDependency")((input) => Effect.succeed(output))
)

const testLayer = MyService.DefaultWithoutDependencies.pipe(
  Layer.provide(fakeDependencyLayer)
)
```

Rule: tests should provide the service under test separately from its dependencies. Avoid testing a lower service indirectly when `DefaultWithoutDependencies` lets the test replace it directly.

Done when: the test proves the service contract, asserts important downstream inputs, and does not require live Gateway, wallet, network, or file-system state unless the test is explicitly integration-level.

### Read runtime configuration through Effect

Use this when behavior depends on network ID, Gateway URL, retry timing, pagination limits, or mutable stream checkpoints.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionStatus.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/config.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.ts`
- `./references/guide-transaction-stream.md`

Pattern:

```ts
const networkId = yield* Config.number("NETWORK_ID").pipe(
  Config.withDefault(1),
  Effect.orDie,
)

const retryDelay = yield* Config.duration("TRANSACTION_STATUS_POLL_DELAY").pipe(
  Config.withDefault(Duration.millis(100)),
  Effect.orDie,
)
```

Rule: use `Config` for environment-style configuration and a service-held `Ref` for mutable runtime state such as transaction stream checkpoints.

Done when: defaults are visible in the service, tests can override config or the config service, and network-dependent services receive a single consistent network ID.

### Wrap SDK promises into typed errors

Use this when calling the Babylon Gateway SDK, Radix Engine Toolkit, platform file IO, or any promise-returning API.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/compileTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyValidateManifest.ts`
- `./.repos/radix-web3.js/packages/cli/src/signatureImport.ts`
- `./references/guide-radix-engine-toolkit.md`

Pattern:

```ts
const result = yield* Effect.tryPromise({
  try: () => sdkCall(input),
  catch: (error) => new TaggedBoundaryError({ error }),
})
```

Rule: map external errors at the boundary where they occur. Keep Gateway response variants, Toolkit failures, validation errors, and user file errors distinguishable with tagged errors.

Done when: callers can `catchTag` or `catchTags` by domain error, and unknown external exceptions are not thrown through untyped promises.

### Poll transaction status with retry and timeout

Use this when code waits for Gateway transaction finality or any status that can be temporarily unresolved.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/transactionStatus.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntent.spec.ts`
- `./references/guide-transactions.md`

Pattern:

```ts
const retryPolicy = Schedule.exponential(pollDelay).pipe(
  Schedule.bothLeft(Schedule.recurs(maxPollAttempts))
)

return getTransactionStatus(id).pipe(
  Effect.retry({
    schedule: input.retryPolicy ?? retryPolicy,
    while: (error) => error._tag === "TransactionNotResolvedError",
  }),
  Effect.timeout(input.timeout ?? pollTimeoutDuration),
)
```

Rule: retry only unresolved statuses. Committed failures and permanent rejections should fail without being treated as transient polling misses.

Done when: retry delay, max attempts, timeout, permanent failure, and success behavior are all separately visible in source or tests.

### Model optional extension points as services

Use this when callers need to swap signing, notary behavior, lifecycle observation, or workflow adapters.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/signer/signer.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/notaryKeyPair.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.spec.ts`
- `./references/guide-tx-tool.md`

Pattern:

```ts
const optionalHook = yield* Effect.serviceOption(TransactionLifeCycleHook)

yield* Option.match(optionalHook, {
  onNone: () => Effect.void,
  onSome: (hook) => hook.onSubmit?.({ id, intent }) ?? Effect.void,
})
```

Rule: inject extension points through context. Do not hide signer, notary, or lifecycle behavior in globals.

Done when: production callers can use defaults, tests can supply fake services, and optional hooks remain optional for callers that do not provide them.

### Decode external JSON and artifacts with Schema

Use this when CLI commands read workflow files, signature files, prepared transaction artifacts, or user-supplied JSON.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/addSignatures.ts`
- `./.repos/radix-web3.js/packages/cli/src/signatureImport.ts`
- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radix-web3.js/packages/shared/src/schemas.test.ts`
- `./references/guide-cli.md`

Pattern:

```ts
const prepared = yield* readJson(path).pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(PreparedTransactionSchema)),
)
```

Rule: decode unknown input before branching on business rules. Map schema failures to workflow-specific tagged errors when the caller needs user-facing diagnostics.

Done when: malformed files fail before transaction logic runs, branded values are preserved at the boundary, and tests cover at least one invalid input path.

### Build streams with stateful refs

Use this when a service repeatedly fetches Gateway pages and must remember a ledger checkpoint.

Start with:

- `./.repos/radix-web3.js/packages/transaction-stream/src/config.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.test.ts`
- `./references/guide-transaction-stream.md`

Pattern:

```ts
return Stream.unfold(1, () =>
  Effect.gen(function*() {
    const configRef = yield* ConfigService
    const config = yield* Ref.get(configRef)
    const page = yield* gatewayApiClient.stream.innerClient.streamTransactions(...)
    yield* Ref.update(configRef, (state) => ({
      ...state,
      stateVersion: Option.some(nextStateVersion),
    }))
    return Option.some([page.items, 1])
  })
)
```

Rule: store stream cursors in a service-owned `Ref`, not in module globals. Tests should assert both emitted items and updated checkpoint state.

Done when: empty pages, non-empty pages, checkpoint updates, opt-ins, and wait timing are all modeled through Effect values.

## Reference Routes

- Gateway API wrappers and error mapping: read `./references/guide-gateway.md`.
- Transaction orchestration, signer injection, lifecycle hooks, and status polling: read `./references/guide-tx-tool.md`.
- Stream checkpoints and Gateway transaction pages: read `./references/guide-transaction-stream.md`.
- CLI workflow files and artifact validation: read `./references/guide-cli.md` and `./references/cli-command-reference.md`.
- Shared branded schemas and boundary values: read `./references/guide-shared.md`.
- Toolkit promise boundaries and byte/hash conversions: read `./references/guide-radix-engine-toolkit.md`.

Routing check: choose this guide when the task is about Effect service shape, layer wiring, config, retries, typed errors, schema decoding, or stream state; choose the package guide when the task is about domain behavior inside that service.

## Usage Notes

- Prefer `Context.Service` plus layers for shared capabilities.
- Keep `DefaultWithoutDependencies` available for tests.
- Keep `Default` responsible for production dependency wiring only.
- Use `Data.TaggedError` for expected domain failures.
- Use `Effect.tryPromise` at external async boundaries.
- Use `Schema.decodeUnknownEffect` for user, file, Gateway, and artifact data crossing trust boundaries.
- Use `Effect.serviceOption` for optional hooks and extension points.
