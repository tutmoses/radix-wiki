# CLI Guide

## Source Paths

Primary source root: `./.repos/radix-web3.js/packages/cli`

Key paths:

- `src/index.ts`
- `src/cli.ts`
- `src/json.ts`
- `src/schemas.ts`
- `src/prepare.ts`
- `src/signingRequests.ts`
- `src/signatureImport.ts`
- `src/addSignatures.ts`
- `src/notarize.ts`
- `src/submit.ts`
- `src/status.ts`
- `src/artifacts.ts`
- `src/subintent.ts`
- `src/subintentAssembly.ts`
- `src/templates.ts`
- `src/llm.ts`
- `src/accountReads.ts`
- `src/config.ts`
- `src/gatewayHttp.ts`
- `src/platformIo.ts`
- `src/bin/rdx.ts`
- `Radix Agent Protocol (RAP) V1.md`

## Mental Model

`packages/cli` implements the `rdx` Agent-first CLI Wallet. It is a local-key transaction workflow tool for agents and scripts, not a browser or consumer wallet.

The core model is a file-backed transaction state machine:

1. read explicit config, manifest, notary, signer, subintent, or header files
2. prepare transaction artifacts and signing request files
3. import out-of-band signatures
4. notarize after intent signatures are present
5. submit a notarized transaction
6. query network status and update local artifacts

Every command should preserve agent-first interface expectations: structured JSON output by default, stable file schemas, explicit network selection, non-interactive execution, and machine-readable errors.

## Command Syntax

For exact install commands and `rdx` command examples, read `./references/cli-command-reference.md`. Keep this guide focused on implementation paths, workflow invariants, and tests.

## Examples

Use these examples to keep CLI changes aligned with the RAP state machine and file-backed workflow.

### Add a new `rdx` command

Use this when the request is about command routing, flags, output rendering, or CLI help.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/index.ts`
- `./.repos/radix-web3.js/packages/cli/src/cli.ts`
- `./.repos/radix-web3.js/packages/cli/src/bin/rdx.ts`
- `./.repos/radix-web3.js/packages/cli/src/cli.test.ts`

Pattern:

1. Add parsing and command routing through `index.ts` and the Effect CLI command definition in `cli.ts`.
2. Keep rendering in a named `render*` helper.
3. Return JSON by default and text only when `--format text` is explicit.
4. Add a CLI test that asserts stdout shape, not just that the command exits.

Rule: `runRdxEffect` and `parseRdxCommand` live in `index.ts`; `cli.ts` owns command definitions and render helpers. Read both before adding flags.

Done when: the command has parser coverage, JSON output if applicable, human output if applicable, and at least one failing-input case that proves validation happens before writing artifacts.

### Prepare a root transaction from an RTM manifest

Use this when an agent needs a prepared transaction, signing requests, and artifact files before any private key is available.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`
- `./.repos/radix-web3.js/packages/cli/src/signingRequests.ts`
- `./.repos/radix-web3.js/packages/cli/src/artifacts.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.test.ts`

Pattern:

```json
{
  "type": "preparedTransaction",
  "version": 1,
  "transactionId": "..."
}
```

Keep the workflow file typed and versioned. The prepared transaction is the source for later signing, notarization, submission, and status commands.

Rule: `--notary-file` is optional when resolved config supplies `notary`. If both are missing, `tx prepare` should fail before writing an unusable transaction workflow.

Done when: prepare writes the expected transaction directory, signing request, signature template, and `prepared.json`, and tests cover both explicit `--notary-file` and config-provided notary paths.

### Import and merge out-of-band signatures

Use this when an agent receives signatures from another process and must attach them to a prepared transaction without taking key custody.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/signatureImport.ts`
- `./.repos/radix-web3.js/packages/cli/src/addSignatures.ts`
- `./.repos/radix-web3.js/packages/cli/src/artifacts.ts`
- `./.repos/radix-web3.js/packages/cli/src/addSignatures.test.ts`

Pattern: validate `SignatureFileSchema`, reject placeholders, verify Ed25519 signatures against `hash.hex` and `publicKey.hex`, normalize duplicate signatures through `normalizeSignatures`, and report accepted count plus warnings.

Done when: import rejects malformed, placeholder, wrong-hash, and duplicate signatures predictably, while preserving accepted signatures and warning output in `prepared.json`.

### Notarize and submit a prepared transaction

Use this when the workflow has all required intent signatures and needs a notary signature, compiled notarized transaction, and Gateway submission.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/notarize.ts`
- `./.repos/radix-web3.js/packages/cli/src/submit.ts`
- `./.repos/radix-web3.js/packages/cli/src/gatewayHttp.ts`
- `./.repos/radix-web3.js/packages/cli/src/notarize.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/submit.test.ts`

