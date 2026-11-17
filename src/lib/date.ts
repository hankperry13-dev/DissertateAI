import type { ISODate } from '../types';

const DAY = 86_400_000;

/** Parse `YYYY-MM-DD` as a UTC midnight timestamp (avoids DST drift in day math). */
export function toTime(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, day || 1);
}

export function fromTime(t: number): ISODate {
  return new Date(t).toISOString().slice(0, 10);
}

export function today(): ISODate {
  const now = new Date();
  return fromTime(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromTime(toTime(d) + n * DAY);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toTime(a) - toTime(b)) / DAY);
}

export function isValidDate(d: string | undefined): d is ISODate {
  return !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(toTime(d));
}

export function minDate(...ds: ISODate[]): ISODate {
  return ds.filter(isValidDate).sort()[0];
}

export function maxDate(...ds: ISODate[]): ISODate {
  const s = ds.filter(isValidDate).sort();
  return s[s.length - 1];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(d: ISODate | undefined, opts: { year?: boolean } = {}): string {
  if (!isValidDate(d)) return '—';
  const [y, m, day] = d.split('-').map(Number);
  return `${MONTHS[m - 1]} ${day}${opts.year === false ? '' : `, ${y}`}`;
}

export function fmtMonth(d: ISODate, withYear = true): string {
  const [y, m] = d.split('-').map(Number);
  return withYear ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
}

export function monthKey(d: ISODate): string {
  return d.slice(0, 7);
}

/** Inclusive list of `YYYY-MM` keys between two dates. */
export function monthsBetween(a: ISODate, b: ISODate): string[] {
  const out: string[] = [];
  let [y, m] = a.split('-').map(Number);
  const [ey, em] = b.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function startOfMonth(d: ISODate): ISODate {
  return `${d.slice(0, 7)}-01`;
}

export function relativeDays(d: ISODate, from: ISODate = today()): string {
  const n = diffDays(d, from);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export type RangePreset = 'all' | '30' | '90' | '365' | 'ay' | 'custom';

export interface DateFilter {
  preset: RangePreset;
  start: ISODate;
  end: ISODate;
}

/** Resolve a date filter to concrete inclusive bounds. `null` = unbounded. */
export function resolveRange(f: DateFilter, now: ISODate = today()): { start: ISODate | null; end: ISODate | null } {
  switch (f.preset) {
    case 'all':
      return { start: null, end: null };
    case '30':
    case '90':
    case '365':
      return { start: addDays(now, -Number(f.preset)), end: now };
    case 'ay': {
      // Academic year: Aug 15 → Aug 14.
      const y = Number(now.slice(0, 4));
      const startYear = now.slice(5) >= '08-15' ? y : y - 1;
      return { start: `${startYear}-08-15`, end: `${startYear + 1}-08-14` };
    }
    case 'custom':
      return { start: isValidDate(f.start) ? f.start : null, end: isValidDate(f.end) ? f.end : null };
  }
}

export function inRange(d: ISODate, r: { start: ISODate | null; end: ISODate | null }): boolean {
  if (!isValidDate(d)) return r.start === null && r.end === null;
  if (r.start && d < r.start) return false;
  if (r.end && d > r.end) return false;
  return true;
}
