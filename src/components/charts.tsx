import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { fmtCompact, fmtNum, niceTicks } from '../lib/format';
import { fmtDate, toTime } from '../lib/date';
import { Icon } from './ui';

/* ---------------------------------------------------------------------------
   A small SVG chart kit. Specs: bars ≤24px with a 4px rounded data-end and a
   square baseline, 2px lines, ≥8px end markers with a surface ring, hairline
   solid gridlines, a 2px surface gap between touching marks, and a hover
   tooltip on every mark. Every chart card can flip to a table view.
--------------------------------------------------------------------------- */

export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

type Tip = { x: number; y: number; content: ReactNode } | null;

function useTip(container: React.RefObject<HTMLElement>) {
  const [tip, setTip] = useState<Tip>(null);
  const show = useCallback(
    (clientX: number, clientY: number, content: ReactNode) => {
      const r = container.current?.getBoundingClientRect();
      if (!r) return;
      setTip({ x: clientX - r.left, y: clientY - r.top, content });
    },
    [container],
  );
  const hide = useCallback(() => setTip(null), []);
  return { tip, show, hide };
}

function TooltipBox({ tip, width }: { tip: Tip; width: number }) {
  if (!tip) return null;
  const flip = tip.x > width - 190;
  return (
    <div className="tooltip" style={{ left: flip ? undefined : tip.x + 14, right: flip ? width - tip.x + 14 : undefined, top: Math.max(0, tip.y - 12) }}>
      {tip.content}
    </div>
  );
}

export function TipRows({ title, rows }: { title?: ReactNode; rows: { color?: string; label: ReactNode; value: ReactNode; dashed?: boolean }[] }) {
  return (
    <>
      {title && <div className="tooltip-title">{title}</div>}
      {rows.map((r, i) => (
        <div className="tooltip-row" key={i}>
          {r.color && <span className="tooltip-key" style={{ borderColor: r.color, borderTopStyle: r.dashed ? 'dashed' : 'solid' }} />}
          <strong>{r.value}</strong>
          <span>{r.label}</span>
        </div>
      ))}
    </>
  );
}

/* --------------------------------------------------------------------------- card wrapper */

