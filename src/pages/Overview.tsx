import { useMemo } from 'react';
import { chapterLabel, sortedChapters, useStore } from '../store';
import { applyFilter, type GlobalFilter } from '../lib/filters';
import { diffDays, fmtDate, fmtMonth, monthsBetween, monthKey, relativeDays, today } from '../lib/date';
import { fmtCompact, fmtNum, fmtPct } from '../lib/format';
import {
  CHAPTER_STATUSES,
  CHAPTER_STATUS_COLOR,
  CHAPTER_STATUS_LABEL,
  CITATION_STATUSES,
  CITATION_TYPES,
  MEETING_KINDS,
  PUBLICATION_STATUSES,
  PUB_PENDING,
  STAGES,
} from '../lib/labels';
import { ChartCard, HBarChart, LineChart, StackedColumns, StackedHBar, TipRows } from '../components/charts';
import { DateRangeField, Empty, Field, Icon, MoreSection, PageHead, Stat, defaultDateFilter, usePersistentState } from '../components/ui';
import { LogSessionButton } from './Chapters';
import type { ActionItem, Meeting } from '../types';

type Upcoming = { id: string; date: string; title: string; sub: string; color: string; late?: boolean };

/**
 * Home is deliberately short: what's next, what to do, three numbers and one
 * chart. Everything else waits behind "Show more charts".
 */
