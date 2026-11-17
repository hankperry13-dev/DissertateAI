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
import { ChartCard, HBarChart, LineChart, SegmentedBar, StackedColumns, StackedHBar, TipRows } from '../components/charts';
import { DateRangeField, Empty, Field, Icon, PageHead, Stat, defaultDateFilter, usePersistentState } from '../components/ui';

export function Overview() {
  const { data, chapterName } = useStore();
  const [filter, setFilter] = usePersistentState<GlobalFilter>('overview-filter', { range: defaultDateFilter, chapterId: '' });
  const f = useMemo(() => applyFilter(data, filter), [data, filter]);
  const chapters = sortedChapters(f.chapters);
  const now = today();

  /* ---------------- figures ---------------- */
  const words = chapters.reduce((s, c) => s + c.wordCount, 0);
  const target = filter.chapterId ? chapters.reduce((s, c) => s + c.targetWords, 0) : data.profile.targetWords || chapters.reduce((s, c) => s + c.targetWords, 0);
  const complete = chapters.filter((c) => c.status === 'complete').length;
  const inReview = chapters.filter((c) => c.status === 'review').length;
  const loggedWords = f.sessions.reduce((s, x) => s + x.words, 0);
  const loggedMinutes = f.sessions.reduce((s, x) => s + x.minutes, 0);
  const daysToDefense = diffDays(data.profile.defenseDate, now);
  const remaining = Math.max(0, target - words);
  const weeksLeft = Math.max(1, daysToDefense / 7);
  const pending = f.publications.filter((p) => PUB_PENDING.includes(p.status));
  const nextMeeting = data.meetings
    .filter((m) => m.date >= now && (!filter.chapterId || m.chapterIds.includes(filter.chapterId)))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const openItems = f.meetings.flatMap((m) => m.actionItems.filter((a) => !a.done).map((a) => ({ ...a, meeting: m })));

  /* ---------------- chart data ---------------- */
  const progressRows = chapters.map((c) => ({
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
  const usedStatuses = CHAPTER_STATUSES.filter((s) => chapters.some((c) => c.status === s.key));

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

  const milestones = chapters
    .flatMap((c) => [
      ...STAGES.map((s) => ({ id: `${c.id}-${s.key}`, date: c.stages[s.key].end, label: `${s.label} ends`, chapter: c, color: s.color, kind: 'stage' as const })),
      { id: `${c.id}-deadline`, date: c.deadline, label: 'Chapter deadline', chapter: c, color: 'var(--ink)', kind: 'deadline' as const },
    ])
    .filter((m) => m.date >= now && m.chapter.status !== 'complete')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  return (
    <>
      <PageHead
        title={data.profile.dissertationTitle || 'Dissertation overview'}
        subtitle={
          <>
            {[data.profile.department, data.profile.advisor && `Advisor: ${data.profile.advisor}`].filter(Boolean).join(' · ')}
            {data.profile.defenseDate && ` · Defense planned ${fmtDate(data.profile.defenseDate)}`}
          </>
        }
        actions={
          <a className="btn" href="#/reports">
            <Icon name="download" size={14} /> Export report
          </a>
        }
      />

      <div className="filters no-print" role="group" aria-label="Dashboard filters">
        <DateRangeField value={filter.range} onChange={(range) => setFilter({ ...filter, range })} />
        <Field label="Chapter">
          <select className="input" value={filter.chapterId} onChange={(e) => setFilter({ ...filter, chapterId: e.target.value })}>
            <option value="">All chapters</option>
            {sortedChapters(data.chapters).map((c) => (
              <option key={c.id} value={c.id}>
                {chapterLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        {(filter.chapterId || filter.range.preset !== 'all') && (
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }} onClick={() => setFilter({ range: defaultDateFilter, chapterId: '' })}>
            Reset
          </button>
        )}
        <span className="filters-note">Filters apply to every figure and chart below</span>
      </div>

      <div className="stats">
        <Stat hero label={filter.chapterId ? 'Words in this chapter' : 'Words drafted'} value={fmtNum(words)} sub={`${fmtPct(target ? words / target : 0)} of ${fmtNum(target)}-word target`}>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={target} aria-valuenow={words} aria-label="Progress toward word target">
            <div style={{ width: `${Math.min(100, target ? (words / target) * 100 : 0)}%` }} />
          </div>
        </Stat>
        <Stat label="Chapters complete" value={`${complete} of ${chapters.length}`} sub={`${inReview} with advisor`} />
        <Stat label="Words logged" value={fmtCompact(loggedWords)} sub={`${f.sessions.length} sessions · ${fmtNum(loggedMinutes / 60)} hrs`} />
        <Stat label="Pace to finish" value={fmtCompact(remaining / weeksLeft)} sub={daysToDefense > 0 ? `words/week · ${daysToDefense} days to defense` : 'Defense date has passed'} />
        <Stat label="Sources cited" value={f.citations.filter((c) => c.status === 'cited').length} sub={`of ${f.citations.length} in library`} />
        <Stat label="Meetings" value={f.meetings.length} sub={nextMeeting ? `Next: ${fmtDate(nextMeeting.date, { year: false })} · ${nextMeeting.kind}` : 'None scheduled'} />
        <Stat label="Under review" value={pending.length} sub={`${f.publications.filter((p) => p.status === 'published' || p.status === 'accepted').length} accepted or published`} />
      </div>

      <div className="grid grid-12">
        <ChartCard
          className="span-7"
          title="Chapter progress"
          subtitle="Current word count against each chapter’s target, coloured by stage"
          legend={usedStatuses.map((s) => ({ label: s.label, color: s.color }))}
          table={{
            columns: ['Chapter', 'Stage', 'Words', 'Target', '% of target', 'Deadline'],
            numeric: [2, 3, 4],
            rows: chapters.map((c) => [chapterLabel(c), CHAPTER_STATUS_LABEL[c.status], c.wordCount, c.targetWords, fmtPct(c.targetWords ? c.wordCount / c.targetWords : 0), fmtDate(c.deadline)]),
          }}
        >
          {chapters.length ? <HBarChart rows={progressRows} rowHeight={46} barHeight={16} /> : <Empty>No chapters yet — add one on the Chapters page.</Empty>}
        </ChartCard>

        <section className="card span-5">
          <div className="card-head">
            <div>
              <h2>Where the chapters stand</h2>
              <p>Chapters by current stage, and the next milestones</p>
            </div>
            <a className="btn btn-ghost btn-sm no-print" href="#/timeline">
              Timeline
            </a>
          </div>
          {chapters.length > 0 && (
            <SegmentedBar parts={CHAPTER_STATUSES.map((s) => ({ key: s.key, label: s.label, color: s.color, ink: s.key === 'not_started' ? 'var(--neutral-ink)' : undefined, value: chapters.filter((c) => c.status === s.key).length }))} />
          )}
          <div className="list" style={{ marginTop: 12 }}>
            {milestones.length === 0 && <Empty>No upcoming milestones.</Empty>}
            {milestones.map((m) => {
              const late = m.kind === 'deadline' && m.chapter.stages.review.end > m.chapter.deadline;
              return (
                <div className="list-item" key={m.id}>
                  <div className="date-chip">
                    <small>{fmtDate(m.date).split(' ')[0]}</small>
                    <b>{Number(m.date.slice(8))}</b>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="cell-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="dot" style={{ background: m.color }} />
                      {m.label}
                      {late && (
                        <span className="flag flag-critical">
                          <Icon name="alert" size={13} /> Review runs past deadline
                        </span>
                      )}
                    </div>
                    <div className="cell-sub">
                      {chapterLabel(m.chapter)} · {relativeDays(m.date)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <ChartCard
          className="span-8"
          title="Words written over time"
          subtitle="Cumulative words from your writing log in the selected range"
          table={{ columns: ['Date', 'Cumulative words'], numeric: [1], rows: cumulative.map((p) => [fmtDate(p.x), p.y]) }}
        >
          <LineChart series={[{ key: 'cum', label: 'Words written', color: 'var(--series-1)', area: true, points: cumulative }]} />
        </ChartCard>

        <section className="card span-4">
          <div className="card-head">
            <div>
              <h2>Open action items</h2>
              <p>From meetings in the selected range</p>
            </div>
            <a className="btn btn-ghost btn-sm no-print" href="#/meetings">
              Meetings
            </a>
          </div>
          <div className="list">
            {openItems.length === 0 && <Empty>Nothing outstanding.</Empty>}
            {openItems.slice(0, 7).map((a) => {
              const overdue = a.due && a.due < now;
              return (
                <div className="list-item" key={a.id}>
                  <Icon name="check" size={16} />
                  <div style={{ minWidth: 0 }}>
                    <div className="cell-title">{a.text}</div>
                    <div className="cell-sub">
                      {a.meeting.kind} meeting, {fmtDate(a.meeting.date, { year: false })}
                      {a.due && (
                        <>
                          {' · '}
                          {overdue ? (
                            <span className="flag flag-critical">
                              <Icon name="alert" size={12} /> Overdue {fmtDate(a.due, { year: false })}
                            </span>
                          ) : (
                            `due ${fmtDate(a.due, { year: false })}`
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

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
      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
        Showing {filter.chapterId ? chapterName(filter.chapterId) : 'all chapters'} · data as of {fmtDate(now)}.
      </p>
    </>
  );
}
