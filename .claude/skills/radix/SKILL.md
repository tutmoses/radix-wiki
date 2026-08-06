---
name: radix
description: Radix expertise for AI agents working with local radix-web3.js and radixdlt-scrypto checkouts. Use when building or debugging Radix dApps, Effect packages, Gateway/wallet/ROLA flows, transaction manifests, signing/submission, receipts/events, costing/fees, royalties, accounts, resources, metadata, pools, packages/components, subintents, role assignment, access rules/controllers, SBOR, Scrypto, Radix CLIs, dependencies, and TypeScript tooling.
---

# Radix

## Overview

Use this skill to build or debug Radix code from local source checkouts rather than memory or web snippets. Prefer the bundled guides first, then inspect the cloned repos for exact APIs, tests, and implementation details.

## Prerequisite

Before doing Radix-specific work, check that these source checkouts exist at the root of the repository where the skill is being used:

- `./.repos/radix-web3.js`
- `./.repos/radixdlt-scrypto`

If either checkout is missing, read `./references/setup.md` before continuing. Run this skill's `scripts/prepare-radix-sources.sh` with the target repository root as the current working directory when local clone setup is appropriate.

## Research Strategy

1. Load the relevant guide in `./references/guide-*.md`.
2. Inspect similar code in the user's current repository.
3. Optionally use `https://github.com/xstelea/radix-context/tree/main/context` or a local `radix-context/context` checkout as a candidate map for topics and vocabulary.
4. Verify every context-derived fact against source paths listed in the guide under `./.repos/radix-web3.js` or `./.repos/radixdlt-scrypto` before using it in code or adding it to skill guidance.
5. Use public web docs only when local source does not answer the question or the user asks for current external documentation.

Do not import code from `./.repos`. Treat cloned repos as read-only reference material.

## Guide Selection

Read the smallest matching set:

