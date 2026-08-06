# Configuration Guide

## Source Paths

TypeScript configuration paths:

- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/gateway/src/rola.ts`
- `./.repos/radix-web3.js/packages/gateway/README.md`
- `./.repos/radix-web3.js/packages/cli/src/config.ts`
- `./.repos/radix-web3.js/packages/cli/src/config.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/cli.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`
- `./.repos/radix-web3.js/packages/cli/src/notarize.ts`
- `./.repos/radix-web3.js/packages/cli/src/submit.ts`
- `./.repos/radix-web3.js/packages/cli/src/status.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionStatus.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/signer/signer.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/notaryKeyPair.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHeader.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/config.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.ts`
- `./.repos/radix-web3.js/examples/x402/src/config.ts`
- `./.repos/radix-web3.js/examples/x402/src/serverMain.ts`
- `./.repos/radix-web3.js/examples/x402/src/worker.ts`
- `./.repos/radix-web3.js/examples/x402/wrangler.jsonc`
- `./.repos/radix-web3.js/examples/x402/x402.config.template.json`

## Mental Model

Configuration is a boundary contract. Keep process configuration, file configuration, service injection, and mutable runtime state separate:

- Gateway and tx-tool polling use Effect `Config` for environment-style values.
- ROLA adds required identity configuration on top of the Gateway network.
- CLI config is file-backed and merges defaults, global config, nearest project config, then explicit overrides.
- tx-tool signing is an injected service. Private keys belong in `Signer` layers or external signers, not in CLI workflow files.
- transaction-stream checkpoints are mutable service state held in a `Ref`, not environment variables.
- x402 configuration is schema-decoded, placeholder-checked, and currently mainnet-only in the reference example.

Most config bugs are alignment bugs. Check network ID, Gateway URL, dApp definition address, account addresses, notary public key, signer public key, artifact root, and runtime environment together before changing code.

## Examples

Use these examples when a task changes runtime configuration, environment variables, CLI config files, transaction signing inputs, stream checkpoints, or x402 deployment settings.

### Configure Gateway client settings

Use this when a Gateway service must run against a specific network, Gateway base URL, app name, or authenticated Gateway endpoint.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/gateway/README.md`
- `./references/guide-gateway.md`
- `./references/guide-effect-services.md`

Pattern:

```text
NETWORK_ID defaults to 1
GATEWAY_URL defaults to undefined
APPLICATION_NAME defaults to @radix-effects/gateway
GATEWAY_BASIC_AUTH defaults to undefined
```

Rule: `GatewayApiClient` constructs the Babylon Gateway SDK once from Effect config and exposes the chosen `networkId` to downstream services. Keep Gateway URL and network ID aligned with every address or transaction header in the same workflow.

Done when: tests or deployment notes name the intended network ID, Gateway base URL, application name, and optional basic-auth value, and downstream services do not introduce a second network source.

### Configure ROLA verification

Use this when wallet login, persona proof verification, account proof verification, or dApp definition alignment changes.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/rola.ts`
- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/connect/src/rola/createRolaMessage.ts`
- `./references/guide-wallet-rola.md`

Pattern:

```text
APPLICATION_NAME defaults to @radix-effects/gateway
DAPP_DEFINITION_ADDRESS is required
ROLA_EXPECTED_ORIGIN is required
networkId comes from GatewayApiClient.networkId
```

Rule: ROLA is not a session system. It verifies wallet proof ownership for one dApp definition, origin, and network. Do not let a client-provided dApp definition or origin override server config during verification.

Done when: ROLA setup fails fast on missing dApp definition or origin, and tests cover wrong origin, wrong network, and wrong dApp definition separately from session authorization.

### Resolve CLI project and global config

Use this when `rdx` config behavior, artifact locations, network defaults, or project-local overrides are involved.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/config.ts`
- `./.repos/radix-web3.js/packages/cli/src/config.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/schemas.ts`
- `./references/guide-cli.md`

Pattern:

```json
{
  "network": "stokenet",
  "gatewayBaseUrl": "https://stokenet.radixdlt.com",
  "artifactScope": "local",
  "artifactDirectory": ".rdx/transactions",
  "notary": {
    "publicKey": {
      "curve": "Ed25519",
      "hex": "..."
    },
    "notaryIsSignatory": false
  }
}
```

Rule: `resolveRdxConfig` applies defaults first, then `~/.rdx/config.json`, then the nearest `.rdxconfig.json` found by walking upward from the current directory, then explicit overrides. `artifactDirectory` wins over `artifactScope`; otherwise local artifacts live under the current working directory and global artifacts live under the home directory.

Done when: config tests prove default behavior, global plus project merge order, explicit artifact directory behavior, and invalid config errors that report the failing config path.

### Configure CLI transaction workflow inputs

Use this when `rdx tx prepare`, `rdx tx notarize`, `rdx tx submit`, or `rdx tx status` needs a network, Gateway URL, notary, or artifact root.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/cli.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`
- `./.repos/radix-web3.js/packages/cli/src/notarize.ts`
- `./.repos/radix-web3.js/packages/cli/src/submit.ts`
- `./.repos/radix-web3.js/packages/cli/src/status.ts`
- `./.repos/radix-web3.js/packages/cli/src/signingRequests.ts`

