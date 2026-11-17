import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chapterLabel, sortedChapters, useStore } from '../store';
import type { Chapter, StageKey } from '../types';
import { addDays, diffDays, fmtDate, maxDate, minDate, monthsBetween, today, toTime } from '../lib/date';
import { CHAPTER_STATUS_COLOR, CHAPTER_STATUS_LABEL, STAGES, STAGE_LABEL } from '../lib/labels';
import { download, downloadCsv } from '../lib/export';
import { Badge, Field, Icon, Menu, PageHead, toast, usePersistentState } from '../components/ui';
import { Legend } from '../components/charts';
import { GanttUploads } from './GanttUploads';

const ROW_H = 76;
const HEAD_H = 44;
const LANE_Y: Record<StageKey, number> = { drafting: 10, revising: 31, review: 52 };
const ZOOMS = { week: 9, month: 3.6, quarter: 1.5 } as const;
type Zoom = keyof typeof ZOOMS;

type DragTarget = { chapterId: string; part: StageKey | 'deadline'; mode: 'move' | 'start' | 'end' };
type DragState = DragTarget & { startX: number; original: Chapter; delta: number };

/**
 * Apply a day delta to one part of a chapter. With `cascade`, moving or
 * extending a stage shifts the later stages by the same amount so the sequence
 * stays intact. Deadlines never move implicitly — a stage that overruns its
 * deadline is flagged instead.
 */
function applyDelta(ch: Chapter, t: DragTarget, delta: number, cascade: boolean): Chapter {
  const next: Chapter = structuredClone(ch);
  if (t.part === 'deadline') {
    next.deadline = addDays(ch.deadline, delta);
    return next;
  }
  const span = next.stages[t.part];
  const orig = ch.stages[t.part];
  if (t.mode === 'move') {
    span.start = addDays(orig.start, delta);
    span.end = addDays(orig.end, delta);
  } else if (t.mode === 'start') {
    span.start = minDate(addDays(orig.start, delta), orig.end);
  } else {
    span.end = maxDate(addDays(orig.end, delta), orig.start);
  }
  if (cascade && t.mode !== 'start') {
    const endShift = diffDays(span.end, orig.end);
    const order: StageKey[] = ['drafting', 'revising', 'review'];
    for (const k of order.slice(order.indexOf(t.part) + 1)) {
      next.stages[k] = { start: addDays(ch.stages[k].start, endShift), end: addDays(ch.stages[k].end, endShift) };
    }
  }
  return next;
}

export function Timeline() {
  const [tab, setTab] = usePersistentState<'timeline' | 'uploads'>('timeline-tab', 'timeline');
  const { uploads } = useStore();
  return (
    <>
      <PageHead
        title="Timeline & Gantt charts"
        subtitle="Drag a bar to move it, drag its ends to change its length, and drag ◆ to move a deadline."
      />
      <div className="tabs" role="tablist">
        <button className="tab" role="tab" aria-selected={tab === 'timeline'} onClick={() => setTab('timeline')}>
          Interactive timeline
        </button>
        <button className="tab" role="tab" aria-selected={tab === 'uploads'} onClick={() => setTab('uploads')}>
          Uploaded Gantt charts {uploads.length > 0 && <span className="badge" style={{ marginLeft: 6, height: 18 }}>{uploads.length}</span>}
        </button>
      </div>
      {tab === 'timeline' ? <InteractiveTimeline /> : <GanttUploads />}
    </>
  );
}

