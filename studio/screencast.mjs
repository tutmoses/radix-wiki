#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  RADIX.WIKI VIDEO STUDIO — make a screencast
//
//    node studio/screencast.mjs <name> [--out f.mp4] [--size 1920x1080] [--silent]
//    node studio/screencast.mjs first-blueprint
//
//  The third path alongside make.mjs (films the live app) and radix-studio's
//  scripts/film.mjs (renders a synthetic 3D set). A screencast films CODE, so
//  like a film it needs NO dev server, no port and no product to boot: CodeScene
//  builds its editor and shell with setContent.
//
//  Narration is muxed at the offsets the storyboard STAMPED while rendering, not
//  at the offsets it planned, so browser latency cannot drift the voice off the
//  picture. A storyboard that returns no cues simply renders silent.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Director, CodeScene, stitch, muxNarration } from "radix-studio";
import config from "./studio.config.mjs";

const studioDir = dirname(new URL(import.meta.url).pathname);
const arg = (flag, def) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : def; };
const log = (...a) => console.log("│", ...a);
const banner = (t) => console.log("\n━━ " + t + " " + "━".repeat(Math.max(0, 56 - t.length)));
const io = { log, banner };

const name = process.argv[2];
if (!name || name.startsWith("--")) {
  console.error("usage: node studio/screencast.mjs <name> [--out f.mp4] [--size 1920x1080] [--silent]");
  process.exit(1);
}

const [width, height] = arg("--size", "1920x1080").split("x").map(Number);
const workDir = join(studioDir, ".work", `screencast-${name}`);
const outFile = arg("--out", join(studioDir, "out", config.out ? config.out(name) : `${name}.mp4`));
mkdirSync(dirname(outFile), { recursive: true });

const mod = await import(pathToFileURL(join(studioDir, "videos", `${name}.mjs`)).href);

banner(`screencast · ${mod.meta?.title ?? name} · ${width}x${height}`);
const director = new Director({
  // CodeScene replaces the document with setContent, so boot() only needs a URL
  // that loads. A data: URL keeps this path completely free of a server.
  base: "data:text/html,",
  out: workDir,
  viewport: { width, height },
  brand: config.brand,
  sceneClass: CodeScene,
  readySelector: null,          // nothing to wait for: there is no app
});

await director.launch();
const result = await mod.default({ director, log, io });
await director.close();

banner("stitch");
stitch(director.segments, outFile, io);

const cues = result?.cues ?? [];
if (cues.length && !process.argv.includes("--silent")) {
  muxNarration(outFile, cues.map((c) => ({ file: join(studioDir, "narration", name, c.audio), at: c.at })), io);
  log(`narration: ${cues.length} lines, first at ${cues[0].at.toFixed(2)}s, last at ${cues.at(-1).at.toFixed(2)}s`);
} else {
  log("no narration muxed (silent)");
}

banner("done");
log(outFile);