Pattern:

```text
tx prepare reads --notary-file when present
tx prepare falls back to config.notary
tx prepare fails before writing unusable artifacts when no notary is available
preview, submit, and status use config.gatewayBaseUrl or the network default
```

Rule: the CLI stores public workflow material and signature artifacts. It should not take custody of private notary keys through config files. Keep out-of-band signing explicit through signing request and signature template artifacts.

Done when: transaction workflow tests prove notary-file and config-notary paths, missing-notary failure, Gateway URL selection, and artifact-root use without depending on accidental current working directory state.

### Configure tx-tool signer and polling behavior

Use this when transaction code signs hashes, derives notary public keys, polls status, or changes retry timing.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/signer/signer.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/notaryKeyPair.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHeader.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionStatus.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./references/guide-tx-tool.md`

Pattern:

```text
TRANSACTION_STATUS_POLL_TIMEOUT defaults to 1 minute
TRANSACTION_STATUS_MAX_POLL_ATTEMPTS_COUNT defaults to 10
TRANSACTION_STATUS_POLL_DELAY defaults to 100 millis
Signer.makePrivateKeySigner takes Redacted<HexString>
NotaryKeyPair delegates publicKey and signing to Signer
```

Rule: signer choice is a service dependency. Avoid process-global private keys inside tx-tool code; inject a signer layer or provide an external signing implementation. Polling config controls unresolved statuses only; committed failures and permanent rejections should fail without being retried as transient.

Done when: signing tests provide a signer layer, polling tests can override retry policy or config, and the transaction header network ID still comes from the Gateway client or explicit caller input.

### Configure transaction-stream checkpoint state

Use this when streaming should start at a specific state version, adjust page size, change idle wait time, or request different transaction detail opt-ins.

Start with:

- `./.repos/radix-web3.js/packages/transaction-stream/src/config.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/schemas.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/src/streamer.test.ts`
- `./references/guide-transaction-stream.md`

Pattern:

```text
stateVersion defaults to Option.none()
limitPerPage defaults to 100
waitTime defaults to 60 seconds
optIns default to makeTransactionDetailsOptIns()
```

Rule: `ConfigService` is a `Ref<Config>`. The stream updates `stateVersion` after each page and sleeps only when no new state version is found. Use Effect config for process settings elsewhere, but keep transaction-stream progress in the stream config service.

Done when: tests prove the initial state version, next-state update, empty-page wait behavior, page size, and opt-ins sent to Gateway.

### Configure x402 Node and Worker runtimes

Use this when changing the x402 reference server, Worker deployment, config template, or placeholder validation.

Start with:

- `./.repos/radix-web3.js/examples/x402/src/config.ts`
- `./.repos/radix-web3.js/examples/x402/src/serverMain.ts`
- `./.repos/radix-web3.js/examples/x402/src/worker.ts`
- `./.repos/radix-web3.js/examples/x402/wrangler.jsonc`
- `./.repos/radix-web3.js/examples/x402/x402.config.template.json`
- `./references/guide-x402.md`

Pattern:

```text
Node reads X402_CONFIG or x402.config.template.json
Node reads PORT or 4020
Node and Worker read X402_MOCK_SETTLEMENT
Worker maps vars into X402Config
X402ConfigSchema currently requires networkId literal 1
validateX402Config rejects placeholder values
```

Rule: the x402 reference is mainnet-shaped. Keep `networkId`, `radix:mainnet`, Gateway URL, resource URL, fee payer, pay-to account, asset, amount, facilitator notary badge, timeout, and intent discriminator aligned before changing settlement logic.

Done when: config tests cover malformed JSON and placeholder rejection, Worker vars match the schema fields, and deployment config does not contain placeholder payment addresses or resource addresses.

## Reference Routes

- Gateway runtime env: inspect `gatewayApiClient.ts` and `guide-gateway.md`.
- ROLA identity config: inspect `rola.ts`, `createRolaMessage.ts`, and `guide-wallet-rola.md`.
- CLI config files and artifacts: inspect `config.ts`, `cli.ts`, and `guide-cli.md`.
- tx-tool signer and polling: inspect `signer.ts`, `notaryKeyPair.ts`, `transactionStatus.ts`, and `guide-tx-tool.md`.
- transaction-stream checkpoint state: inspect `transaction-stream/src/config.ts`, `streamer.ts`, and `guide-transaction-stream.md`.
- x402 server and Worker config: inspect `examples/x402/src/config.ts`, `worker.ts`, `serverMain.ts`, and `guide-x402.md`.

Routing check: adjacent routing sends address HRP and network ID bugs to `guide-network-addresses.md`, transaction lifecycle behavior to `guide-transactions.md`, and plain Gateway API behavior to `guide-gateway.md`.

## Usage Notes

- Keep config source order explicit in tests. Defaults, file config, env config, and caller overrides should not be interchangeable by accident.
- Keep secrets out of durable workflow artifacts. Store public keys, hashes, signatures, and paths there; inject private key signing through services or external signers.
- Align network ID, Gateway URL, and address prefixes before debugging higher-level wallet, ROLA, or transaction failures.
- Prefer Schema decoding at file and JSON boundaries, and Effect `Config` for process/environment values.
- Do not add a new global env var when an existing service layer or config file already owns that branch.
