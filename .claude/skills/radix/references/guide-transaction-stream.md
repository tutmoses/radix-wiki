# Transaction Stream Guide

## Source Paths

Primary source root: `./.repos/radix-web3.js/packages/transaction-stream/src`

Key paths:

- `index.ts`
- `streamer.ts`
- `config.ts`
- `schemas.ts`
- `streamer.test.ts`
- `../example/index.ts`

Related paths:

- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/gateway/src/schemas.ts`
- `./.repos/radix-web3.js/packages/gateway/src/sbor.ts`
- `./references/guide-gateway.md`
- `./references/guide-sbor.md`

## Mental Model

`@radix-effects/transaction-stream` turns Gateway transaction pages into an Effect `Stream`. It owns stream state, polling cadence, Gateway opt-ins, and state-version advancement. It does not own transaction decoding, business indexing, or persistence.

The service flow is:

1. read mutable stream config from `ConfigService`
2. choose a starting state version
3. call Gateway `streamTransactions`
4. emit non-empty pages
5. advance config state version to `last.state_version + 1`
6. sleep and retry if no new transactions are available

## Examples

Use these examples when building indexing, event-processing, or transaction-following code.

### Start a stream from the current ledger state

Use this when an app wants only new user transactions.

Start with:

- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/config.ts`
- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`

Pattern:

```ts
const configRef = yield* ConfigService.make
const stream = yield* TransactionStreamService.pipe(
  Effect.provide(TransactionStreamService.Default)
)

yield* stream.pipe(
  Stream.provideService(ConfigService, configRef),
  Stream.runForEach((page) => Effect.log(page.length))
)
```

Rule: `Option.none()` for `stateVersion` starts from current Gateway state. Use `Option.some(n)` when replaying history.

Done when: the stream starts from the intended state version and tests prove empty pages do not advance checkpoints incorrectly.

### Replay from a specific state version

Use this when rebuilding an index or recovering after downtime.

Start with:

- `./.repos/radix-web3.js/packages/transaction-stream/src/config.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.test.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/example/index.ts`

Pattern:

```ts
const configRef = yield* ConfigService.make
yield* Ref.update(configRef, (config) => ({
  ...config,
  stateVersion: Option.some(10),
  limitPerPage: 100
}))

yield* stream.pipe(
  Stream.provideService(ConfigService, configRef),
  Stream.runForEach(processPage)
)
```

Rule: persist the last processed state version in application storage if replay must survive process restarts. `ConfigService` only keeps in-memory stream state.

Done when: replay starts from the requested state version, emits deterministic pages, and stores the next checkpoint only after page processing succeeds.

### Persist and resume stream checkpoints outside ConfigService

Use this when the stream feeds an indexer or worker that must survive process restarts.

Start with:

- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/config.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/example/index.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.test.ts`

Pattern:

1. Load the last committed `stateVersion` from durable storage.
2. Seed `ConfigService` with `Option.some(stateVersion)`.
3. Process each emitted page transactionally in the application.
4. Persist `last.state_version + 1` only after all events in the page succeed.
5. On restart, seed from the persisted value and replay idempotently.

Rule: do not add database persistence to `transaction-stream` itself. Persist checkpoints in the consuming app, because idempotency and commit boundaries depend on the indexer domain.

Done when: checkpoint writes are owned by the app, replay is idempotent, and a failed page leaves the previous durable checkpoint intact.

### Add transaction detail opt-ins

Use this when downstream logic needs receipts, detailed events, manifest instructions, raw hex, affected entities, or balance changes.

Start with:

