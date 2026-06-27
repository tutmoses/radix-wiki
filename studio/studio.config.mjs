// ═══════════════════════════════════════════════════════════════════════════
//  RADIX.WIKI STUDIO — config
//  The wiki's brand + boot seam for the shared radix-studio engine. The knowledge
//  tour is browse-only, so no auth/demo flags are needed (devEnv is empty).
// ═══════════════════════════════════════════════════════════════════════════
import { WikiScene } from "./actions.mjs";
import * as data from "./data.mjs";

// Brand: a coral "knowledge stack" mark in the wiki palette (accent → light →
// cream), paired with the live app's Inter (var(--font-sans)). No display face
// exists in the theme, so the title-card serif falls back to Georgia.
const LOGO = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="16" width="36" height="8" rx="4" fill="#ff9da0"/><rect x="14" y="28" width="36" height="8" rx="4" fill="#ffc9cb"/><rect x="14" y="40" width="24" height="8" rx="4" fill="#fff4cc"/></svg>`;

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
    sans: "var(--font-sans),system-ui,sans-serif",
    disp: "Georgia,serif",
  },
  sceneClass: WikiScene,
  context: { data },
  cleanup: () => data.disconnect(),
};
