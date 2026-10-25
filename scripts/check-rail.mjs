// scripts/check-rail.mjs — the rail's rows keep one vertical rhythm.
//
// The rail had drifted to three spacings at once: 8px between the site links,
// 4px before an open branch and between contents entries, and 56px between
// sections, each written as its own utility on its own rule. globals.css now
// holds the rhythm in three tokens on `.wiki-sidebar` (`--rail-row`, a row's own
// padding; `--rail-gap`, between rows; `--rail-section`, between sections), and
// this fails on any vertical spacing in the rail that is not one of them.
//
//   npm run lint:rail
//
// It reads the rows' rules in globals.css (the SIDEBAR section, less the frame
// `.wiki-sidebar` and its scroller, which the package lays out) and every string
// in Sidebar.tsx. Horizontal spacing is the surface's and is not checked; a row's
// icon gap is written `gap-x-*` so it reads as horizontal.

import fs from 'node:fs';

const CSS = 'src/styles/globals.css';
const TSX = 'src/components/Sidebar.tsx';

// A vertical spacing utility, any variant, and the value it sets.
const VERTICAL = /^(?:[\w-]+:)*!?-?(?:gap-y|gap(?!-x-)|space-y|py|pt|pb|my|mt|mb|p|m)-(.+)$/;
const onRhythm = value => value === '0' || /^\(--rail-(?:row|gap|section)\)$/.test(value);
const faults = [];

// Comments blanked in place, so offsets still give line numbers.
const raw = fs.readFileSync(CSS, 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
const start = raw.indexOf('/* ===== SIDEBAR');
const end = raw.indexOf('/* =====', start + 1);
if (start < 0 || end < 0) throw new Error(`${CSS}: no SIDEBAR section`);
const lineAt = i => css.slice(0, i).split('\n').length;

// Top-level rules of the section, each with its selector and body.
let depth = 0, from = start, selector = '';
for (let i = start; i < end; i++) {
  if (css[i] === '{' && depth++ === 0) { selector = css.slice(from, i).trim(); from = i + 1; }
  else if (css[i] === '}' && --depth === 0) {
    if (!/^\.wiki-sidebar(?:__scroll)?$/.test(selector)) {
      const body = css.slice(from, i);
      for (const m of body.matchAll(/@apply ([^;]+);/g)) {
        for (const tok of m[1].trim().split(/\s+/)) {
          const v = tok.match(VERTICAL);
          if (v && !onRhythm(v[1])) faults.push(`${CSS}:${lineAt(from + m.index)}  ${selector}  ${tok}`);
        }
      }
      for (const m of body.matchAll(/(?:^|[;{\s])((?:row-)?gap|padding(?:-(?:top|bottom|block))?|margin(?:-(?:top|bottom|block))?)\s*:\s*([^;}]+)/g)) {
        if (!/var\(--rail-|^0$/.test(m[2].trim())) faults.push(`${CSS}:${lineAt(from + m.index)}  ${selector}  ${m[1]}: ${m[2].trim()}`);
      }
    }
    from = i + 1;
  }
}

// Every string in the component: a className, a `cn()` argument, a classNames map.
fs.readFileSync(TSX, 'utf8').split('\n').forEach((line, i) => {
  for (const m of line.matchAll(/'([^']*)'|"([^"]*)"/g)) {
    for (const tok of (m[1] ?? m[2]).split(/\s+/)) {
      const v = tok.match(VERTICAL);
      if ((v && !onRhythm(v[1])) || /^stack(?:-\w+)?$/.test(tok)) faults.push(`${TSX}:${i + 1}  ${tok}`);
    }
  }
});

if (faults.length) {
  console.error(`check-rail: ${faults.length} vertical spacing(s) off the rail rhythm; use --rail-row, --rail-gap or --rail-section:\n`);
  for (const f of faults) console.error(`  ${f}`);
  process.exit(1);
}
console.log('check-rail: every rail row is on the rhythm.');
