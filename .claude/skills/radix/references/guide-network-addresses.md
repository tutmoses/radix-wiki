# Network And Addresses Guide

## Source Paths

TypeScript source paths:

- `./.repos/radix-web3.js/packages/core/src/network/getRadixGatewayBaseUrl.ts`
- `./.repos/radix-web3.js/packages/core/src/network/index.ts`
- `./.repos/radix-web3.js/packages/core/src/network/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/core/src/network/submitTransaction.ts`
- `./.repos/radix-web3.js/packages/core/src/account/index.ts`
- `./.repos/radix-web3.js/packages/core/src/persona/index.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/getKnownAddresses.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/transformStringManifest.ts`
- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/gateway/src/rola.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntent.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntentV2.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHeader.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHeaderV2.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/faucet.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/test-helpers/createAccount.ts`
- `./.repos/radix-web3.js/packages/cli/src/config.ts`
- `./.repos/radix-web3.js/packages/cli/src/schemas.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`
- `./.repos/radix-web3.js/packages/cli/src/accountReads.ts`
- `./.repos/radix-web3.js/packages/cli/src/submit.ts`
- `./.repos/radix-web3.js/packages/cli/src/status.ts`
- `./.repos/radix-web3.js/packages/cli/src/notarize.ts`
- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`

Rust source paths:

- `./.repos/radixdlt-scrypto/radix-common/src/network/mod.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/address/encoder.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/address/decoder.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/address/hrpset.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/types/entity_type.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/types/addresses/component_address.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/types/addresses/resource_address.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/types/addresses/package_address.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/types/addresses/global_address.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/constants/native_addresses.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/header.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/transaction_header_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/intent_header_v2.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/subintent_v2.rs`

## Mental Model

Network ID is the protocol coordinate. It affects Gateway client configuration, transaction headers, manifest conversion and validation, virtual address derivation, known native addresses, ROLA verification, and Bech32 HRPs.

Address strings carry both an entity kind and a network HRP. `account_rdx...` and `account_tdx_2_...` can describe the same kind of entity on different networks, but they are not interchangeable. Branded TypeScript string schemas document intent; they do not prove the HRP or entity byte is correct unless code explicitly decodes or validates the address.

Keep four values aligned for user-facing flows:

- named network such as `mainnet` or `stokenet`
- numeric network ID such as `1` or `2`
- Gateway base URL
- addresses, transaction IDs, and dApp definition addresses encoded for that network

## Examples

Use these examples when a task touches network IDs, Gateway URLs, address derivation, address validation, transaction headers, known native addresses, CLI network selection, or wrong-network failures.

### Choose the network ID at the boundary

Use this when public API input, config, CLI flags, or environment variables choose which Radix network a flow uses.

Start with:

- `./.repos/radix-web3.js/packages/core/src/network/getRadixGatewayBaseUrl.ts`
- `./.repos/radix-web3.js/packages/core/src/network/index.ts`
- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radixdlt-scrypto/radix-common/src/network/mod.rs`

Pattern:

```ts
const gatewayApiClient = GatewayApiClient.initialize({
  networkId: input.networkId,
  applicationName: "radix-web3.js",
})

const networkConfig = RadixNetworkConfigById[input.networkId]
```

Rule: resolve the named network to one numeric ID once at the boundary, then pass that ID through Gateway, Toolkit, transaction header, and manifest validation calls. Mainnet is `1`; stokenet is `2` in both TypeScript helpers and Scrypto `NetworkDefinition`.

Done when: the code has one source for the selected network, Gateway URL and numeric ID agree, and tests cover at least mainnet and stokenet when the branch supports both.

### Derive virtual account or identity addresses

Use this when code derives an account address, persona identity address, or CLI account address from a public key.

Start with:

- `./.repos/radix-web3.js/packages/core/src/account/index.ts`
- `./.repos/radix-web3.js/packages/core/src/persona/index.ts`
- `./.repos/radix-web3.js/packages/cli/src/accountReads.ts`
- `./.repos/radixdlt-scrypto/radix-common/src/types/addresses/component_address.rs`
- `./references/guide-account.md`

Pattern:

```ts
const account =
  RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
    publicKey,
    networkId,
  )

const identity =
  RadixEngineToolkit.Derive.virtualIdentityAddressFromPublicKey(
    publicKey,
    networkId,
  )
```

Rule: account and identity derivation use different entity types. The same public key on a different network produces a different Bech32 address because the HRP changes.

Done when: the derivation call receives the intended network ID, the code distinguishes account from identity, and the resulting address is used only with matching Gateway and wallet network settings.

### Look up known native addresses

Use this when code needs XRD, the faucet, consensus manager, package addresses, or other native addresses.

Start with:

- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/getKnownAddresses.ts`
- `./.repos/radix-web3.js/packages/core/src/network/index.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/faucet.ts`
- `./.repos/radixdlt-scrypto/radix-common/src/constants/native_addresses.rs`

Pattern:

```ts
const knownAddresses =
  await RadixEngineToolkit.Utils.knownAddresses(networkId)

const xrd = knownAddresses.resourceAddresses.xrd
const faucet = knownAddresses.componentAddresses.faucet
```

Rule: known native addresses are network-specific. Do not hardcode an XRD, faucet, package, or consensus-manager address unless the code path is explicitly locked to that network.

Done when: the known-address lookup uses the same network ID as the transaction or Gateway client, and tests or examples do not mix mainnet and stokenet address strings.

### Validate address syntax and entity kind

Use this when accepting user-provided addresses, filtering Gateway entities, or converting between branded string types and protocol addresses.

