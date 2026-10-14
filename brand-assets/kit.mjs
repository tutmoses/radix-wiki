// brand-assets/kit.mjs — radix.wiki's brand, bound to radix-studio's drawing kit.
//
// Every SVG producer draws from here: generate-infographics.mjs (the durable NN-*
// suite), scripts/wir-figure.mjs (the weekly Week in Review ledger figure) and
// scripts/seed-infographics.mjs. The helpers themselves are radix-studio/kit,
// shared with caper's generator; only radix.wiki's tokens live here.
import fs from 'node:fs';
import { kit } from 'radix-studio/kit';

const LOGO_URI = fs.readFileSync(new URL('.logo-data-uri.txt', import.meta.url), 'utf8').trim();

export const BRAND = {
  eyebrow: 'RADIX WIKI',
  domain: 'radix.wiki',
  // Inter is loaded by the live page; the PNG preview falls back to system-ui.
  sans: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Monaco, monospace",
  radius: 8,
  fonts: [],
  colors: {
    bg: '#393e50', getaway: '#ff9da0', jupiter: '#ffc599', neutral: '#52586e',
    text: '#ffffff', text2: '#e6e8f0', muted: '#c5c9d6', xrd: '#ccd1ff',
    border: '#6b7089', hair: '#5a6178', surf1: '#444a5e', surf2: '#4f5569',
    gTint: 'rgba(255,157,160,0.15)', xTint: 'rgba(204,209,255,0.14)', oTint: 'rgba(255,197,153,0.14)',
    neut: '#8b90a3',
  },
  logo: () => `<image href="${LOGO_URI}" x="48" y="40" width="44" height="44" preserveAspectRatio="xMidYMid meet"/>`,
};

export const { C, MONO, t, wrap, paras, card, sectionLabel, numChip, arrowR, frame, figureBlock, renderPngs } = kit(BRAND);
