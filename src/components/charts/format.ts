// src/components/charts/format.ts — Numeric formatters shared by chart views

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

export function formatPercent(n: number | undefined, digits = 2): string {
  if (n === undefined || !isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function formatXrd(n: number): string {
  return formatCompact(n, { suffix: ' XRD' });
}

export function formatUsd(n: number | undefined): string {
  if (n === undefined || !isFinite(n) || n === 0) return '—';
  return formatCompact(n, { prefix: '$' });
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
export function formatPriceSubscript(p: number): string {
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  const s = p.toFixed(10);
  const afterDot = s.slice(2);
  const zeros = afterDot.match(/^0*/)?.[0].length ?? 0;
  if (zeros < 2) return p.toFixed(4);
  const sig = afterDot.slice(zeros, zeros + 3).replace(/0+$/, '') || '0';
  const sub = zeros;
  return `0.${String(sub).split('').map(d => SUBSCRIPT_DIGITS[+d]).join('')}${sig}`;
}
