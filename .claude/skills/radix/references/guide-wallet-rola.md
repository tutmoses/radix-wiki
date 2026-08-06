# Wallet And ROLA Guide

## Source Paths

Wallet/connect source paths:

- `./.repos/radix-web3.js/packages/connect/src`
- `./.repos/radix-web3.js/packages/connect/src/rola`
- `./.repos/radix-web3.js/packages/connect/src/transports`
- `./.repos/radix-web3.js/packages/connect/src/crypto`

Gateway ROLA paths:

- `./.repos/radix-web3.js/packages/gateway/src/rola.ts`
- `./.repos/radix-web3.js/packages/gateway/src/schemas.ts`

Rust/account reference paths:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/account`
- `./.repos/radix-web3.js/packages/core/src/account/index.ts`
- `./.repos/radix-web3.js/packages/core/src/persona/index.ts`
- `./.repos/radix-web3.js/packages/cli/src/accountReads.ts`

Search wider derivation call sites with:

```sh
rg "derive.*(account|persona)|virtual" ./.repos/radix-web3.js/packages
```

## Mental Model

Wallet connection and ROLA are related but separate:

- Wallet connection asks Radix Wallet for shared accounts, personas, proofs, signatures, or transactions.
- ROLA verifies that an account/persona proof was signed by a key that controls the claimed address.
- Application sessions and authorization happen after ROLA succeeds.

ROLA verification has two input layers:

- Connect wallet proof responses use wallet-facing field names such as `accountAddress` and `identityAddress`.
- Gateway ROLA verification expects normalized proofs with `{ address, type: "account" | "persona", challenge, proof }`.
- Account `owner_keys` metadata is authoritative; the account blueprint explicitly sets it on virtual accounts so deletion removes owner-key authority.
- Persona/identity ownership semantics should be verified against the ROLA SDK or source before implementing a local fallback.

## Examples

Use these examples to keep wallet interaction, proof construction, and server-side verification separate.

### Implement server-side account proof verification

Use this when a backend receives signed challenges and must verify account ownership.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/rola/createRolaMessage.ts`
- `./.repos/radix-web3.js/packages/connect/src/rola/testVectors.ts`
- `./.repos/radix-web3.js/packages/gateway/src/rola.ts`
- `./.repos/radix-web3.js/packages/gateway/src/schemas.ts`

Pattern: generate and store the challenge in the application, request a wallet proof, then delegate cryptographic and ledger verification to ROLA before creating any session.

Flow skeleton:

```ts
// Pseudocode only; adapt to actual exports in the target repo.
const challenge = createRandomHexChallenge()
const walletProof = await requestAccountProofFromWallet(challenge)
await verifyRolaProof({
  expectedOrigin,
  dAppDefinitionAddress,
  proof: walletProof
})
```

Verification rule: check challenge freshness and single-use behavior in the application, then use ROLA for cryptographic and ledger ownership checks.

Rule: current Gateway verification delegates to `@radixdlt/rola` through `RolaSdk({ networkId, applicationName, dAppDefinitionAddress, expectedOrigin, gatewayApiClient: rawClient })`. Do not reimplement signature, owner-key, or virtual-address verification in `packages/gateway/src/rola.ts` unless replacing the SDK is explicitly the task.

Rule: `createRolaMessage.ts` consumes the challenge as hex via `fromHex(challenge)`, and the test vectors use hex strings. Generate random challenge bytes and encode them as hex before sending the wallet request.

Done when: proof verification rejects stale, reused, wrong-origin, wrong-dApp, wrong-network, and wrong-address proofs before creating an application session.

### Debug expected origin or dApp definition mismatch

Use this when signatures verify locally but ROLA still rejects the proof.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/rola/createRolaMessage.ts`
- `./.repos/radix-web3.js/packages/connect/src/rola/createRolaMessage.spec.ts`
- `./.repos/radix-web3.js/packages/connect/src/rola/testVectors.ts`
- `./.repos/radix-web3.js/packages/connect/src/transports/radix-connect-relay/RadixConnectRelayTransport.ts`
- `./.repos/radix-web3.js/packages/gateway/src/rola.ts`

Pattern: the signed message binds challenge, dApp definition address, and origin. Treat mismatches as security failures, not recoverable formatting issues.

Done when: logs or errors identify which bound field mismatched without accepting alternate origins, inferred dApp definitions, or regenerated challenges.

### Normalize proof shape and handle `owner_keys` metadata

Use this when account proofs fail for securified accounts, rotated keys, or new virtual accounts.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/rola.ts`
- `./.repos/radix-web3.js/packages/gateway/package.json`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/account/invocations.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/account/blueprint.rs`
- `./.repos/radix-web3.js/packages/core/src/account/index.ts`
- `./.repos/radix-web3.js/packages/core/src/persona/index.ts`
- `./.repos/radix-web3.js/packages/cli/src/accountReads.ts`

Pattern: normalize wallet proof shape before calling Gateway ROLA.

```ts
const normalizeAccountProof = (challenge: string, item: AccountProof) => ({
  address: item.accountAddress,
  type: "account" as const,
  challenge,
  proof: item.proof
})