Pattern:

1. Read `prepared.json`.
2. Check all required signing requests have matching imported signatures.
3. Write `notarizedTransaction.hex`.
4. Submit through Gateway.
5. Persist `submitResult.json`.

Rule: local artifact status is file-derived. Once `submitResult.json` exists, `tx list --status submitted` will treat the artifact as submitted even if the network status is later rejected or failed. Use network status fields for ledger outcome, not local artifact status.

Rule: signature cryptographic verification happens during signature import. Notarize and submit check signature presence/completeness and build later artifacts from already imported signatures.

Done when: notarize creates the notary request/template artifacts, updates `prepared.json`, and submit refuses to run unless the notarized transaction artifact exists.

### Run the full prepared-transaction workflow end to end

Use this when an agent must go from `root.rtm` plus `notary.json` to a submitted transaction without key custody.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`
- `./.repos/radix-web3.js/packages/cli/src/signingRequests.ts`
- `./.repos/radix-web3.js/packages/cli/src/addSignatures.ts`
- `./.repos/radix-web3.js/packages/cli/src/notarize.ts`
- `./.repos/radix-web3.js/packages/cli/src/submit.ts`
- `./.repos/radix-web3.js/packages/cli/src/status.ts`
- `./.repos/radix-web3.js/packages/cli/src/artifacts.ts`

Pattern: drive the workflow one artifact transition at a time, and prove each command consumes the previous command's JSON output or artifact path.

Command flow:

```sh
rdx tx prepare --manifest ./tx/root.rtm --notary-file ./tx/notary.json
rdx tx add-signatures <transactionId> --file ./tx/intent-signature.json
rdx tx notarize <transactionId>
rdx tx add-signatures <transactionId> --file ./tx/notary-signature.json
rdx tx submit <transactionId>
rdx tx status <transactionId> --read-only
```

Verification rule: assert the artifact directory contains `prepared.json`, signing request/template files, `notarizedTransaction.hex`, and `submitResult.json` at the expected phases. Use `--read-only` for final status checks when the workflow should not mutate artifacts.

Rule: `rdx tx notarize` rewrites `prepared.json` to append notary signing request and signature template paths. Tests should assert both the new files and the prepared metadata update.

Done when: an end-to-end test or manual run proves every workflow step can consume the previous step's artifact path without relying on current working directory accidents.

### Build a subintent workflow

Use this when partial transactions, pre-authorizations, or multi-party workflows require a signed subintent rather than a fully submitted root transaction.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/subintent.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintentAssembly.ts`
- `./.repos/radix-web3.js/packages/cli/src/schemas.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintent.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/subintentAssembly.test.ts`

Pattern: keep subintent IDs conservative, write typed subintent artifacts, then assemble a root manifest that explicitly yields to children.

Rule: `subintentAssembly.ts` accepts subintent IDs matching `[A-Za-z][A-Za-z0-9_-]{0,63}` and rejects missing or unreferenced children. When preparing a subintent preview root, the root manifest must contain exactly one `<subintentHash>` placeholder unless preview is intentionally skipped.

Rule: prepared subintent artifacts are written as `prepared-subintent.json`; do not use root transaction `prepared.json` path conventions for `rdx subintent build`.

Done when: the root preview, signed partial import, subintent build, and final assembly artifacts each use their own expected filenames and invalid child references fail before submission.

### Add account read commands

Use this when the CLI should query balances, NFTs, account details, history, or virtual account derivation without changing transaction artifacts.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/accountReads.ts`
- `./.repos/radix-web3.js/packages/cli/src/gatewayHttp.ts`
- `./.repos/radix-web3.js/packages/cli/src/accountReads.test.ts`

Pattern: return Gateway-shaped command results with JSON-safe normalization. Do not invent a portfolio abstraction unless the product language asks for one.

Done when: the command output can be traced back to Gateway fields, and tests cover empty balances, missing entities, and JSON rendering.

### Extend transaction history filters

Use this when a task asks for richer account transaction history, such as state-version bounds, order, kind, events, or resource filters.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/cli.ts`
- `./.repos/radix-web3.js/packages/cli/src/accountReads.ts`
- `./.repos/radix-web3.js/packages/cli/src/gatewayHttp.ts`
- `./.repos/radix-web3.js/packages/cli/src/accountReads.test.ts`

