// ═══════════════════════════════════════════════════════════════════════════
//  RADIX.WIKI STUDIO – config
//  The wiki's brand and boot seam for the shared radix-studio engine. The tour
//  reads and signs nothing, so the dev server needs no flags.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WikiScene } from "./actions.mjs";
import * as data from "./data.mjs";

// The caption mark is the app's own /public/logo.png, the file the site header
// renders, inlined as a data URI so the studio cannot drift from the site. The
// plates' logotype is read from the header itself at render time (the tour sets
// `brand.logotype`). Never redraw either.
const LOGO_B64 = readFileSync(join(import.meta.dirname, "..", "public", "logo.png")).toString("base64");
const LOGO = `<img src="data:image/png;base64,${LOGO_B64}" alt="">`;

export default {
  distDir: ".next/studio",
  devEnv: {},
  readySelector: '.header-search input[type="search"]',
  out: (n) => `radixwiki-${n}.mp4`,
  // Frame-stepped at 60fps, 16:9 at 1920x1080, so every scroll lands on every frame.
  fps: 60,
  size: "1440x810",
  brand: {
    logo: LOGO,
    accent: "#ff9da0",
    watermark: "radix.wiki",
    wordmark: "radix.wiki",
    bigCaption: true,
    // The fallback sits inside var(): a screencast is a synthetic page where
    // --font-sans is undefined, and a bare var() invalidates the declaration.
    sans: "var(--font-sans, Inter),system-ui,-apple-system,sans-serif",
    disp: "Georgia,serif",
  },
  sceneClass: WikiScene,
  context: { data },
  cleanup: () => data.disconnect(),
};
