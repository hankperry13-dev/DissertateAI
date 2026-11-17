export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** Compact figures for stat tiles and axes: 1,284 / 12.9K / 4.2M. */
export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  if (a < 10_000) return fmtNum(n);
  if (a < 1_000_000) return `${(n / 1000).toFixed(a < 100_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

export function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

/**
 * Clean axis ticks: the step is 1, 2 or 5 × 10^n (never fractional below 1, so
 * counts never get "2.5" ticks), and the top tick is the first step ≥ max.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  let step = [1, 2, 5, 10].map((m) => m * base).find((v) => v >= raw) ?? 10 * base;
  if (step < 1) step = 1;
  const n = Math.max(1, Math.ceil(max / step - 1e-9));
  return Array.from({ length: n + 1 }, (_, i) => i * step);
}
