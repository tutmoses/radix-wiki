# Connect Guide

## Source Paths

Primary source root: `./.repos/radix-web3.js/packages/connect/src`

Key paths:

- `index.ts`
- `client.ts`
- `types.ts`
- `schemas/walletInteraction.ts`
- `transports/radix-connect-relay/RadixConnectRelayTransport.ts`
- `transports/radix-connect-relay/apiClient.ts`
- `transports/radix-connect-relay/helpers`
- `crypto/`
- `rola/createRolaMessage.ts`
- `rola/testVectors.ts`

## Mental Model

`radix-connect` is the wallet interaction boundary. It defines request/response schemas, sends wallet interactions through a transport, and implements the Radix Connect Relay transport with request signing, deep links, polling, and encrypted response handling.

Keep these concerns separate:

- `client.ts` delegates wallet requests to a transport.
- `schemas/walletInteraction.ts` owns request and response shape.
- `transports/radix-connect-relay` owns relay framing, deep links, polling, signatures, and decryption.
- `crypto` owns keypairs, hashes, sealbox, and encryption primitives.
- `rola` owns the signed ROLA message body, not server-side proof verification.

## Examples

Use these examples when adding wallet request behavior or debugging wallet transport issues.

### Send a wallet data request

Use this when an app or tool needs shared accounts, one-time accounts, persona data, or login.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/client.ts`
- `./.repos/radix-web3.js/packages/connect/src/types.ts`
- `./.repos/radix-web3.js/packages/connect/src/schemas/walletInteraction.ts`
- `./.repos/radix-web3.js/packages/agent-toolkit/src/plugins/core/tools/getAccount.ts`

Pattern:

```ts
const response = await client.sendRequest({
  interactionId: crypto.randomUUID(),
  metadata,
  items: {
    discriminator: "unauthorizedRequest",
    oneTimeAccounts: {
      numberOfAccounts: { quantifier: "exactly", quantity: 1 }
    }
  }
})
```

Rule: keep app session semantics outside wallet interaction schemas. The wallet request should only describe what the wallet is being asked to provide.

Done when: request and response schemas round-trip the requested wallet data and application session creation remains outside `packages/connect`.

### Add a new wallet interaction schema field

Use this when Radix Wallet supports a new request item or response field.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/schemas/walletInteraction.ts`
- `./.repos/radix-web3.js/packages/connect/src/transports/radix-connect-relay/RadixConnectRelayTransport.spec.ts`
- `./.repos/radix-web3.js/packages/connect/src/transports/radix-connect-relay/helpers/createMessageHash.spec.ts`
- `./.repos/radix-web3.js/packages/connect/src/rola/createRolaMessage.spec.ts`
- `./.repos/radix-web3.js/packages/agent-toolkit/src/plugins/core/tools/sendTransaction.ts`
- `./.repos/radix-web3.js/packages/agent-toolkit/src/plugins/core/tools/sendXrd.ts`

Pattern: add Zod schemas first, derive TypeScript types from schemas, then update callers. Keep discriminated unions explicit so agents can see which request family is being changed.

Rule: there may not be a dedicated schema test beside `walletInteraction.ts`. Use relay, message-hash, and ROLA message tests as the current examples for request/response round trips and failure assertions.

Done when: the new field exists in Zod schema, inferred type, request construction, response handling, and at least one caller or transport test.

### Add a wallet subintent request or response field

Use this when Radix Wallet supports new partial-transaction, subintent, or pre-authorization behavior.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/schemas/walletInteraction.ts`
- `./.repos/radix-web3.js/packages/connect/src/client.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintent.ts`
- `./references/guide-transaction-manifest.md`

Pattern: update `SubintentRequestItem` and the matching response schema together, then add a request-construction example in the caller package. Keep V2 manifest and subintent semantics in transaction tooling; Connect should only describe the wallet interaction payload.

Done when: Connect validates the wallet payload shape and tx-tool or CLI tests own the V2 manifest/subintent execution semantics.

### Send a transaction request through the wallet

Use this when the wallet, not the server, should sign or submit an RTM manifest.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/schemas/walletInteraction.ts`
- `./.repos/radix-web3.js/packages/agent-toolkit/src/plugins/core/tools/sendTransaction.ts`
- `./.repos/radix-web3.js/packages/core/src/manifests/sendResourceManifest.ts`
- `./references/guide-transaction-manifest.md`

Pattern:

```ts
await client.sendRequest({
  interactionId: crypto.randomUUID(),
  metadata,
  items: {
    discriminator: "transaction",
    send: {
      version: 1,
      transactionManifest
    }
  }
})
```

Rule: validate and build RTM before sending the wallet request. Connect should not become a manifest builder. Wallet callers can validate at the caller boundary or route the manifest through tx-tool static validation (`packages/tx-tool/src/staticallyValidateManifest.ts`) before constructing the interaction payload.

Rule: wallet transaction success returns `send.transactionIntentHash`. Do not expect Connect to return Gateway submission details, committed receipt data, or polling status; route those through Gateway/tx-tool if the application submits or observes transactions server-side.

Rule: handle the response discriminator before reading `items`. `WalletInteractionSuccessResponse` has `{ discriminator: "success", interactionId, items }`; a transaction success has `items.discriminator === "transaction"` and `items.send.transactionIntentHash`. `WalletInteractionFailureResponse` has `{ discriminator: "failure", interactionId, error, message? }` and no `items`.

Done when: callers branch on success/failure first, then on `items.discriminator`, and tests cover wallet failure, transaction success, and malformed or mismatched interaction IDs.

