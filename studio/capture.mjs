#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  RADIX.WIKI STUDIO — capture a real terminal transcript
//
//    node studio/capture.mjs <recipe> [--keep] [--dry-run]
//    node studio/capture.mjs first-blueprint
//
//  Runs a recipe's commands for real in a throwaway directory and records what
//  they actually printed into studio/transcripts/<recipe>.json. The screencast
//  plays that back verbatim.
//
//  This exists because the section's whole value is being right where the docs
//  are wrong (see scripts/sweep-228-scrypto-cli-pin.mjs). A hand-written
//  terminal pane would put unverified output on camera under the wiki's name.
//
//  The transcript stamps the toolchain that produced it. If those versions
//  drift from what the tutorial page tells readers to install, the transcript
//  is stale — recapture rather than editing the JSON.
// ═══════════════════════════════════════════════════════════════════════════
import { execSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const STUDIO = dirname(fileURLToPath(import.meta.url));
const OUT = join(STUDIO, "transcripts");

// Each step: the command as the reader would type it, run in `cwd` (relative to
// the scratch root). `slow` marks the ones worth a progress line. `hidden` steps
// run but never reach the screen — they exist only to make this machine behave
// like a reader's, and each one carries a `why` recorded in the transcript.
//
// `env` is NOT a workaround: Apple clang ships no wasm32 target, so the `blst`
// C dependency cannot build without pointing cc-rs at a wasm-capable clang.
// Any macOS reader hits this, which is why it is on camera, not hidden.
const WASM_CC = {
  CC_wasm32_unknown_unknown: "/opt/homebrew/opt/llvm/bin/clang",
  AR_wasm32_unknown_unknown: "/opt/homebrew/opt/llvm/bin/llvm-ar",
};

const RECIPES = {
  "first-blueprint": {
    title: "Your First Blueprint",
    page: "developers/getting-started/02-first-blueprint",
    steps: [
      // Underscore, not hyphen: the tutorial page uses gumball_machine throughout.
      { cmd: "scrypto new-package gumball_machine", cwd: "." },
      // -A, and BEFORE the normalization below: the page documents .gitignore and
      // Cargo.lock in the scaffold, and plain `ls` after an `rm` shows neither.
      // The listing on camera has to be the untouched tree a reader really gets.
      { cmd: "ls -A gumball_machine", cwd: "." },
      // The CLI on this machine is a source-built 1.4.0-dev, so it stamps its own
      // unpublished version into the manifest it generates, and writes a lockfile
      // cargo 1.94 rejects. A reader on the prescribed radix-clis@1.3.1 gets 1.3.1
      // here already. Runs after the listing, before the manifest is shown.
      { cmd: `sed -i '' 's/1.4.0-dev/1.3.1/g' gumball_machine/Cargo.toml && rm -f gumball_machine/Cargo.lock`,
        cwd: ".", hidden: true,
        why: "local CLI is 1.4.0-dev (unpublished); the tutorial prescribes radix-clis@1.3.1" },
      { cmd: "cat gumball_machine/Cargo.toml", cwd: "." },
      { cmd: "scrypto build", cwd: "gumball_machine", slow: true, env: WASM_CC },
    ],
  },
};

const versions = () => {
  const v = (c) => { try { return execSync(c, { encoding: "utf8" }).trim(); } catch { return null; } };
  return {
    scrypto: v("scrypto --version"),
    resim: v("resim --version"),
    rustc: v("rustc --version"),
    cargo: v("cargo --version"),
  };
};

const name = process.argv[2];
const recipe = RECIPES[name];
if (!recipe) {
  console.error(`usage: node studio/capture.mjs <recipe> [--keep]\nrecipes: ${Object.keys(RECIPES).join(", ")}`);
  process.exit(1);
}
const KEEP = process.argv.includes("--keep");

const tool = versions();
console.log("│ toolchain:", JSON.stringify(tool, null, 2).replace(/\n/g, "\n│ "));

// realpath, not the mkdtemp return: macOS hands back /var/... while tooling
// prints the resolved /private/var/..., and scrubbing the unresolved form
// leaves "/private~" fragments in the transcript.
const root = realpathSync(mkdtempSync(join(tmpdir(), `radixwiki-capture-${name}-`)));
console.log(`│ scratch: ${root}`);

const steps = [];
let failed = false;
for (const step of recipe.steps) {
  const cwd = join(root, step.cwd);
  process.stdout.write(`│ ${step.hidden ? "·" : "$"} ${step.cmd}${step.slow ? "  (this one compiles — be patient)" : ""}\n`);
  const t0 = Date.now();
  // spawnSync, not execSync: cargo writes every "Compiling …/Finished …" line to
  // STDERR, and execSync returns stdout alone — the build step's whole transcript
  // would come back empty on success.
  const r = spawnSync(step.cmd, {
    cwd, shell: true, encoding: "utf8", timeout: 20 * 60_000,
    env: { ...process.env, ...(step.env ?? {}) },
  });
  const stdout = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const exitCode = r.status ?? 1;
  if (exitCode !== 0) failed = true;
  const seconds = +((Date.now() - t0) / 1000).toFixed(2);
  console.log(`│   → exit ${exitCode} · ${seconds}s · ${stdout.split("\n").length} lines`);
  steps.push({
    cmd: step.cmd, cwd: step.cwd, exitCode, seconds,
    stdout: stdout.replace(new RegExp(root, "g"), "~"),
    ...(step.hidden ? { hidden: true, why: step.why } : {}),
    ...(step.env ? { env: step.env } : {}),
  });
  if (exitCode !== 0) break;   // a failed step invalidates everything after it
}

mkdirSync(OUT, { recursive: true });
const file = join(OUT, `${name}.json`);
writeFileSync(file, JSON.stringify({
  recipe: name, title: recipe.title, page: recipe.page,
  capturedAt: new Date().toISOString(), toolchain: tool, steps,
}, null, 2) + "\n");

if (!KEEP) rmSync(root, { recursive: true, force: true });
console.log(`│\n${failed ? "✗ a step failed — transcript records it, do NOT film it" : "✓"} ${file}`);
process.exit(failed ? 1 : 0);