Pattern:

```sh
rdx tx history account_rdx1... --limit 20
rdx tx history account_rdx1... --from-state-version 100000 --order asc --kind User
rdx tx history account_rdx1... --with-events --resource resource_rdx1...
```

Rule: extend the existing `rdx tx history <accountAddress>` path instead of adding a parallel history command. Map flags to the Gateway stream/history request in `accountReads.ts`, keep output Gateway-shaped, and copy filter flag conventions from `rdx tx list` where they already exist.

Done when: every new filter appears in parser help, request construction, JSON output tests, and at least one negative validation case.

### Resolve config and artifact paths

Use this when network, artifact root, config overrides, or project-local config behavior changes.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/config.ts`
- `./.repos/radix-web3.js/packages/cli/src/platformIo.ts`
- `./.repos/radix-web3.js/packages/cli/src/artifacts.ts`
- `./.repos/radix-web3.js/packages/cli/src/config.test.ts`

Pattern: resolved config is layered from defaults, global config, nearest project `.rdxconfig.json`, and command overrides. Artifact root depends on the resolved artifact scope and artifact directory. Keep config reads in platform I/O helpers so tests can fake the filesystem.

Done when: tests prove precedence order, artifact scope, relative path resolution, and missing-file diagnostics without reading the developer's real home directory.

### Track local and network transaction status

Use this when changing artifact status, `tx list`, or status refresh behavior.

Start with:

- `./.repos/radix-web3.js/packages/cli/src/status.ts`
- `./.repos/radix-web3.js/packages/cli/src/artifacts.ts`
- `./.repos/radix-web3.js/packages/cli/src/gatewayHttp.ts`
- `./.repos/radix-web3.js/packages/cli/src/status.test.ts`
- `./.repos/radix-web3.js/packages/cli/src/artifacts.test.ts`

Pattern: local artifact status is derived from files such as `prepared.json`, `notarizedTransaction.hex`, and `submitResult.json`. Network status is optional and may be appended by `tx status`, `tx list --with-network-status`, or refreshed by `tx list --update-network-status`.

Rule: `tx status <id>` appends a status attempt to `submitResult.json` unless `--read-only` is used. `tx list --with-network-status` queries Gateway without persisting refreshed status; `tx list --update-network-status` persists refreshed status into each listed artifact.

Done when: local artifact status and network status are rendered as separate fields and tests prove read-only status checks do not mutate artifacts.

## Reference Routes

- Workflow schema changes: inspect `src/schemas.ts`, then update the matching `*.test.ts`.
- Signature templates: inspect `src/templates.ts`, placeholder constants in `src/schemas.ts`, and `src/templates.test.ts`.
- Transaction status: inspect `src/status.ts`, `src/gatewayHttp.ts`, `src/artifacts.ts`, and `src/status.test.ts`.
- Config resolution: inspect `src/config.ts`, `src/platformIo.ts`, and `src/config.test.ts`.
- Artifact lookup/listing: inspect `src/artifacts.ts`, `src/status.ts`, and `src/artifacts.test.ts`.
- Embedded agent guide: inspect `src/llm.ts` and the CLI command that renders it.
- JSON rendering or errors: inspect `src/json.ts`, `src/cli.ts`, and tests that assert stdout.
- RAP semantics: inspect `Radix Agent Protocol (RAP) V1.md`, `packages/cli/CONTEXT.md`, and workflow schema tests.

Routing check: adjacent routing sends exact command syntax to `cli-command-reference.md` and implementation behavior to the smallest CLI source file.

## Usage Notes

- Read `packages/cli/CONTEXT.md` before renaming CLI concepts. Terms like Signing Request, Prepared Transaction File, Signature File, and Artifact Status are domain language.
- Treat workflow JSON schemas as public contracts. Add `type` and `version` fields to new workflow files.
- Keep stdout command results compact and structured. Do not replace JSON defaults with human-first text.
- Keep secrets out of config and artifacts. The CLI coordinates signing but should not silently take key custody.
- Preserve network-bound workflows. Do not reuse stokenet artifacts on mainnet or switch networks after preparation.
- When changing command behavior, add or update the adjacent `*.test.ts` file in `packages/cli/src`.
