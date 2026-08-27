// ═══════════════════════════════════════════════════════════════════════════
//  RADIX.WIKI STUDIO — Your First Blueprint
//  A code walkthrough of developers/getting-started/02-first-blueprint, filmed
//  with CodeScene: a synthetic editor and shell, so there is no screen recorder,
//  no fixture app and no dev server involved.
//
//  NOTHING HERE IS INVENTED. Three files supply everything on camera:
//    transcripts/first-blueprint.json    – the commands and the stdout a real
//                                          run produced (studio/capture.mjs)
//    transcripts/first-blueprint.lib.rs  – the blueprint exactly as the wiki
//                                          page carries it, extracted from the DB
//    narration/first-blueprint/*.json    – measured audio durations
//
//  Every hold is timed against a MEASURED narration duration, never a guess, so
//  a screen action cannot finish before the sentence describing it does.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const meta = {
  name: "first-blueprint",
  title: "Your First Blueprint – radix.wiki",
  out: "radixwiki-first-blueprint.mp4",
  page: "/developers/getting-started/02-first-blueprint",
};

const STUDIO = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(STUDIO, p), "utf8");
const json = (p) => JSON.parse(read(p));

export default async function makeFirstBlueprint({ director, log }) {
  const tx = json("transcripts/first-blueprint.json");
  const nar = json("narration/first-blueprint/narration.json");
  const code = read("transcripts/first-blueprint.lib.rs");

  // Beat lookup: hold(id) is the measured seconds of that line of narration,
  // plus a small breath so the picture never cuts on the last syllable.
  const beat = Object.fromEntries(nar.beats.map((b) => [b.id, b]));
  const hold = (id, breath = 500) => Math.round(beat[id].seconds * 1000) + breath;

  // Real command output, keyed by command. Hidden steps never reach the screen.
  const shown = tx.steps.filter((s) => !s.hidden);
  const out = (cmd) => {
    const s = shown.find((x) => x.cmd === cmd);
    if (!s) throw new Error(`no captured output for: ${cmd}\n  captured: ${shown.map((x) => x.cmd).join(", ")}`);
    return s.stdout.trimEnd();
  };

  log(`first-blueprint · ${nar.beats.length} beats · ${Math.round(nar.totalSeconds)}s narration · ${shown.length} filmed commands`);

  // The planned timeline and the rendered one drift: installOverlay, setContent
  // and playwright's own latency all cost time the holds never budgeted for. So
  // every beat stamps the wall-clock offset at which it actually began, and the
  // runner muxes each wav at ITS OWN measured cue. Nothing is assumed to line up.
  const cues = [];
  let t0 = 0;

  await director.segment("main", async (s) => {
    t0 = Date.now();
    const mark = (id) => cues.push({ id, audio: beat[id].audio, at: (Date.now() - t0) / 1000 });
    // ── 01 · the premise ────────────────────────────────────────────────────
    mark("01");
    await s.titleCard({ sub: "Your First Blueprint", hold: hold("01") });

    // The roadmap, before any command runs. A viewer who cannot tell inside ten
    // seconds whether this video covers their problem leaves; the vending-machine
    // hook above sets the idea but does not tell them what they will end up with.
    mark("01b");
    await s.agenda(nar.agenda.title, nar.agenda.items, { hold: hold("01b") - 700 });

    // ── 02–04 · the package, on the shell side only ─────────────────────────
    await s.openWorkspace({
      title: "gumball_machine",
      files: [{ name: "src/lib.rs", lang: "rust", code }],
      terminal: true,
      cwd: "~",
      split: 0.55,
    });

    await s.caption("① Package", "The unit Scrypto deploys.");
    mark("02");
    await s.run("scrypto new-package gumball_machine", out("scrypto new-package gumball_machine"));
    await s.wait(hold("02") - 1400);

    mark("03");
    await s.run("ls -A gumball_machine", out("ls -A gumball_machine"));
    await s.wait(hold("03") - 1400);

    mark("04");
    await s.run("cat gumball_machine/Cargo.toml", out("cat gumball_machine/Cargo.toml"), { lineMs: 45 });
    await s.wait(hold("04") - 1400);

    // ── 05–08 · the blueprint itself ────────────────────────────────────────
    await s.caption("② Blueprint", "A struct that owns, an impl that acts.");
    mark("05");
    await s.typeCode("src/lib.rs", { ms: hold("05") - 900 });
    await s.wait(700);

    // The two vaults: what the component owns.
    await s.caption("③ Vaults", "Storage the engine controls.");
    mark("06");
    await s.focusLines("src/lib.rs", [11, 16], hold("06") - 600);

    // The mint: a hundred gumballs, once, at instantiation.
    await s.caption("④ Mint", "A hundred gumballs, once.");
    mark("07");
    await s.focusLines("src/lib.rs", [20, 28], hold("07") - 600);

    // Pull back to the whole file — the point is what is ABSENT from it.
    await s.caption("⑤ No ledger", "No balance mapping. No arithmetic.");
    mark("08");
    await s.showCode("src/lib.rs");
    await s.focusLines("src/lib.rs", [41, 46], hold("08") - 600);

    // ── 09–11 · the build ───────────────────────────────────────────────────
    await s.hideCaption();
    await s.caption("⑥ Build", "Scrypto compiles to WebAssembly.");
    // The real build printed 105 lines over ~57s. Film the head, then let the
    // tail scroll under beat 10 rather than replaying a minute of cargo output.
    const build = out("scrypto build");
    const lines = build.split("\n");
    mark("09");
    await s.run("scrypto build", lines.slice(0, 6).join("\n"), { ms: hold("09") - 400, gap: false });
    mark("10");
    await s.emitMore(lines.slice(6, -2).join("\n"), hold("10") - 900);
    mark("11");
    await s.emitMore(lines.slice(-2).join("\n"), 400);
    await s.wait(hold("11") - 900);

    // ── 12 · the payoff ─────────────────────────────────────────────────────
    mark("12");
    await s.outro("Publish it to Stokenet next. \u2013 radix.wiki", hold("12"));
  });

  // The narrator's corner frame, pinned to the MEASURED cue of the beat she is
  // speaking, so the picture-in-picture starts on the same frame her voice does.
  // The clip is silent: beat 01b's wav is already on the master's narration track.
  const introCue = cues.find((c) => c.id === "01b");
  return {
    cues,
    presenter: introCue && {
      clip: "assets/presenter/first-blueprint-intro.mp4",
      at: introCue.at,
      size: 300,
      corner: "br",
    },
  };
}
