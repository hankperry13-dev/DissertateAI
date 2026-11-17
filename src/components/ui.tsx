import { useEffect, useRef, useState, type ReactNode } from 'react';
import { resolveRange, type DateFilter, type RangePreset } from '../lib/date';

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const p = ICONS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p}
    </svg>
  );
}

const ICONS = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5" />,
  book: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />,
  quote: <path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6" />,
  users: <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7" />,
  send: <path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" />,
  gantt: <path d="M3 5h9M7 10h10M11 15h8M5 20h6M3 3v18" />,
  report: <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  download: <path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M4 19h16" />,
  upload: <path d="M12 20V9m0 0 4.5 4.5M12 9l-4.5 4.5M4 4h16" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  sun: <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5" />,
  settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1" />,
  table: <path d="M3 5h18v14H3zM3 10h18M3 15h18M9 5v14" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  alert: <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0" />,
  check: <path d="M5 12.5 10 17 19 7" />,
  undo: <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  file: <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6" />,
  calendar: <path d="M4 6h16v15H4zM4 10h16M8 3v4M16 3v4" />,
  printer: <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z" />,
} as const;
export type IconName = keyof typeof ICONS;

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.modal-close)');
    first?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost icon-btn modal-close" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`field${full ? ' full' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Stat({ label, value, sub, hero, children }: { label: string; value: ReactNode; sub?: ReactNode; hero?: boolean; children?: ReactNode }) {
  return (
    <div className={`card stat${hero ? ' hero' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {children}
    </div>
  );
}

export function Badge({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <span className="badge">
      {color && <span className="dot" style={{ background: color }} />}
      {children}
    </span>
  );
}

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="head-actions no-print">{actions}</div>}
    </header>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: '365', label: 'Last 12 months' },
  { key: 'ay', label: 'This academic year' },
  { key: 'custom', label: 'Custom range…' },
];

/** Date range control: presets first, custom range behind the last option. */
export function DateRangeField({ value, onChange }: { value: DateFilter; onChange: (f: DateFilter) => void }) {
  const r = resolveRange(value);
  return (
    <>
      <Field label="Date range">
        <select
          className="input"
          value={value.preset}
          onChange={(e) => {
            const preset = e.target.value as RangePreset;
            if (preset === 'custom' && !value.start) {
              const cur = resolveRange({ ...value, preset: '90' });
              onChange({ preset, start: cur.start ?? '', end: cur.end ?? '' });
            } else onChange({ ...value, preset });
          }}
        >
          {PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      {value.preset === 'custom' && (
        <>
          <Field label="From">
            <input className="input" type="date" value={value.start} max={value.end || undefined} onChange={(e) => onChange({ ...value, start: e.target.value })} />
          </Field>
          <Field label="To">
            <input className="input" type="date" value={value.end} min={value.start || undefined} onChange={(e) => onChange({ ...value, end: e.target.value })} />
          </Field>
        </>
      )}
      {value.preset !== 'all' && value.preset !== 'custom' && r.start && (
        <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>
          {r.start} → {r.end}
        </span>
      )}
    </>
  );
}

export const defaultDateFilter: DateFilter = { preset: 'all', start: '', end: '' };

/** Session-persisted UI state (filters, tabs). Falls back to memory when storage is blocked. */
export function usePersistentState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(`dissertateai:ui:${key}`);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      /* ignore */
    }
    return initial;
  });
  const set = (next: T) => {
    setV(next);
    try {
      sessionStorage.setItem(`dissertateai:ui:${key}`, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return [v, set];
}

let toastTimer: number | undefined;
export function toast(message: string) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.display = 'block';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (el) el.style.display = 'none';
  }, 2600);
}

export function confirmDelete(what: string): boolean {
  return window.confirm(`Delete ${what}? This can't be undone.`);
}

/** Toggle a value in a string[]; used by multi-select chips. */
export function toggleIn(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function ChipSelect({ options, value, onChange }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => (
        <label key={o.value} className="check badge" style={{ cursor: 'pointer', background: value.includes(o.value) ? 'var(--accent-wash)' : undefined }}>
          <input type="checkbox" checked={value.includes(o.value)} onChange={() => onChange(toggleIn(value, o.value))} />
          {o.label}
        </label>
      ))}
    </div>
  );
}