export function Overview() {
  const { data, upsert } = useStore();
  const now = today();
  const all = sortedChapters(data.chapters);

  /* ---------------- what's next ---------------- */
  const upcoming: Upcoming[] = [
    ...all
      .filter((c) => c.status !== 'complete')
      .flatMap((c) => [
        ...STAGES.map((s) => ({ id: `${c.id}-${s.key}`, date: c.stages[s.key].end, title: `Finish ${s.label.toLowerCase()}`, sub: chapterLabel(c), color: s.color })),
        { id: `${c.id}-dl`, date: c.deadline, title: 'Chapter due', sub: chapterLabel(c), color: 'var(--ink)', late: c.stages.review.end > c.deadline },
      ]),
    ...data.meetings.map((m) => ({ id: m.id, date: m.date, title: `${m.kind} meeting`, sub: m.agenda || m.attendees, color: 'var(--ink-2)' })),
  ]
    .filter((u) => u.date >= now)
    .sort((a, b) => a.date.localeCompare(b.date));
  const next = upcoming[0];
  const after = upcoming.slice(1, 4);

  const todos = data.meetings
    .flatMap((m) => m.actionItems.filter((a) => !a.done).map((a) => ({ a, m })))
    .sort((x, y) => (x.a.due ?? '9999').localeCompare(y.a.due ?? '9999'));
  const tick = (m: Meeting, a: ActionItem) => upsert('meetings', { ...m, actionItems: m.actionItems.map((x) => (x.id === a.id ? { ...x, done: true } : x)) });

  /* ---------------- three numbers ---------------- */
  const totalWords = all.reduce((s, c) => s + c.wordCount, 0);
  const totalTarget = data.profile.targetWords || all.reduce((s, c) => s + c.targetWords, 0);
  const daysToDefense = diffDays(data.profile.defenseDate, now);
  const perWeek = Math.max(0, totalTarget - totalWords) / Math.max(1, daysToDefense / 7);

  /* ---------------- "more charts" slice ---------------- */
  const [filter, setFilter] = usePersistentState<GlobalFilter>('overview-filter', { range: defaultDateFilter, chapterId: '' });
  const f = useMemo(() => applyFilter(data, filter), [data, filter]);
  const chapters = sortedChapters(f.chapters);
  const pending = f.publications.filter((p) => PUB_PENDING.includes(p.status));

  const progressRows = all.map((c) => ({
    id: c.id,
    label: chapterLabel(c),
    value: c.wordCount,
    track: c.targetWords,
    color: CHAPTER_STATUS_COLOR[c.status],
    valueLabel: `${fmtCompact(c.wordCount)} / ${fmtCompact(c.targetWords)}`,
    tip: (
      <TipRows
        title={chapterLabel(c)}
        rows={[
          { color: CHAPTER_STATUS_COLOR[c.status], label: CHAPTER_STATUS_LABEL[c.status], value: `${fmtNum(c.wordCount)} words` },
          { label: 'target', value: fmtNum(c.targetWords) },
          { label: 'of target', value: fmtPct(c.targetWords ? c.wordCount / c.targetWords : 0) },
          { label: 'due', value: fmtDate(c.deadline) },
        ]}
      />
    ),
  }));
  const usedStatuses = CHAPTER_STATUSES.filter((s) => all.some((c) => c.status === s.key));

  const cumulative = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const s of f.sessions) byDay.set(s.date, (byDay.get(s.date) ?? 0) + s.words);
    let acc = 0;
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([x, y]) => ({ x, y: (acc += y) }));
  }, [f.sessions]);

  const monthlyWords = useMemo(() => {
    if (!f.sessions.length) return null;
    const dates = f.sessions.map((s) => s.date).sort();
    const months = monthsBetween(dates[0], dates[dates.length - 1]);
    const by = (kind: 'drafting' | 'revising') => months.map((m) => f.sessions.filter((s) => s.kind === kind && monthKey(s.date) === m).reduce((a, s) => a + s.words, 0));
    return { months, drafting: by('drafting'), revising: by('revising') };
  }, [f.sessions]);

  const citeRows = chapters
    .map((c) => ({
      id: c.id,
      label: chapterLabel(c),
      values: CITATION_STATUSES.map((s) => f.citations.filter((x) => x.chapterIds.includes(c.id) && x.status === s.key).length),
    }))
    .filter((r) => r.values.some((v) => v > 0));

  const typeRows = CITATION_TYPES.map((t) => ({ id: t, label: t, value: f.citations.filter((c) => c.type === t).length, color: 'var(--series-1)' }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const meetingMonths = useMemo(() => {
    if (!f.meetings.length) return null;
    const ds = f.meetings.map((m) => m.date).sort();
    const months = monthsBetween(ds[0], ds[ds.length - 1]);
    return {
      categories: months.map((m) => ({ key: m, label: fmtMonth(`${m}-01`, false), title: fmtMonth(`${m}-01`) })),
      series: MEETING_KINDS.map((k) => ({
        key: k.key,
        label: k.key,
        color: k.color,
        values: months.map((m) => f.meetings.filter((x) => x.kind === k.key && monthKey(x.date) === m).length),
      })),
    };
  }, [f.meetings]);

  const pubRows = PUBLICATION_STATUSES.map((s) => ({
    id: s.key,
    label: s.label,
    value: f.publications.filter((p) => p.status === s.key).length,
    color: s.key === 'rejected' ? 'var(--neutral-mark)' : 'var(--series-1)',
  }));

  return (
    <>
      <PageHead title="Home" subtitle={data.profile.dissertationTitle} actions={<LogSessionButton />} />

      <div className="grid grid-12">
        <section className="card span-7 focus-card" aria-labelledby="next-up">
          <div className="eyebrow" id="next-up">
            Next up
          </div>
          {next ? (
            <>
              <div>
                <div className="countdown">
                  {diffDays(next.date, now) === 0 ? 'Today' : diffDays(next.date, now)}
                  {diffDays(next.date, now) !== 0 && <small>{diffDays(next.date, now) === 1 ? 'day' : 'days'}</small>}
                </div>
                <div className="next-title" style={{ marginTop: 10 }}>
                  {next.title}
                </div>
                <div className="ink-2">
                  {next.sub} · {fmtDate(next.date)}
                </div>
                {next.late && (
                  <div className="flag flag-critical" style={{ marginTop: 6 }}>
                    <Icon name="alert" size={13} /> Advisor review is scheduled to end after this date
                  </div>
                )}
              </div>
              {after.length > 0 && (
                <div>
                  <div className="eyebrow" style={{ marginBottom: 2 }}>
                    After that
                  </div>
                  {after.map((u) => (
                    <div className="list-item" key={u.id} style={{ padding: '7px 0', alignItems: 'center' }}>
                      <span className="dot" style={{ background: u.color }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        {u.title} <span className="muted">· {u.sub}</span>
                      </span>
                      <span className="muted tnum" style={{ whiteSpace: 'nowrap' }}>
                        {relativeDays(u.date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <a href="#/timeline" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
                Open timeline →
              </a>
            </>
          ) : (
            <Empty>Nothing scheduled. Add chapter dates on the Timeline.</Empty>
          )}
        </section>

        <section className="card span-5" aria-labelledby="todo">
          <div className="eyebrow" id="todo" style={{ marginBottom: 4 }}>
            To-do
          </div>
          {todos.length === 0 && <Empty>All done. 🎉</Empty>}
          {todos.slice(0, 5).map(({ a, m }) => (
            <label className="todo" key={a.id}>
              <input type="checkbox" onChange={() => tick(m, a)} />
              <span style={{ minWidth: 0 }}>
                <span className="cell-title">{a.text}</span>
                {a.due && (
                  <span className={`cell-sub${a.due < now ? ' flag flag-critical' : ''}`} style={{ display: 'flex' }}>
                    {a.due < now && <Icon name="alert" size={12} />} {a.due < now ? 'Overdue · ' : 'Due '}
                    {fmtDate(a.due, { year: false })}
                  </span>
                )}
              </span>
            </label>
          ))}
          {todos.length > 5 && (
            <a className="hint" href="#/meetings" style={{ display: 'block' }}>
              +{todos.length - 5} more in Meetings
            </a>
          )}
        </section>
      </div>

      <div className="stats" style={{ marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Stat label="Words drafted" value={fmtNum(totalWords)} sub={`${fmtPct(totalTarget ? totalWords / totalTarget : 0)} of ${fmtNum(totalTarget)} · about ${fmtCompact(perWeek)} words/week to finish`}>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={totalTarget} aria-valuenow={totalWords} aria-label="Progress toward word target">
            <div style={{ width: `${Math.min(100, totalTarget ? (totalWords / totalTarget) * 100 : 0)}%` }} />
          </div>
        </Stat>
        <Stat label="Chapters done" value={`${all.filter((c) => c.status === 'complete').length} of ${all.length}`} sub={`${all.filter((c) => c.status === 'review').length} with your advisor`} />
        <Stat label="Days to defense" value={daysToDefense > 0 ? daysToDefense : '—'} sub={fmtDate(data.profile.defenseDate)} />
      </div>

      <ChartCard
        title="Chapter progress"
        subtitle="Words so far against each chapter’s target"
        legend={usedStatuses.map((s) => ({ label: s.label, color: s.color }))}
        table={{
          columns: ['Chapter', 'Stage', 'Words', 'Target', '% of target', 'Deadline'],
          numeric: [2, 3, 4],
          rows: all.map((c) => [chapterLabel(c), CHAPTER_STATUS_LABEL[c.status], c.wordCount, c.targetWords, fmtPct(c.targetWords ? c.wordCount / c.targetWords : 0), fmtDate(c.deadline)]),
        }}
      >
        {all.length ? <HBarChart rows={progressRows} rowHeight={42} barHeight={16} /> : <Empty>No chapters yet — add one on the Chapters page.</Empty>}
      </ChartCard>

      <MoreSection id="home-charts" label="Show more charts">
        <div className="filters" role="group" aria-label="Chart filters">
          <DateRangeField value={filter.range} onChange={(range) => setFilter({ ...filter, range })} />
          <Field label="Chapter">
            <select className="input" value={filter.chapterId} onChange={(e) => setFilter({ ...filter, chapterId: e.target.value })}>
              <option value="">All chapters</option>
              {all.map((c) => (
                <option key={c.id} value={c.id}>
                  {chapterLabel(c)}
                </option>
              ))}
            </select>
          </Field>
          <span className="filters-note">Applies to the charts below</span>
        </div>
        <div className="grid grid-12">
        <ChartCard
          className="span-12"
          title="Words written over time"
          subtitle="Cumulative words from your writing log in the selected range"
          table={{ columns: ['Date', 'Cumulative words'], numeric: [1], rows: cumulative.map((p) => [fmtDate(p.x), p.y]) }}
        >
          <LineChart series={[{ key: 'cum', label: 'Words written', color: 'var(--series-1)', area: true, points: cumulative }]} />
        </ChartCard>

        <ChartCard
          className="span-6"
          title="Writing by month"
          subtitle="Words logged per month, drafting vs. revising"
          legend={[
            { label: 'Drafting', color: 'var(--series-1)' },
            { label: 'Revising', color: 'var(--series-2)' },
          ]}
          table={monthlyWords ? { columns: ['Month', 'Drafting', 'Revising'], numeric: [1, 2], rows: monthlyWords.months.map((m, i) => [fmtMonth(`${m}-01`), monthlyWords.drafting[i], monthlyWords.revising[i]]) } : undefined}
        >
          {monthlyWords ? (
            <StackedColumns
              categories={monthlyWords.months.map((m) => ({ key: m, label: fmtMonth(`${m}-01`, false), title: fmtMonth(`${m}-01`) }))}
              series={[
                { key: 'd', label: 'Drafting', color: 'var(--series-1)', values: monthlyWords.drafting },
                { key: 'r', label: 'Revising', color: 'var(--series-2)', values: monthlyWords.revising },
              ]}
            />
          ) : (
            <Empty>No writing sessions in this range.</Empty>
          )}
        </ChartCard>

        <ChartCard
          className="span-6"
          title="Meetings per month"
          subtitle="Advisor, committee, workshop and writing-group meetings"
          legend={MEETING_KINDS.map((k) => ({ label: k.key, color: k.color }))}
          table={meetingMonths ? { columns: ['Month', ...MEETING_KINDS.map((k) => k.key)], numeric: [1, 2, 3, 4], rows: meetingMonths.categories.map((c, i) => [c.title, ...meetingMonths.series.map((s) => s.values[i])]) } : undefined}
        >
          {meetingMonths ? <StackedColumns {...meetingMonths} /> : <Empty>No meetings in this range.</Empty>}
        </ChartCard>

        <ChartCard
          className="span-6"
          title="Citations by chapter"
          subtitle="Sources attached to each chapter, by reading status"
          legend={CITATION_STATUSES.map((s) => ({ label: s.label, color: s.color }))}
          table={{ columns: ['Chapter', ...CITATION_STATUSES.map((s) => s.label)], numeric: [1, 2, 3, 4], rows: citeRows.map((r) => [r.label, ...r.values]) }}
        >
          {citeRows.length ? <StackedHBar rows={citeRows} series={CITATION_STATUSES.map((s) => ({ key: s.key, label: s.label, color: s.color }))} /> : <Empty>No citations in this range.</Empty>}
        </ChartCard>

        <ChartCard className="span-6" title="Sources by type" subtitle="What the bibliography is built from" table={{ columns: ['Type', 'Sources'], numeric: [1], rows: typeRows.map((r) => [r.label, r.value]) }}>
          {typeRows.length ? <HBarChart rows={typeRows} labelWidth={150} rowHeight={30} /> : <Empty>No citations in this range.</Empty>}
        </ChartCard>

        <ChartCard
          className="span-12"
          title="Publication pipeline"
          subtitle={`Articles, chapters, papers and reviews by status · ${pending.length} awaiting a decision`}
          table={{ columns: ['Status', 'Items'], numeric: [1], rows: pubRows.map((r) => [r.label, r.value]) }}
        >
          {f.publications.length ? <HBarChart rows={pubRows} labelWidth={150} rowHeight={30} /> : <Empty>No publications in this range.</Empty>}
          {pending.length > 0 && (
            <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
              Longest wait: {(() => {
                const p = [...pending].sort((a, b) => a.submittedOn.localeCompare(b.submittedOn))[0];
                return `“${p.title}” — submitted ${fmtDate(p.submittedOn)} (${diffDays(now, p.submittedOn)} days)`;
              })()}
            </p>
          )}
        </ChartCard>
        </div>
      </MoreSection>
    </>
  );
}
