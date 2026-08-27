// ═══════════════════════════════════════════════════════════════════════════
//  RADIX.WIKI STUDIO — config
//  The wiki's brand + boot seam for the shared radix-studio engine. The knowledge
//  tour is browse-only, so no auth/demo flags are needed (devEnv is empty).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WikiScene } from "./actions.mjs";
import * as data from "./data.mjs";

// Brand: the mark is the app's OWN /public/logo.png - the identical file the
// site header renders - read at runtime and inlined as a data URI. Reading the
// file rather than transcribing it means the studio cannot drift from the site:
// change the logo once, and every video made afterwards carries the new one.
//
// What was here before was an invented coral "knowledge stack" SVG that nobody
// had checked against the real brand, and it shipped in a finished video. The
// same invention was duplicated in radix-studio's brands.mjs. Both are deleted.
// If you need the mark somewhere new, read this file - do not redraw it.
const LOGO_B64 = readFileSync(join(import.meta.dirname, "..", "public", "logo.png")).toString("base64");
const LOGO = `<img src="data:image/png;base64,${LOGO_B64}" alt="">`;

export default {
  distDir: ".next/studio",
  devEnv: {},                                  // browse-only tour: no auth seam
  readySelector: '[aria-label="Search"]',       // always present, auth-independent
  out: (n) => `radixwiki-${n}.mp4`,
  brand: {
    logo: LOGO,
    accent: "#ff9da0",
    watermark: "radix.wiki",
    wordmark: "radix.wiki",
    // Fallback INSIDE var(): on the live app --font-sans resolves to Inter, but a
    // screencast is a synthetic page where it is undefined, and a bare
    // var(--font-sans) makes the whole declaration invalid at computed-value time -
    // so the sans title card silently rendered in the serif instead.
    sans: "var(--font-sans, Inter),system-ui,-apple-system,sans-serif",
    disp: "Georgia,serif",
  },
  sceneClass: WikiScene,
  context: { data },
  cleanup: () => data.disconnect(),
};