### Debug relay deep link generation

Use this when QR codes or deep links open the wallet but the wallet cannot read or trust the request.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/transports/radix-connect-relay/RadixConnectRelayTransport.ts`
- `./.repos/radix-web3.js/packages/connect/src/transports/radix-connect-relay/helpers/base64url.ts`
- `./.repos/radix-web3.js/packages/connect/src/transports/radix-connect-relay/helpers/produceSignature.ts`
- `./.repos/radix-web3.js/packages/connect/src/transports/radix-connect-relay/helpers/createMessageHash.ts`

Pattern: inspect the body sent to `handleRequest`, then inspect the generated deep link query params. The signature binds interaction ID, origin, and dApp definition address.

Done when: a failing deep link is traced to request body, signature, base64url encoding, origin, dApp definition, or relay response, not left as a generic wallet failure.

### Debug encrypted wallet responses

Use this when the relay receives a response but decrypting or matching it fails.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/transports/radix-connect-relay/RadixConnectRelayTransport.ts`
- `./.repos/radix-web3.js/packages/connect/src/transports/radix-connect-relay/helpers/decryptPayload.ts`
- `./.repos/radix-web3.js/packages/connect/src/crypto/encryption.ts`
- `./.repos/radix-web3.js/packages/connect/src/crypto/sealbox.ts`
- `./.repos/radix-web3.js/packages/connect/src/crypto/encryption.spec.ts`

Pattern: verify relay response shape first, then public key and salt, then decrypted interaction ID. A mismatched `interactionId` is a hard failure.

Failure tree:

1. Relay returned an error response instead of an encrypted payload.
2. Relay payload has malformed base64url, nonce, sealbox, or hex-like fields.
3. Response public key is not the key expected for this interaction.
4. dApp definition salt or session key differs from the request.
5. Shared-secret or AES-GCM authentication fails.
6. Decrypted JSON cannot be parsed.
7. Decrypted `interactionId` does not equal the pending request ID.

Testing pattern: build one successful encrypted response fixture, then add negative tests for wrong salt or public key and mismatched `interactionId`.

Rule: current `decryptPayload.ts` parses decrypted JSON and returns a typed value, but it does not run the wallet response Zod schema. Current `fromHex.ts` also does not validate malformed hex before converting pairs. If stricter validation is required, add it explicitly and test it at the helper boundary.

Done when: decrypted responses are parsed through `WalletInteractionResponse` or an equivalent caller-level schema before business logic branches on success/failure. The relay layer can prove transport integrity; the caller still owns schema validation and user-facing handling of wallet failure responses.

### Build or verify ROLA message construction

Use this when wallet proofs need to be signed or verified against the exact ROLA message body.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/rola/createRolaMessage.ts`
- `./.repos/radix-web3.js/packages/connect/src/rola/createRolaMessage.spec.ts`
- `./.repos/radix-web3.js/packages/connect/src/rola/testVectors.ts`
- `./.repos/radix-web3.js/packages/gateway/src/rola.ts`
- `./references/guide-wallet-rola.md`

Pattern: use connect for message construction and test vectors; use gateway for server-side ledger verification. Do not combine challenge storage, session creation, and ROLA verification in this package.

Done when: message construction matches test vectors, challenges are hex-encoded random bytes, and server-side proof verification stays in Gateway or application code.

### Add or debug crypto helper behavior

Use this when wallet transport code touches Ed25519 keys, mnemonic conversion, random bytes, hex, base64url, sealbox, or AES-GCM encryption.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/crypto/ed25519.ts`
- `./.repos/radix-web3.js/packages/connect/src/crypto/mnemonicToPrivateKey.ts`
- `./.repos/radix-web3.js/packages/connect/src/crypto/secureRandom.ts`
- `./.repos/radix-web3.js/packages/connect/src/crypto/helpers/toHex.ts`
- `./.repos/radix-web3.js/packages/connect/src/crypto/helpers/fromHex.ts`
- `./.repos/radix-web3.js/packages/connect/src/transports/radix-connect-relay/helpers/base64url.ts`
- `./.repos/radix-web3.js/packages/connect/src/crypto/encryption.spec.ts`

Pattern: test encode/decode helpers with round trips and malformed input. For transport failures, assert the exact failing layer: key derivation, encoding, signature hash, sealbox, AES-GCM, or wallet response schema.

Done when: crypto helper tests include a valid round trip plus malformed input for the layer being changed, and transport tests prove errors are surfaced at the expected boundary.

## Reference Routes

- Transport interface changes: inspect `types.ts`, `client.ts`, and transport implementations together.
- Request timeout behavior: inspect `RadixConnectRelayTransport.ts` abort controller and polling loop.
- Ed25519 or X25519 key handling: inspect `crypto/ed25519.ts`, `crypto/mnemonicToPrivateKey.ts`, and relay transport key use.
- Relay API failures: inspect `apiClient.ts` and the transport's polling loop.
- Wallet proof schemas: inspect `AccountProof`, `PersonaProof`, and proof response schemas in `walletInteraction.ts`.

Routing check: adjacent routing keeps wallet transport changes in Connect and sends ledger proof verification to `guide-wallet-rola.md`.

## Usage Notes

- Keep transport failures separate from ROLA verification failures.
- Keep request/response schema changes explicit and tested at the schema boundary.
- Do not add Gateway calls to `connect`; put server-side proof verification in `gateway` or the application.
- Preserve interaction ID matching, request signing, and response decryption checks when refactoring transport code.
