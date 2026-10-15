// src/components/charts/format.ts — Numeric formatters shared by chart views

import { stepDecimals } from 'wiki-formant/chart';

export function formatCompact(n: number, opts: { prefix?: string; suffix?: string } = {}): string {
  if (!isFinite(n) || n === 0) return `${opts.prefix ?? ''}0${opts.suffix ?? ''}`;
  const abs = Math.abs(n);
  let value: string;
  if (abs >= 1e12) value = (n / 1e12).toFixed(2) + 'T';
  else if (abs >= 1e9) value = (n / 1e9).toFixed(2) + 'B';
  else if (abs >= 1e6) value = (n / 1e6).toFixed(2) + 'M';
  else if (abs >= 1e3) value = (n / 1e3).toFixed(2) + 'K';
  else value = n.toFixed(2);
  return `${opts.prefix ?? ''}${value}${opts.suffix ?? ''}`;
}

/**
 * A token amount: compact from a thousand up, four significant figures below. At two
 * decimals hWBTC's supply of 0.0056 read as 0.01 and every one of its holders as 0.00.
 */
export function formatAmount(n: number): string {
  return Math.abs(n) >= 1e3 ? formatCompact(n) : n.toLocaleString('en-US', { maximumSignificantDigits: 4 });
}

export function formatPercent(n: number | undefined, digits = 2): string {
  if (n === undefined || !isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function formatXrd(n: number | undefined): string {
  if (n === undefined) return '—';
  return formatCompact(n, { suffix: ' $XRD' });
}

export function formatUsd(n: number | undefined): string {
  if (n === undefined || !isFinite(n) || n === 0) return '—';
  return formatCompact(n, { prefix: '$' });
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
const subscript = (n: number) => String(n).split('').map(d => SUBSCRIPT_DIGITS[+d]).join('');

/**
 * A price, its leading zeros counted in a subscript from two up. An axis tick
 * passes its step, and every tick takes the places that step needs, so 0.95
 * does not read 0.9500 under 1.00 and a stablecoin's ticks do not all read 1.00.
 */
export function formatPriceSubscript(p: number, step?: number): string {
  if (p === 0) return '0';
  if (step !== undefined) {
    const fixed = Math.abs(p).toFixed(stepDecimals(step));
    const zeros = fixed.match(/^0\.(0*)/)?.[1]!.length ?? 0;
    return (p < 0 ? '-' : '') + (zeros < 2 ? fixed : `0.${subscript(zeros)}${fixed.slice(2 + zeros)}`);
  }
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  const s = p.toFixed(10);
  const afterDot = s.slice(2);
  const zeros = afterDot.match(/^0*/)?.[0].length ?? 0;
  if (zeros < 2) return p.toFixed(4);
  const sig = afterDot.slice(zeros, zeros + 3).replace(/0+$/, '') || '0';
  return `0.${subscript(zeros)}${sig}`;
}
