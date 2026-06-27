#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  RADIX.WIKI VIDEO STUDIO — make a video
//
//    node studio/make.mjs <name> [--out <file.mp4>] [--size 1440x900] [--port 3210] [--kit]
//    node studio/make.mjs tour
//
//  Thin entry over the shared radix-studio engine. Spins a throwaway dev server
//  on a SIDE PORT (its own distDir, coexists with :3000), runs
//  studio/videos/<name>.mjs, stitches its recorded segments into an MP4, then
//  tears everything down. Brand + actions live in studio.config.mjs.
// ═══════════════════════════════════════════════════════════════════════════
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "radix-studio";
import config from "./studio.config.mjs";

const studioDir = dirname(fileURLToPath(import.meta.url));
run({ root: resolve(studioDir, ".."), studioDir, config });
