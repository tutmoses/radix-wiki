// scripts/check-classes.mjs — fail on a className token that styles nothing.
//
// The design-system overhaul in c9ede60 deleted `.wrap`, `.link` and friends from
// globals.css and left their call sites behind. A class that resolves to nothing
// is silent: React renders it, the browser ignores it, and the page is subtly
// wrong (a twelve-card pageList laid out `nowrap` and scrolled the whole document
// sideways; `.hidden-mobile` never hid a column on a phone). Seven such tokens
// were live across 28 sites before anyone counted them, so this counts them.
//
// Method: every class selector the build emits — Tailwind's utilities and
// globals.css's components alike — is the ground truth. Any bare token written in
// a className string literal and absent from that set is dead.
//
//   node scripts/check-classes.mjs           # exit 1 on any dead token
//   node scripts/check-classes.mjs --warn    # report and exit 0
//
// Needs a build first (npm run build): without one there is nothing to check
// against, and the script says so and exits 0 rather than failing blind.
import fs from 'node:fs';
import path from 'node:path';

const WARN_ONLY = process.argv.includes('--warn');
const CSS_DIR = '.next/static';
const SRC_DIR = 'src';

const walk = (dir, ext, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
};

const cssFiles = walk(CSS_DIR, '.css');
if (!cssFiles.length) {
  console.log('check-classes: no built CSS under .next/static — run `npm run build` first. Skipping.');
  process.exit(0);
}

// Every class selector present in the emitted stylesheets, unescaped.
const emitted = new Set();
for (const f of cssFiles) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/\.((?:\\.|[-\w])+)/g)) {
    emitted.add(m[1].replace(/\\/g, ''));
  }
}

// Only bare literals: anything interpolated is beyond a static check.
const dead = new Map();
for (const f of walk(SRC_DIR, '.tsx')) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/className=(?:"([^"]*)"|\{'([^']*)')/g)) {
      for (const tok of (m[1] || m[2]).split(/\s+/)) {
        if (!tok || tok.includes('$') || tok.includes('{')) continue;
        const base = tok.replace(/^[a-z-]+:/, '').replace(/^!/, ''); // strip variant, important
        if (emitted.has(tok) || emitted.has(base)) continue;
        if (!dead.has(tok)) dead.set(tok, []);
        dead.get(tok).push(`${f}:${i + 1}`);
      }
    }
  });
}

if (!dead.size) {
  console.log(`check-classes: clean — every className token resolves against ${emitted.size} emitted selectors.`);
  process.exit(0);
}

console.error(`check-classes: ${dead.size} className token(s) style nothing:\n`);
for (const [tok, at] of [...dead].sort((a, b) => b[1].length - a[1].length)) {
  console.error(`  ${tok.padEnd(24)} ${String(at.length).padStart(3)}x  ${at.slice(0, 4).join(', ')}${at.length > 4 ? ', …' : ''}`);
}
// Derived, not hardcoded: this script is copied verbatim into the sibling
// projects and their globals.css does not sit at the same path.
const globals = walk(SRC_DIR, '.css').find(f => f.endsWith('globals.css')) ?? 'your globals.css';
console.error(`\nEither define it in ${globals} or delete the usage.`);
process.exit(WARN_ONLY ? 0 : 1);