- `./references/guide-radix-web3-js.md` for the xstelea/radix-web3.js package layout, package boundaries, and local package APIs.
- `./references/guide-effect-services.md` for Effect service shape, Context.Service classes, layer wiring, config, retries, typed errors, Schema decoding, test layers, and stream state across Radix packages.
- `./references/guide-configuration.md` for runtime configuration, Effect Config env vars, CLI config files, Gateway/ROLA alignment, tx-tool signer and polling config, transaction-stream checkpoints, x402 server/Worker config, and secret boundaries.
- `./references/guide-dependencies-supply-chain.md` for pnpm catalogs, workspace dependency ownership, lockfile handling, overrides, allowBuilds, release-age exceptions, Node/pnpm runtime policy, and dependency supply-chain hygiene.
- `./references/guide-typescript-tooling.md` for tsconfig variants, oxlint/oxfmt behavior, type-check command claims, tsup/tsdown tooling alignment, path aliases, app TypeScript config, and Vitest type globals.
- `./references/guide-testing.md` for choosing package tests, Effect layer tests, CLI artifact tests, Gateway pagination tests, transaction hash/signature tests, wallet transport tests, Scrypto scenarios, generated RTM, and manifest diagnostics.
- `./references/guide-error-diagnostics.md` for tagged errors, Gateway error mapping, tx-tool polling failures, manifest validation diagnostics, CLI structured errors, x402 payment failures, and Scrypto authorization failures.
- `./references/guide-x402.md` for x402 payment middleware, exact Radix payment requirements, facilitator validation, settlement, and duplicate-settlement cache behavior.
- `./references/guide-core.md` for `packages/core`, public `radix-web3.js` client behavior, keypairs, address derivation, manifest helpers, transaction conversion, network submission, and polling.
- `./references/guide-network-addresses.md` for network IDs, Gateway URL alignment, address HRP/entity validation, known native addresses, virtual account/persona derivation, transaction header network IDs, CLI network selection, and wrong-network debugging.
- `./references/guide-connect.md` for `packages/connect`, wallet interaction schemas, Radix Connect Relay transport, deep links, encrypted responses, and ROLA message construction.
- `./references/guide-cli.md` for `packages/cli`, the `rdx` agent-first CLI, RAP workflow files, artifacts, out-of-band signing, and structured command output. Use `./references/cli-command-reference.md` only when exact install or command syntax is needed.
- `./references/guide-radix-clis.md` for Rust Radix CLI binaries, `scrypto` package build/test/fmt/coverage, `resim` simulator accounts, local ledger workflows, package publishing, blueprint calls, RTM execution, and `rtmc`/`rtmd` manifest binary conversion.
- `./references/guide-tx-tool.md` for `packages/tx-tool`, Effect transaction services, signer injection, transaction lifecycle hooks, V1/V2 intent construction, compilation, submission, and polling.
- `./references/guide-gateway.md` for `packages/gateway`, Gateway API clients, ledger state queries, pagination, batching, and Effect service wrappers.
- `./references/guide-staking-validators.md` for staking, validators, consensus manager behavior, validator metadata, liquid stake units, claim NFTs, unstaking, claiming XRD, owner badge operations, and validator events.
- `./references/guide-transaction-stream.md` for `packages/transaction-stream`, Gateway transaction streaming, state-version checkpointing, opt-ins, and Effect stream behavior.
- `./references/guide-receipts-events.md` for transaction status classification, preview receipts, committed transaction details, fee summaries, transaction stream opt-ins, detailed events, native event payloads, and event decoding.
- `./references/guide-costing-fees.md` for Radix Engine costing, fee reserve behavior, fee locking, contingent fees, fee summaries, fee details, preview fee estimates, royalty fee totals, cost breakdowns, and transaction limits.
- `./references/guide-royalties.md` for package royalties, component royalty modules, royalty amounts, setter/locker/claimer roles, royalty manifests, royalty claims, accumulators, and generated royalty scenarios.
- `./references/guide-transaction-manifest.md` for RTM syntax, manifest instructions, worktop/proof instructions, manifest values, V1/V2 resource assertions, address allocation, and subintent manifests.
- `./references/guide-resources-vaults.md` for resource managers, fungible and non-fungible resources, buckets, vaults, proofs, worktop assertions, Gateway balance reads, and SBOR resource values.
- `./references/guide-metadata.md` for metadata values, metadata keys, `SET_METADATA`, `REMOVE_METADATA`, `LOCK_METADATA`, metadata roles, metadata events, and metadata validation.
- `./references/guide-pools.md` for native one-, two-, and multi-resource pools, pool units, contribution math, redemption values, protected reserve movement, pool metadata, and pool events.
- `./references/guide-components-packages.md` for Scrypto packages, blueprints, components, package publishing, component instantiation, `CALL_FUNCTION` versus `CALL_METHOD`, address reservations, metadata, role assignment, and Gateway component reads.
- `./references/guide-radix-engine-toolkit.md` for Radix Engine Toolkit call sites, address derivation, known addresses, manifest conversion, validation, static analysis, intent hashes, transaction compilation/decompilation, and toolkit byte/hex boundaries.
- `./references/guide-subintents.md` for Subintents, pre-authorizations, signed partial transactions, child intent trees, CLI subintent artifacts, parent/child yields, and V2 subintent validation.
- `./references/guide-transactions.md` for transaction lifecycle questions: intent construction, signing, previewing, submitting, polling, and V1/V2 transaction model behavior.
- `./references/guide-rust-transactions.md` for the Rust `radix-transactions` crate, `TransactionBuilder`, `NotarizedTransactionV1/V2`, signed partial transactions, raw payload bytes, transaction hashes, signer traits, and `TransactionValidator`.
- `./references/guide-wallet-rola.md` for Radix Wallet, connect flows, account/persona proofs, challenge generation, and ROLA verification.
- `./references/guide-account.md` for native Radix account behavior, deposits, withdrawals, account Gateway reads, fee locking, owner keys, account creation, and authorized depositors.
- `./references/guide-account-lockers.md` for account lockers, pending account claims, direct-send fallback, airdrops, claimant claims, locker recovery, locker roles, and account locker events.
- `./references/guide-access-controllers.md` for native access controllers, primary/recovery/confirmation roles, account securified proofs, recovery proposals, timed recovery, badge-withdraw attempts, recovery badges, recovery fees, and access-controller events.
- `./references/guide-sbor.md` for `packages/sbor`, SBOR, Manifest/Scrypto value encoding, schema-driven decoding, and programmatic SBOR helpers.
- `./references/guide-shared.md` for `packages/shared`, Effect schemas, branded Radix primitive types, account/proof schemas, and BigNumber normalization.
- `./references/guide-role-assignment.md` for owner role mutation, role update manifests, module-specific roles, role-assignment events, and role-assignment validation.
- `./references/guide-access-rules.md` for access rules, composite requirements, roles, owner role, auth-zone proof requirements, Scrypto auth macros, role assignment manifests, and authorization failures.
- `./references/guide-scrypto.md` for Scrypto, Radix Engine, account primitives, access rules, native blueprints, and Rust source lookup.

## Radix Principles

- Validate external Gateway, wallet, and manifest inputs at boundaries.
- Keep network IDs explicit. Do not mix mainnet and stokenet addresses, gateway URLs, or dApp definition addresses.
- Prefer existing package APIs and tests in `radix-web3.js` before inventing new wrappers.
- Use Effect services and layers when working inside packages that already use Effect.
- For transaction work, inspect both manifest construction and transaction lifecycle code. Many bugs live in the boundary between manifest strings, static analysis, signing, and Gateway submission.
- For Radix Engine Toolkit work, treat Toolkit calls as offline protocol boundaries; verify network IDs and V1/V2 model shape before using outputs.
- For subintent work, verify the V2 partial transaction model, signed partial transaction hash, parent/child yield counts, and root transaction assembly separately.
- For wallet authentication, keep ROLA separate from session management and authorization. ROLA verifies identity proof ownership; the application owns sessions and permissions.
- For account work, distinguish account blueprint semantics from Gateway account reads and wallet account sharing.
- For Scrypto and SBOR questions, inspect `radixdlt-scrypto` source for wire formats, type derivations, native blueprints, and manifest semantics.

## Source Paths

Default local source roots:

- `./.repos/radix-web3.js`
- `./.repos/radixdlt-scrypto`

If a user's repository already vendors or clones these repos elsewhere, prefer that existing location and keep the same read-only rule.

## Answering Questions

When answering without code changes:

- Cite the guide and source path used.
- Include the concrete file path an agent should inspect next.
- Distinguish verified source facts from inferences.

When implementing code, follow local project conventions first, then use the Radix source guides to resolve API shape and behavior.

When editing this skill itself, run `./scripts/validate-radix-skill.py` from the skill root before reporting completion.