Start with:

- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radixdlt-scrypto/radix-common/src/address/decoder.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/address/hrpset.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/types/entity_type.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/types/addresses/global_address.rs`

Pattern:

```ts
const account = AccountAddress.make(input.address)
```

Pattern means: this brands a string for TypeScript. It does not prove that the string is a Bech32 account address for the selected network. Source-backed validation needs an address decoder, a Toolkit helper, or a Gateway/API call that rejects wrong HRP or entity type.

Done when: the boundary either validates HRP and entity kind or names the value as an untrusted branded string, and wrong-kind plus wrong-network address tests exist for user input.

### Keep transaction header network IDs consistent

Use this when building V1 intents, V2 intents, signed partial transactions, or CLI transaction artifacts.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHeader.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHeaderV2.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntent.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntentV2.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v1/header.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/model/v2/intent_header_v2.rs`

Pattern:

```ts
const networkId = NetworkId.make(gatewayApiClient.networkId)

const header = yield* createTransactionHeader({
  networkId,
  startEpochInclusive,
  endEpochExclusive,
})
```

Rule: V1 stores `network_id` on `TransactionHeaderV1`. V2 stores `network_id` on `IntentHeaderV2`; `TransactionHeaderV2` only carries notary and tip fields. Do not copy V1 assumptions into V2 code.

Done when: the header network ID comes from the selected Gateway or CLI network, V1/V2 header placement is explicit, and prepared artifacts expose the network ID needed for later signing, notarizing, or submission.

### Preview and submit on the intended network

Use this when preview, submit, poll, status, or transaction ID logic behaves differently across networks.

Start with:

- `./.repos/radix-web3.js/packages/core/src/network/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/core/src/network/submitTransaction.ts`
- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/submitTransaction.ts`

Pattern:

```ts
const gatewayApiClient = GatewayApiClientSdk.initialize({
  networkId,
  basePath,
  applicationName,
})
```

Rule: compiled payloads, transaction IDs, preview responses, and Gateway submission must target the same network. A transaction signed for one network is not fixed by submitting it to another Gateway URL.

Done when: preview, compile, submit, and poll code paths are traced to the same network ID and Gateway URL, and wrong-network errors are diagnosed as configuration problems rather than retryable Gateway failures.

### Handle CLI network selection and artifacts

Use this when changing `rdx` network flags, config files, artifact metadata, or transaction preparation.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/schemas.ts`
- `./.repos/radix-web3.js/packages/cli/src/config.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`
- `./.repos/radix-web3.js/packages/cli/src/accountReads.ts`
- `./.repos/radix-web3.js/packages/cli/src/submit.ts`
- `./references/cli-command-reference.md`

Pattern:

```ts
const networkId = (network: Network) =>
  network === "mainnet" ? 1 : 2

const gatewayBaseUrl = (network: Network) =>
  network === "stokenet"
    ? "https://stokenet.radixdlt.com"
    : "https://mainnet.radixdlt.com"
```

Rule: CLI network support is deliberately narrower than core network constants: `NetworkSchema` accepts `mainnet` and `stokenet`. Keep prepared artifacts, signing requests, status calls, and derived account output tied to that selected network.

Done when: CLI tests cover config defaults, network override, artifact network fields, and Gateway URL override behavior.

### Debug wrong-network wallet or ROLA failures

Use this when wallet proof verification, dApp definition lookup, account proof checks, or ROLA verification fails with apparently valid signatures.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/rola.ts`
- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radix-web3.js/packages/core/src/account/index.ts`
- `./.repos/radix-web3.js/packages/core/src/persona/index.ts`
- `./references/guide-wallet-rola.md`

Pattern:

```ts
const { verifySignedChallenge } = RolaSdk({
  networkId: gatewayApiClient.networkId,
  dAppDefinitionAddress,
  expectedOrigin,
  gatewayApiClient: gatewayApiClient.rawClient,
})
```

Rule: ROLA verification binds challenge, proof address, dApp definition address, Gateway lookup, and network ID. Treat a network mismatch as a security failure, not a fallback opportunity.

Done when: the failing proof is checked against wallet network, Gateway network ID, dApp definition address HRP, and account or persona address HRP before changing signature or session code.

## Reference Routes

- Core client network selection: use `./references/guide-core.md` with `network/getRadixGatewayBaseUrl.ts` and `network/index.ts`.
- Toolkit address derivation and known addresses: use `./references/guide-radix-engine-toolkit.md`.
- Gateway service configuration: use `./references/guide-gateway.md` for `NETWORK_ID`, `GATEWAY_URL`, and Gateway SDK behavior.
- CLI network flags and config: use `./references/guide-cli.md` and `./references/cli-command-reference.md`.
- Wallet proof flows: use `./references/guide-wallet-rola.md` when network mismatches involve ROLA, dApp definition addresses, account proofs, or persona proofs.
- Transaction headers and V1/V2 model placement: use `./references/guide-transactions.md` and `./references/guide-subintents.md`.

Routing check: use this guide for cross-cutting network/address alignment; route package-local API changes to the owning package guide after identifying the network boundary.

## Usage Notes

- Treat network ID, Gateway URL, address HRP, transaction ID HRP, and dApp definition address as one configuration set.
- Do not assume branded string schemas validate Bech32 HRP or entity type.
- Check V1 and V2 transaction header placement before moving network ID fields.
- Prefer `knownAddresses(networkId)` over hardcoded native addresses unless a guide or test is explicitly network-specific.
- For wrong-network bugs, prove which value is wrong before adding retries or fallback Gateway URLs.