- `./.repos/radix-web3.js/packages/transaction-stream/src/schemas.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/example/index.ts`
- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`

Pattern:

```ts
optIns: makeTransactionDetailsOptIns({
  detailed_events: true,
  manifest_instructions: true,
  balance_changes: true
})
```

Rule: opt-ins can make responses larger and some fields may be absent for recent transactions. Handle optional receipt/event fields explicitly.

Done when: the requested opt-ins appear in the Gateway request and consumers handle absent optional fields without crashing or silently skipping required data.

### Decode event payloads from streamed transactions

Use this when streamed transactions include detailed events with SBOR programmatic JSON.

Start with:

- `./.repos/radix-web3.js/packages/transaction-stream/example/index.ts`
- `./.repos/radix-web3.js/packages/gateway/src/schemas.ts`
- `./.repos/radix-web3.js/packages/gateway/src/sbor.ts`
- `./.repos/radix-web3.js/packages/sbor/src/native.ts`
- `./.repos/radix-web3.js/packages/sbor/README.md`
- `./references/guide-sbor.md`

Pattern:

```ts
const decodeSborValue = (value: unknown) =>
  Effect.try({
    try: () => Schema.decodeUnknownSync(ScryptoSborValueSchema)(value),
    catch: (error) => error
  })

yield* pipe(
  Option.fromNullishOr(tx.receipt),
  Option.flatMap((receipt) => Option.fromNullishOr(receipt.detailed_events)),
  Option.match({
    onNone: () => Effect.succeed([]),
    onSome: (events) =>
      Effect.forEach(events, (event) =>
        decodeSborValue(event.payload.programmatic_json)
      )
  })
)
```

Rule: request `detailed_events`, then decode each `event.payload.programmatic_json` through Gateway/SBOR schemas. Keep decode failures local to the event or transaction if the stream should continue.

Production skeleton: request `detailed_events`, validate each event payload first with Gateway's generic `ScryptoSborValueSchema`, then optionally decode expected events with a typed `@radix-effects/sbor` schema in application code:

```ts
import { bool, decode, decimal, resourceAddress, struct } from "@radix-effects/sbor"

const SwapEvent = struct({
  input_address: resourceAddress,
  input_amount: decimal,
  output_address: resourceAddress,
  output_amount: decimal,
  is_success: bool
})

const decoded = yield* decode(SwapEvent)(event.payload.programmatic_json)
```

Rule: `@radix-effects/sbor` exports curried `decode(schema)(input)` and `encode(schema)(input)` helpers from `packages/sbor/src/native.ts`. Log or dead-letter decode failures with transaction ID and state version, then continue the stream unless the application requires strict all-or-nothing indexing.

Done when: event decoding captures transaction ID, state version, raw payload, decoded payload, and decode failure reason at the application's chosen retry or dead-letter boundary.

### Support multiple networks

Use this when an indexer should stream mainnet and stokenet concurrently.

Start with:

- `./.repos/radix-web3.js/packages/transaction-stream/example/index.ts`
- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/config.ts`

Pattern: provide a separate Gateway config layer and separate `ConfigService` ref for each stream. Do not share one mutable config ref across networks.

Done when: each network has its own Gateway config, config ref, checkpoint, and log annotation, and tests would fail if streams shared mutable state.

### Test stream advancement

Use this when changing pagination, state-version advancement, wait behavior, or emitted page shape.

Start with:

- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.test.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/schemas.ts`

Pattern: fake `GatewayApiClient`, capture `streamTransactions` requests, assert emitted intent hashes, then assert `ConfigService` advanced to `last.state_version + 1`.

Done when: tests cover non-empty page advancement, empty page wait behavior, Gateway error handling, and opt-in propagation.

## Reference Routes

- Empty page or polling behavior: inspect `nextStateVersion === stateVersion` branch in `streamer.ts`.
- Gateway error behavior: inspect `Effect.catchTags` in `streamer.ts` and Gateway error tags.
- Opt-in defaults: inspect `TransactionDetailsOptInsSchema` and `makeTransactionDetailsOptIns`.
- Stream consumer backpressure: use Effect `Stream` operators in application code rather than changing `streamer.ts`.
- Ledger consistency: use Gateway `ledger_state` fields when correlating streamed transactions with other reads.

Routing check: adjacent routing sends decode work to SBOR, ledger reads to Gateway, and durable checkpoint semantics to the consuming application.

## Usage Notes

- Keep persistence and checkpoint storage in the application, not `transaction-stream`.
- Do not emit empty transaction pages unless a consumer explicitly needs heartbeat semantics.
- Keep one `ConfigService` ref per stream instance.
- Treat Gateway opt-ins as part of the contract between stream and consumer.