const normalizePersonaProof = (challenge: string, item: PersonaProof) => ({
  address: item.identityAddress,
  type: "persona" as const,
  challenge,
  proof: item.proof
})
```

Rule: for accounts, absent `owner_keys` metadata is not an implicit virtual-account fallback. The account blueprint sets `owner_keys` explicitly on virtual accounts so users can remove owner-key authority by deleting metadata. If replacing `@radixdlt/rola`, write tests for both present and deleted `owner_keys`.

Rule: `packages/gateway/src/rola.ts` does not implement the owner-key lookup or virtual-address fallback directly; it delegates to `@radixdlt/rola`. Use local account/persona derivation files only when debugging the expected fallback semantics or replacing the SDK.

Done when: normalization tests cover account and persona proof inputs, and account owner-key tests include both present and deleted `owner_keys` metadata behavior.

### Verify a persona proof

Use this when login or identity proofing uses personas instead of accounts.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/schemas/walletInteraction.ts`
- `./.repos/radix-web3.js/packages/connect/src/rola/createRolaMessage.ts`
- `./.repos/radix-web3.js/packages/gateway/src/rola.ts`
- `./.repos/radix-web3.js/packages/core/src/persona/index.ts`
- `./references/guide-connect.md`

Pattern: build the same ROLA message body as account proofs, but verify the proof address as a persona/identity address. Normalize wallet `identityAddress` to Gateway ROLA `{ address, type: "persona" }` before verification.

Rule: do not reuse account-address derivation for personas. Account and identity derivation use different helpers even when the public key and network are the same.

Done when: persona proof verification uses `identityAddress`/`type: "persona"` through the ROLA path and fails if account derivation is accidentally substituted.

### Add wallet data request behavior

Use this when a dApp asks for shared accounts, personas, persona data, proofs, or transaction signing.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/client.ts`
- `./.repos/radix-web3.js/packages/connect/src/types.ts`
- `./.repos/radix-web3.js/packages/connect/src/schemas/walletInteraction.ts`

Pattern: keep wallet interaction schema changes explicit and validated. Do not encode backend session semantics into wallet request types.

For transport, schema, or encrypted relay behavior, switch to `./references/guide-connect.md`.

Done when: wallet data request changes stay limited to wallet interaction shape and do not mix in backend session authorization or ledger proof verification.

### Debug transport or encryption behavior

Use this when a request works in one wallet environment but fails over relay, extension, encryption, or sealbox code.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/transports/radix-connect-relay/index.ts`
- `./.repos/radix-web3.js/packages/connect/src/transports/index.ts`
- `./.repos/radix-web3.js/packages/connect/src/crypto/encryption.ts`
- `./.repos/radix-web3.js/packages/connect/src/crypto/sealbox.ts`
- `./.repos/radix-web3.js/packages/connect/src/crypto/ed25519.ts`
- `./.repos/radix-web3.js/packages/connect/src/crypto/blake2b.ts`

Pattern: diagnose transport framing and encryption separately from ROLA. A transport failure should not change signature-message construction.

Done when: the failure is classified as transport, encryption, schema, ROLA message, SDK verification, or application session handling.

## Reference Routes

- Verify persona proofs: inspect ROLA message code, proof schemas, and TypeScript derivation call sites.
- Generate or validate ROLA challenges: inspect `createRolaMessage.ts`, challenge test vectors, and backend challenge storage code in the target app.
- Send wallet transaction requests: inspect connect client transaction request types and tx-tool transaction lifecycle if the app also submits server-side.
- Add wallet interaction schema fields: inspect `packages/connect/src/schemas/walletInteraction.ts` and tests.
- Integrate authenticated sessions after ROLA: keep session creation in the application layer and use ROLA only as proof verification.

Routing check: adjacent routing sends Connect transport work to `guide-connect.md`, account metadata work to `guide-account.md`, and transaction submission work to `guide-transactions.md`.

## Usage Notes

- Challenges must be random, short-lived, single-use, and bound to expected origin and dApp definition address.
- Verify account and persona proofs against the correct Radix network.
- Do not treat a successful ROLA proof as authorization to perform every action.
- For transport bugs, inspect `connect/src/transports` before changing ROLA code.