function InteractiveTimeline() {
  const { data, setChapters, upsert } = useStore();
  const [zoom, setZoom] = usePersistentState<Zoom>('timeline-zoom', 'month');
  const [cascade, setCascade] = usePersistentState('timeline-cascade', true);
  const [shown, setShown] = usePersistentState<StageKey[]>('timeline-stages', ['drafting', 'revising', 'review']);
  const [hideDone, setHideDone] = usePersistentState('timeline-hidedone', false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [history, setHistory] = useState<Chapter[][]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = today();
  const pxPerDay = ZOOMS[zoom];

  const chapters = sortedChapters(data.chapters).filter((c) => !hideDone || c.status !== 'complete');

  // Visible window: from a month before the earliest date to two months after the latest.
  const { start, end } = useMemo(() => {
    const all = data.chapters.flatMap((c) => [c.stages.drafting.start, c.stages.review.end, c.deadline]);
    all.push(now, data.profile.defenseDate);
    const s = minDate(...all) ?? now;
    const e = maxDate(...all) ?? addDays(now, 365);
    return { start: `${addDays(s, -30).slice(0, 7)}-01`, end: addDays(e, 60) };
  }, [data.chapters, data.profile.defenseDate, now]);

  const totalDays = diffDays(end, start);
  const width = Math.max(600, totalDays * pxPerDay);
  const X = useCallback((d: string) => diffDays(d, start) * pxPerDay, [start, pxPerDay]);

  // Scroll so "today" is in view on first render and on zoom change.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, X(now) - el.clientWidth * 0.3);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const display = (c: Chapter): Chapter => (drag && drag.chapterId === c.id ? applyDelta(drag.original, drag, drag.delta, cascade) : c);

  const commit = (next: Chapter) => {
    setHistory((h) => [...h.slice(-19), data.chapters]);
    upsert('chapters', next);
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setChapters(prev);
    setHistory((h) => h.slice(0, -1));
    toast('Change undone');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const label = (c: Chapter, t: DragTarget) => {
    if (t.part === 'deadline') return `Deadline · ${fmtDate(c.deadline)}`;
    const s = c.stages[t.part];
    return `${STAGE_LABEL[t.part]} · ${fmtDate(s.start, { year: false })} → ${fmtDate(s.end)} (${diffDays(s.end, s.start) + 1} days)`;
  };

  const onPointerDown = (e: React.PointerEvent, c: Chapter, t: DragTarget) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(c.id);
    setDrag({ ...t, startX: e.clientX, original: c, delta: 0 });
    setTip({ x: e.clientX, y: e.clientY, text: label(c, t) });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const delta = Math.round((e.clientX - drag.startX) / pxPerDay);
    const preview = applyDelta(drag.original, drag, delta, cascade);
    if (delta !== drag.delta) setDrag({ ...drag, delta });
    setTip({ x: e.clientX, y: e.clientY, text: label(preview, drag) });
  };

  const onPointerUp = () => {
    if (!drag) return;
    if (drag.delta !== 0) {
      const next = applyDelta(drag.original, drag, drag.delta, cascade);
      commit(next);
      toast(`${chapterLabel(next)}: ${label(next, drag)}`);
    }
    setDrag(null);
    setTip(null);
  };

  /** Keyboard alternative: ←/→ move a day, Shift = a week, Alt/Option = resize the end. */
  const onKeyDown = (e: React.KeyboardEvent, c: Chapter, part: StageKey | 'deadline') => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 7 : 1);
    const t: DragTarget = { chapterId: c.id, part, mode: e.altKey && part !== 'deadline' ? 'end' : 'move' };
    const next = applyDelta(c, t, step, cascade);
    commit(next);
    setSelected(c.id);
  };

  const months = monthsBetween(start, end);
  const monthEvery = zoom === 'quarter' ? 3 : 1;
  const selectedChapter = data.chapters.find((c) => c.id === selected) ?? null;
  const defenseX = X(data.profile.defenseDate);

  const exportCsv = () =>
    downloadCsv(
      `timeline-${now}.csv`,
      sortedChapters(data.chapters).flatMap((c) => [
        ...STAGES.map((s) => ({ c, task: s.label, start: c.stages[s.key].start, end: c.stages[s.key].end })),
        { c, task: 'Deadline', start: c.deadline, end: c.deadline },
      ]),
      [
        { header: 'Chapter', value: (r) => chapterLabel(r.c) },
        { header: 'Task', value: (r) => r.task },
        { header: 'Start', value: (r) => r.start },
        { header: 'End', value: (r) => r.end },
        { header: 'Days', value: (r) => diffDays(r.end, r.start) + 1 },
        { header: 'Chapter stage', value: (r) => CHAPTER_STATUS_LABEL[r.c.status] },
      ],
    );

  const exportSvg = () => {
    const rowH = 40;
    const lw = 260;
    const pd = 1.6;
    const w = lw + totalDays * pd + 20;
    const h = 40 + sortedChapters(data.chapters).length * rowH + 20;
    const colors: Record<StageKey, string> = { drafting: '#2a78d6', revising: '#eb6834', review: '#1baf7a' };
    const xx = (d: string) => lw + diffDays(d, start) * pd;
    const esc = (s: string) => s.replace(/[<>&"]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[m]!);
    let body = '';
    months.forEach((m, i) => {
      if (i % 2) return;
      const x = xx(`${m}-01`);
      body += `<line x1="${x}" x2="${x}" y1="28" y2="${h - 10}" stroke="#e1e0d9"/><text x="${x + 3}" y="20" font-size="10" fill="#52514e">${m}</text>`;
    });
    sortedChapters(data.chapters).forEach((c, i) => {
      const y = 40 + i * rowH;
      body += `<text x="10" y="${y + 18}" font-size="12" fill="#0b0b0b">${esc(chapterLabel(c))}</text>`;
      STAGES.forEach((s, j) => {
        const sp = c.stages[s.key];
        body += `<rect x="${xx(sp.start)}" y="${y + 4 + j * 10}" width="${Math.max(2, (diffDays(sp.end, sp.start) + 1) * pd)}" height="8" rx="2" fill="${colors[s.key]}"/>`;
      });
      const dx = xx(c.deadline);
      body += `<rect x="${dx - 5}" y="${y + 10}" width="10" height="10" transform="rotate(45 ${dx} ${y + 15})" fill="#0b0b0b"/>`;
    });
    const tx = xx(now);
    body += `<line x1="${tx}" x2="${tx}" y1="28" y2="${h - 10}" stroke="#d03b3b" stroke-width="2"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" font-family="system-ui, sans-serif"><rect width="100%" height="100%" fill="#fcfcfb"/>${body}</svg>`;
    download(`dissertation-timeline-${now}.svg`, svg, 'image/svg+xml');
  };

  return (
    <>
      <div className="filter-panel">
        <div className="filter-row">
          <div className="seg" role="group" aria-label="Zoom">
            {(Object.keys(ZOOMS) as Zoom[]).map((z) => (
              <button key={z} aria-pressed={zoom === z} onClick={() => setZoom(z)}>
                {z[0].toUpperCase() + z.slice(1)}s
              </button>
            ))}
          </div>
          <button
            className="btn"
            onClick={() => {
              const el = scrollRef.current;
              if (el) el.scrollTo({ left: Math.max(0, X(now) - el.clientWidth * 0.3), behavior: 'smooth' });
            }}
          >
            Today
          </button>
          <button className="btn" onClick={undo} disabled={!history.length} title="Undo (Ctrl/⌘+Z)">
            <Icon name="undo" size={14} /> Undo
          </button>
          <button className={`btn${showOptions ? ' btn-active' : ''}`} aria-expanded={showOptions} onClick={() => setShowOptions(!showOptions)}>
            <Icon name="settings" size={14} /> Options
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <Menu
              label="Export"
              items={[
                { label: 'Image (SVG)', hint: 'For slides or your committee', onClick: exportSvg },
                { label: 'Spreadsheet (CSV)', hint: 'Import into Excel or a Gantt tool', onClick: exportCsv },
              ]}
            />
          </div>
        </div>
        {showOptions && (
          <div className="filters" role="group" aria-label="Timeline options">
            <div className="field">
              <span>Show stages</span>
              <div style={{ display: 'flex', gap: 12, minHeight: 34, alignItems: 'center', flexWrap: 'wrap' }}>
                {STAGES.map((s) => (
                  <label className="check" key={s.key}>
                    <input type="checkbox" checked={shown.includes(s.key)} onChange={() => setShown(shown.includes(s.key) ? shown.filter((x) => x !== s.key) : [...shown, s.key])} />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="check" style={{ alignSelf: 'center' }}>
              <input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.target.checked)} /> When I move a stage, move the later stages too
            </label>
            <label className="check" style={{ alignSelf: 'center' }}>
              <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Hide finished chapters
            </label>
          </div>
        )}
      </div>

      <Legend
        items={[
          ...STAGES.filter((s) => shown.includes(s.key)).map((s) => ({ label: s.label, color: s.color })),
          { label: 'Chapter deadline ◆', color: 'var(--ink)' },
          { label: 'Today', color: 'var(--critical)', kind: 'line' as const },
          { label: 'Defense', color: 'var(--series-7)', kind: 'line' as const },
        ]}
      />

      <div className="gantt" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div className="gantt-labels">
          <div className="gantt-head" style={{ height: HEAD_H, display: 'flex', alignItems: 'center', padding: '0 14px' }}>
            <span className="gantt-labels-head">Chapter</span>
          </div>
          {chapters.map((c) => {
            const d = display(c);
            const late = d.status !== 'complete' && d.stages.review.end > d.deadline;
            return (
              <div key={c.id} className={`gantt-label${selected === c.id ? ' is-selected' : ''}`} style={{ height: ROW_H }} onClick={() => setSelected(selected === c.id ? null : c.id)}>
                <div className="t" title={c.title}>
                  {chapterLabel(c)}
                </div>
                <div className="s">
                  <span className="dot" style={{ background: CHAPTER_STATUS_COLOR[c.status] }} />
                  {CHAPTER_STATUS_LABEL[c.status]}
                </div>
                <div className="s tnum">
                  Due {fmtDate(d.deadline, { year: false })}
                  {late && (
                    <span className="flag flag-critical" title="Advisor review ends after the deadline">
                      <Icon name="alert" size={11} /> Late
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="gantt-scroll" ref={scrollRef}>
          <div style={{ width, position: 'relative' }}>
            <div className="gantt-head" style={{ height: HEAD_H }}>
              {months.map((m, i) =>
                i % monthEvery === 0 ? (
                  <div key={m} className="gantt-month" style={{ left: X(`${m}-01`) }}>
                    {fmtDate(`${m}-01`).split(' ')[0]}
                    <small>{m.slice(0, 4)}</small>
                  </div>
                ) : null,
              )}
            </div>
            <div style={{ position: 'relative' }}>
              {months.map((m, i) => (i % monthEvery === 0 ? <div key={m} className="gantt-vline" style={{ left: X(`${m}-01`) }} /> : null))}
              {defenseX > 0 && defenseX < width && (
                <div className="gantt-vline" style={{ left: defenseX, borderLeft: '2px solid var(--series-7)' }} title={`Defense ${fmtDate(data.profile.defenseDate)}`} />
              )}
              <div className="gantt-today" style={{ left: X(now) }} />
              {chapters.map((orig) => {
                const c = display(orig);
                const late = c.status !== 'complete' && c.stages.review.end > c.deadline;
                return (
                  <div key={c.id} className={`gantt-row${selected === c.id ? ' is-selected' : ''}`} style={{ height: ROW_H }}>
                    <div className="gantt-deadline-line" style={{ left: X(c.deadline) + pxPerDay / 2 }} />
                    {STAGES.filter((s) => shown.includes(s.key)).map((s) => {
                      const sp = c.stages[s.key];
                      const left = X(sp.start);
                      const w = Math.max(6, (diffDays(sp.end, sp.start) + 1) * pxPerDay);
                      const isDrag = drag?.chapterId === c.id && drag.part === s.key;
                      const text = `${s.label} · ${diffDays(sp.end, sp.start) + 1}d`;
                      const fits = text.length * 6.4 + 16 < w;
                      const done = c.status === 'complete' || (c.status !== 'not_started' && ['drafting', 'revising', 'review'].indexOf(c.status) > ['drafting', 'revising', 'review'].indexOf(s.key));
                      return (
                        <div
                          key={s.key}
                          role="slider"
                          tabIndex={0}
                          aria-label={`${chapterLabel(c)} ${s.label}: ${fmtDate(sp.start)} to ${fmtDate(sp.end)}. Arrow keys move by a day, Shift for a week, Alt to change the end date.`}
                          aria-valuetext={`${fmtDate(sp.start)} to ${fmtDate(sp.end)}`}
                          aria-valuenow={toTime(sp.start)}
                          className={`gantt-bar${isDrag ? ' is-dragging' : ''}${done ? ' is-done' : ''}`}
                          style={{ left, width: w, top: LANE_Y[s.key], background: s.color }}
                          onPointerDown={(e) => onPointerDown(e, orig, { chapterId: c.id, part: s.key, mode: 'move' })}
                          onKeyDown={(e) => onKeyDown(e, orig, s.key)}
                          onPointerEnter={(e) => !drag && setTip({ x: e.clientX, y: e.clientY, text: `${chapterLabel(c)} — ${label(c, { chapterId: c.id, part: s.key, mode: 'move' })}` })}
                          onPointerLeave={() => !drag && setTip(null)}
                        >
                          <span>{fits ? text : ''}</span>
                          <div className="gantt-handle l" onPointerDown={(e) => onPointerDown(e, orig, { chapterId: c.id, part: s.key, mode: 'start' })} aria-hidden="true" />
                          <div className="gantt-handle r" onPointerDown={(e) => onPointerDown(e, orig, { chapterId: c.id, part: s.key, mode: 'end' })} aria-hidden="true" />
                        </div>
                      );
                    })}
                    <div
                      role="slider"
                      tabIndex={0}
                      aria-label={`${chapterLabel(c)} deadline ${fmtDate(c.deadline)}. Arrow keys move by a day, Shift for a week.`}
                      aria-valuetext={fmtDate(c.deadline)}
                      aria-valuenow={toTime(c.deadline)}
                      className={`gantt-deadline${late ? ' is-late' : ''}`}
                      style={{ left: X(c.deadline) + pxPerDay / 2, top: ROW_H / 2 - 12 }}
                      onPointerDown={(e) => onPointerDown(e, orig, { chapterId: c.id, part: 'deadline', mode: 'move' })}
                      onKeyDown={(e) => onKeyDown(e, orig, 'deadline')}
                      onPointerEnter={(e) => !drag && setTip({ x: e.clientX, y: e.clientY, text: `${chapterLabel(c)} — Deadline ${fmtDate(c.deadline)}${late ? ' · review ends after this date' : ''}` })}
                      onPointerLeave={() => !drag && setTip(null)}
                    />
                  </div>
                );
              })}
            </div>
            <div className="gantt-today-label" style={{ left: X(now), top: HEAD_H - 16 }}>
              Today
            </div>
          </div>
        </div>
      </div>
      {chapters.length === 0 && <p className="empty">No chapters to show. Add chapters on the Chapters page.</p>}
      <p className="hint">Changes save automatically. Click a chapter name to type exact dates.</p>

      {selectedChapter && <StageEditor chapter={selectedChapter} onChange={commit} onClose={() => setSelected(null)} />}

      {tip && (
        <div className="drag-tip" style={{ left: tip.x + 14, top: tip.y + 16 }}>
          {tip.text}
        </div>
      )}
    </>
  );
}

function StageEditor({ chapter, onChange, onClose }: { chapter: Chapter; onChange: (c: Chapter) => void; onClose: () => void }) {
  const late = chapter.status !== 'complete' && chapter.stages.review.end > chapter.deadline;
  const setSpan = (k: StageKey, field: 'start' | 'end', v: string) => {
    if (!v) return;
    const next = structuredClone(chapter);
    next.stages[k][field] = v;
    if (next.stages[k].start > next.stages[k].end) return;
    onChange(next);
  };
  return (
    <section className="card detail-panel">
      <div className="card-head">
        <div>
          <h2>{chapter.number === 0 ? chapter.title : `Chapter ${chapter.number}: ${chapter.title}`}</h2>
          <p>
            <Badge color={CHAPTER_STATUS_COLOR[chapter.status]}>{CHAPTER_STATUS_LABEL[chapter.status]}</Badge>{' '}
            {late && (
              <span className="flag flag-critical">
                <Icon name="alert" size={12} /> Advisor review ends {diffDays(chapter.stages.review.end, chapter.deadline)} days after the deadline
              </span>
            )}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close details">
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="stage-edit">
        {STAGES.map((s) => (
          <div key={s.key} style={{ display: 'contents' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
              <span className="legend-swatch" style={{ background: s.color }} />
              {s.label}
            </div>
            <Field label="Start">
              <input className="input" type="date" value={chapter.stages[s.key].start} max={chapter.stages[s.key].end} onChange={(e) => setSpan(s.key, 'start', e.target.value)} />
            </Field>
            <Field label="End">
              <input className="input" type="date" value={chapter.stages[s.key].end} min={chapter.stages[s.key].start} onChange={(e) => setSpan(s.key, 'end', e.target.value)} />
            </Field>
            <span className="muted tnum" style={{ fontSize: 12.5, alignSelf: 'end', paddingBottom: 8 }}>
              {diffDays(chapter.stages[s.key].end, chapter.stages[s.key].start) + 1} days
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>◆ Deadline</div>
        <Field label="Due">
          <input className="input" type="date" value={chapter.deadline} onChange={(e) => e.target.value && onChange({ ...chapter, deadline: e.target.value })} />
        </Field>
      </div>
    </section>
  );
}