export type LegendItem = { label: string; color: string; kind?: 'rect' | 'line' | 'dashed' };

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="legend" role="list">
      {items.map((it) => (
        <span className="legend-item" role="listitem" key={it.label}>
          {it.kind === 'line' || it.kind === 'dashed' ? (
            <span className={`legend-line${it.kind === 'dashed' ? ' dashed' : ''}`} style={{ borderColor: it.color }} />
          ) : (
            <span className="legend-swatch" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

export interface TableView {
  columns: string[];
  rows: (string | number)[][];
  /** Indexes of numeric columns (right-aligned). */
  numeric?: number[];
}

export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  className = '',
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: LegendItem[];
  table?: TableView;
  className?: string;
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {table && (
          <div className="card-tools no-print">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setAsTable(!asTable)}
              aria-pressed={asTable}
              title={asTable ? 'Show chart' : 'Show data as a table'}
            >
              <Icon name={asTable ? 'chart' : 'table'} size={14} />
              {asTable ? 'Chart' : 'Table'}
            </button>
          </div>
        )}
      </div>
      {asTable && table ? (
        <DataTable table={table} />
      ) : (
        <>
          {legend && legend.length > 1 && <Legend items={legend} />}
          {children}
        </>
      )}
    </section>
  );
}

export function DataTable({ table }: { table: TableView }) {
  const num = new Set(table.numeric ?? []);
  return (
    <div className="chart-table table-wrap">
      <table className="table">
        <thead>
          <tr>
            {table.columns.map((c, i) => (
              <th key={c} className={num.has(i) ? 'num' : ''}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j} className={num.has(j) ? 'num' : ''}>
                  {typeof v === 'number' ? fmtNum(v) : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------------------- geometry */

/** Horizontal bar: square at x0 (baseline), rounded data-end at x1. */
function hBarPath(x0: number, x1: number, y: number, h: number, r = 4): string {
  const w = x1 - x0;
  if (w <= 0) return '';
  const rr = Math.min(r, w, h / 2);
  return `M${x0},${y}H${x1 - rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 - rr},${y + h}H${x0}Z`;
}

/** Vertical column: square at the baseline (y0), rounded top at y1. */
function vBarPath(x: number, w: number, y0: number, y1: number, r = 4): string {
  const h = y0 - y1;
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y0}V${y1 + rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 + rr}V${y0}Z`;
}

const approxTextWidth = (s: string, px = 12) => s.length * px * 0.58;

/* --------------------------------------------------------------------------- horizontal bars */

export interface HBarRow {
  id: string;
  label: string;
  value: number;
  color: string;
  /** Optional track (e.g. target words) drawn behind the bar. */
  track?: number;
  valueLabel?: string;
  tip?: ReactNode;
}

export function HBarChart({ rows, labelWidth = 190, rowHeight = 34, barHeight = 14, max }: { rows: HBarRow[]; labelWidth?: number; rowHeight?: number; barHeight?: number; max?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip(ref);
  const [hover, setHover] = useState<string | null>(null);
  const lw = Math.min(labelWidth, Math.max(90, width * 0.36));
  const valueRoom = 86;
  const plotW = Math.max(40, width - lw - valueRoom);
  const scaleMax = max ?? Math.max(1, ...rows.map((r) => Math.max(r.value, r.track ?? 0)));
  const x = (v: number) => lw + (v / scaleMax) * plotW;
  const h = rows.length * rowHeight + 4;

  return (
    <div className={`chart${hover ? ' has-hover' : ''}`} ref={ref}>
      {width > 0 && (
        <svg width={width} height={h} role="img" aria-label={rows.map((r) => `${r.label}: ${r.valueLabel ?? fmtNum(r.value)}`).join('; ')}>
          <line className="baseline" x1={lw + 0.5} x2={lw + 0.5} y1={0} y2={h} />
          {rows.map((r, i) => {
            const y = i * rowHeight + (rowHeight - barHeight) / 2;
            const label = r.label.length * 7 > lw - 12 ? `${r.label.slice(0, Math.floor((lw - 20) / 6.6))}…` : r.label;
            const enter = (e: React.PointerEvent | React.FocusEvent) => {
              setHover(r.id);
              const box = (e.currentTarget as Element).getBoundingClientRect();
              const cx = 'clientX' in e ? e.clientX : box.left + box.width / 2;
              const cy = 'clientY' in e ? e.clientY : box.top;
              show(cx, cy, r.tip ?? <TipRows title={r.label} rows={[{ color: r.color, label: '', value: r.valueLabel ?? fmtNum(r.value) }]} />);
            };
            const leave = () => {
              setHover(null);
              hide();
            };
            return (
              <g key={r.id}>
                <text className="cat-label" x={lw - 10} y={y + barHeight / 2} dominantBaseline="central" textAnchor="end">
                  <title>{r.label}</title>
                  {label}
                </text>
                {r.track !== undefined && r.track > 0 && (
                  <path d={hBarPath(lw + 1, x(r.track), y, barHeight)} style={{ fill: 'var(--surface-3)' }} />
                )}
                <path className={`mark${hover === r.id ? ' is-hover' : ''}`} d={hBarPath(lw + 1, Math.max(lw + 1, x(r.value)), y, barHeight)} style={{ fill: r.color }} />
                <text className="value-label" x={Math.max(x(r.value), r.track ? x(r.track) : 0) + 8} y={y + barHeight / 2} dominantBaseline="central">
                  {r.valueLabel ?? fmtNum(r.value)}
                </text>
                <rect
                  className="mark-hit"
                  x={0}
                  y={i * rowHeight}
                  width={width}
                  height={rowHeight}
                  tabIndex={0}
                  aria-label={`${r.label}: ${r.valueLabel ?? fmtNum(r.value)}`}
                  onPointerMove={enter}
                  onPointerLeave={leave}
                  onFocus={enter}
                  onBlur={leave}
                />
              </g>
            );
          })}
        </svg>
      )}
      <TooltipBox tip={tip} width={width} />
    </div>
  );
}

/* --------------------------------------------------------------------------- stacked horizontal bars */

export interface StackSeries {
  key: string;
  label: string;
  color: string;
}

export function StackedHBar({ rows, series, labelWidth = 190, rowHeight = 34, barHeight = 14 }: { rows: { id: string; label: string; values: number[] }[]; series: StackSeries[]; labelWidth?: number; rowHeight?: number; barHeight?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip(ref);
  const [hover, setHover] = useState<string | null>(null);
  const lw = Math.min(labelWidth, Math.max(90, width * 0.36));
  const plotW = Math.max(40, width - lw - 50);
  const max = Math.max(1, ...rows.map((r) => r.values.reduce((a, b) => a + b, 0)));
  const ticks = niceTicks(max, 4);
  const top = ticks[ticks.length - 1];
  const x = (v: number) => lw + (v / top) * plotW;
  const h = rows.length * rowHeight + 22;

  return (
    <div className={`chart${hover ? ' has-hover' : ''}`} ref={ref}>
      {width > 0 && (
        <svg width={width} height={h} role="img" aria-label="Stacked bar chart; switch to table view for values">
          {ticks.map((t) => (
            <g key={t}>
              <line className={t === 0 ? 'baseline' : 'gridline'} x1={Math.round(x(t)) + 0.5} x2={Math.round(x(t)) + 0.5} y1={0} y2={rows.length * rowHeight} />
              <text className="axis-label" x={x(t)} y={h - 4} textAnchor="middle">
                {fmtCompact(t)}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const y = i * rowHeight + (rowHeight - barHeight) / 2;
            const total = r.values.reduce((a, b) => a + b, 0);
            const lastIdx = r.values.reduce((acc, v, j) => (v > 0 ? j : acc), -1);
            let acc = 0;
            const label = r.label.length * 7 > lw - 12 ? `${r.label.slice(0, Math.floor((lw - 20) / 6.6))}…` : r.label;
            const enter = (e: React.PointerEvent | React.FocusEvent) => {
              setHover(r.id);
              const box = (e.currentTarget as Element).getBoundingClientRect();
              const cx = 'clientX' in e ? e.clientX : box.left + box.width / 2;
              const cy = 'clientY' in e ? e.clientY : box.top;
              show(
                cx,
                cy,
                <TipRows
                  title={`${r.label} · ${fmtNum(total)}`}
                  rows={series.map((s, j) => ({ color: s.color, label: s.label, value: fmtNum(r.values[j]) }))}
                />,
              );
            };
            const leave = () => {
              setHover(null);
              hide();
            };
            return (
              <g key={r.id}>
                <text className="cat-label" x={lw - 10} y={y + barHeight / 2} dominantBaseline="central" textAnchor="end">
                  <title>{r.label}</title>
                  {label}
                </text>
                <g className={`mark${hover === r.id ? ' is-hover' : ''}`}>
                  {r.values.map((v, j) => {
                    if (v <= 0) return null;
                    const x0 = x(acc) + (acc > 0 ? 2 : 1);
                    acc += v;
                    const x1 = x(acc);
                    return j === lastIdx ? (
                      <path key={j} d={hBarPath(x0, x1, y, barHeight)} style={{ fill: series[j].color }} />
                    ) : (
                      <rect key={j} x={x0} y={y} width={Math.max(0, x1 - x0)} height={barHeight} style={{ fill: series[j].color }} />
                    );
                  })}
                </g>
                <text className="value-label" x={x(total) + 8} y={y + barHeight / 2} dominantBaseline="central">
                  {fmtNum(total)}
                </text>
                <rect className="mark-hit" x={0} y={i * rowHeight} width={width} height={rowHeight} tabIndex={0} aria-label={`${r.label}: ${series.map((s, j) => `${s.label} ${r.values[j]}`).join(', ')}`} onPointerMove={enter} onPointerLeave={leave} onFocus={enter} onBlur={leave} />
              </g>
            );
          })}
        </svg>
      )}
      <TooltipBox tip={tip} width={width} />
    </div>
  );
}

/* --------------------------------------------------------------------------- stacked columns */

export function StackedColumns({ categories, series, height = 220 }: { categories: { key: string; label: string; title: string }[]; series: (StackSeries & { values: number[] })[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip(ref);
  const [hover, setHover] = useState<number | null>(null);
  const left = 30;
  const bottom = 24;
  const plotH = height - bottom - 8;
  const plotW = Math.max(40, width - left - 4);
  const totals = categories.map((_, i) => series.reduce((s, ser) => s + ser.values[i], 0));
  const ticks = niceTicks(Math.max(1, ...totals), 4);
  const top = ticks[ticks.length - 1];
  const y = (v: number) => 8 + plotH - (v / top) * plotH;
  const band = plotW / Math.max(1, categories.length);
  const barW = Math.min(24, band * 0.62);
  const labelEvery = Math.ceil((categories.length * 34) / plotW) || 1;

  return (
    <div className={`chart${hover !== null ? ' has-hover' : ''}`} ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Column chart; switch to table view for values">
          {ticks.map((t) => (
            <g key={t}>
              <line className={t === 0 ? 'baseline' : 'gridline'} x1={left} x2={width} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
              <text className="axis-label" x={left - 8} y={y(t)} dominantBaseline="central" textAnchor="end">
                {fmtCompact(t)}
              </text>
            </g>
          ))}
          {categories.map((c, i) => {
            const bx = left + i * band + (band - barW) / 2;
            let acc = 0;
            const lastIdx = series.reduce((a, s, j) => (s.values[i] > 0 ? j : a), -1);
            const enter = (e: React.PointerEvent | React.FocusEvent) => {
              setHover(i);
              const box = (e.currentTarget as Element).getBoundingClientRect();
              const cx = 'clientX' in e ? e.clientX : box.left + box.width / 2;
              const cy = 'clientY' in e ? e.clientY : box.top + 20;
              show(cx, cy, <TipRows title={`${c.title} · ${fmtNum(totals[i])}`} rows={series.map((s) => ({ color: s.color, label: s.label, value: fmtNum(s.values[i]) }))} />);
            };
            const leave = () => {
              setHover(null);
              hide();
            };
            return (
              <g key={c.key}>
                <g className={`mark${hover === i ? ' is-hover' : ''}`}>
                  {series.map((s, j) => {
                    const v = s.values[i];
                    if (v <= 0) return null;
                    const y0 = y(acc) - (acc > 0 ? 2 : 0);
                    acc += v;
                    const y1 = y(acc);
                    return j === lastIdx ? (
                      <path key={s.key} d={vBarPath(bx, barW, y0, y1)} style={{ fill: s.color }} />
                    ) : (
                      <rect key={s.key} x={bx} y={y1} width={barW} height={Math.max(0, y0 - y1)} style={{ fill: s.color }} />
                    );
                  })}
                </g>
                {i % labelEvery === 0 && (
                  <text className="axis-label" x={bx + barW / 2} y={height - 6} textAnchor="middle">
                    {c.label}
                  </text>
                )}
                <rect className="mark-hit" x={left + i * band} y={0} width={band} height={height - bottom} tabIndex={0} aria-label={`${c.title}: ${fmtNum(totals[i])}`} onPointerMove={enter} onPointerLeave={leave} onFocus={enter} onBlur={leave} />
              </g>
            );
          })}
        </svg>
      )}
      <TooltipBox tip={tip} width={width} />
    </div>
  );
}

/* --------------------------------------------------------------------------- line chart */

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  area?: boolean;
  points: { x: string; y: number }[];
}

type LineProps = { series: LineSeries[]; height?: number; yFormat?: (n: number) => string };

export function LineChart(props: LineProps) {
  if (!props.series.some((s) => s.points.length)) return <div className="empty">No data in this range.</div>;
  return <LineChartInner {...props} />;
}

function LineChartInner({ series, height = 240, yFormat = fmtCompact }: LineProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip(ref);
  const [cross, setCross] = useState<string | null>(null);
  const all = series.flatMap((s) => s.points);

  const left = 40;
  const right = 64;
  const bottom = 24;
  const plotW = Math.max(40, width - left - right);
  const plotH = height - bottom - 10;
  const xs = Array.from(new Set(all.map((p) => p.x))).sort();
  const t0 = toTime(xs[0]);
  const t1 = Math.max(t0 + 86_400_000, toTime(xs[xs.length - 1]));
  const ticks = niceTicks(Math.max(1, ...all.map((p) => p.y)), 4);
  const top = ticks[ticks.length - 1];
  const X = (d: string) => left + ((toTime(d) - t0) / (t1 - t0)) * plotW;
  const Y = (v: number) => 10 + plotH - (v / top) * plotH;

  // Month ticks along the x-axis.
  const monthTicks: string[] = [];
  {
    const d0 = new Date(t0);
    let y = d0.getUTCFullYear();
    let m = d0.getUTCMonth() + 1;
    for (;;) {
      if (m > 11) {
        m = 0;
        y++;
      }
      const t = Date.UTC(y, m, 1);
      if (t > t1) break;
      monthTicks.push(new Date(t).toISOString().slice(0, 10));
      m++;
    }
  }
  const every = Math.ceil((monthTicks.length * 46) / plotW) || 1;

  const valueAt = (s: LineSeries, x: string) => {
    let v: number | null = null;
    for (const p of s.points) if (p.x <= x) v = p.y;
    return v;
  };

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - r.left + left;
    let best = xs[0];
    let bd = Infinity;
    for (const d of xs) {
      const dd = Math.abs(X(d) - px);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    setCross(best);
    show(
      e.clientX,
      e.clientY,
      <TipRows
        title={fmtDate(best)}
        rows={series.map((s) => {
          const v = valueAt(s, best);
          return { color: s.color, dashed: s.dashed, label: s.label, value: v === null ? '—' : fmtNum(v) };
        })}
      />,
    );
  };

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={series.map((s) => `${s.label}: ends at ${fmtNum(s.points[s.points.length - 1]?.y ?? 0)}`).join('; ')}>
          {ticks.map((t) => (
            <g key={t}>
              <line className={t === 0 ? 'baseline' : 'gridline'} x1={left} x2={left + plotW} y1={Math.round(Y(t)) + 0.5} y2={Math.round(Y(t)) + 0.5} />
              <text className="axis-label" x={left - 8} y={Y(t)} dominantBaseline="central" textAnchor="end">
                {yFormat(t)}
              </text>
            </g>
          ))}
          {monthTicks.map((d, i) =>
            i % every === 0 ? (
              <text key={d} className="axis-label" x={X(d)} y={height - 6} textAnchor="middle">
                {fmtDate(d).split(' ')[0]}
                {d.slice(5, 7) === '01' ? ` ’${d.slice(2, 4)}` : ''}
              </text>
            ) : null,
          )}
          {series.map((s) => {
            if (!s.points.length) return null;
            const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
            const last = s.points[s.points.length - 1];
            return (
              <g key={s.key}>
                {s.area && <path d={`${d}L${X(last.x)},${Y(0)}L${X(s.points[0].x)},${Y(0)}Z`} style={{ fill: s.color, opacity: 0.1 }} />}
                <path d={d} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 5' : undefined} style={{ stroke: s.color }} />
                <circle cx={X(last.x)} cy={Y(last.y)} r={4.5} strokeWidth={2} style={{ fill: s.color, stroke: 'var(--surface)' }} />
                <text className="value-label" x={X(last.x) + 9} y={Y(last.y)} dominantBaseline="central">
                  {fmtCompact(last.y)}
                </text>
              </g>
            );
          })}
          {cross && (
            <g pointerEvents="none">
              <line x1={X(cross)} x2={X(cross)} y1={10} y2={10 + plotH} style={{ stroke: 'var(--axis-ink)' }} strokeWidth={1} />
              {series.map((s) => {
                const v = valueAt(s, cross);
                return v === null ? null : <circle key={s.key} cx={X(cross)} cy={Y(v)} r={4} strokeWidth={2} style={{ fill: s.color, stroke: 'var(--surface)' }} />;
              })}
            </g>
          )}
          <rect
            x={left}
            y={0}
            width={plotW}
            height={plotH + 10}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => {
              setCross(null);
              hide();
            }}
          />
        </svg>
      )}
      <TooltipBox tip={tip} width={width} />
    </div>
  );
}

/* --------------------------------------------------------------------------- tall segmented bar */

/** `ink` overrides the in-block label colour for light fills (default white). */
export function SegmentedBar({ parts }: { parts: { key: string; label: string; value: number; color: string; ink?: string }[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { tip, show, hide } = useTip(ref);
  const total = parts.reduce((s, p) => s + p.value, 0);
  const visible = parts.filter((p) => p.value > 0);
  const avail = width - 2 * (visible.length - 1);
  return (
    <div className="chart" ref={ref}>
      <Legend items={parts.map((p) => ({ label: p.label, color: p.color }))} />
      <div className="segbar" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(', ')}>
        {visible.map((p) => {
          const w = total ? (p.value / total) * avail : 0;
          const txt = String(p.value);
          const fits = approxTextWidth(txt) + 16 <= w;
          const enter = (e: React.PointerEvent | React.FocusEvent) => {
            const box = (e.currentTarget as Element).getBoundingClientRect();
            const cx = 'clientX' in e ? e.clientX : box.left + box.width / 2;
            const cy = 'clientY' in e ? e.clientY : box.top;
            show(cx, cy, <TipRows title={p.label} rows={[{ color: p.color, label: `of ${total}`, value: `${p.value} (${Math.round((p.value / total) * 100)}%)` }]} />);
          };
          return (
            <div key={p.key} tabIndex={0} style={{ width: w, background: p.color, color: p.ink }} onPointerMove={enter} onPointerLeave={hide} onFocus={enter} onBlur={hide} aria-label={`${p.label}: ${p.value}`}>
              {fits ? txt : ''}
            </div>
          );
        })}
      </div>
      <TooltipBox tip={tip} width={width} />
    </div>
  );
}
