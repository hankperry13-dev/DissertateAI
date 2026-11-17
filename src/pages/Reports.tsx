import { useMemo, useRef, useState } from 'react';
import { chapterLabel, sortedChapters, useStore } from '../store';
import { applyFilter, describeFilter, type Filtered, type GlobalFilter } from '../lib/filters';
import { diffDays, fmtDate, fmtMonth, monthKey, today, type DateFilter } from '../lib/date';
import { fmtNum, fmtPct } from '../lib/format';
import { CHAPTER_STATUS_LABEL, CITATION_STATUS_LABEL, PUBLICATION_STATUS_LABEL, PUB_PENDING, STAGES } from '../lib/labels';
import { chicago, download, downloadCsv, safeFilename, sortBibliography, toBibtex } from '../lib/export';
import type { AppData } from '../types';
import { DateRangeField, Field, Icon, Menu, PageHead, usePersistentState } from '../components/ui';

type Section = 'summary' | 'chapters' | 'writing' | 'meetings' | 'actions' | 'publications' | 'bibliography';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'summary', label: 'Summary figures' },
  { key: 'chapters', label: 'Chapter status & schedule' },
  { key: 'writing', label: 'Writing log by month' },
  { key: 'meetings', label: 'Meetings & feedback' },
  { key: 'actions', label: 'Open action items' },
  { key: 'publications', label: 'Publications' },
  { key: 'bibliography', label: 'Bibliography (Chicago)' },
];

const PRESETS: { key: string; label: string; sections: Section[]; range: DateFilter }[] = [
  { key: 'advisor', label: 'Monthly advisor update', sections: ['summary', 'chapters', 'writing', 'meetings', 'actions'], range: { preset: '30', start: '', end: '' } },
  { key: 'annual', label: 'Annual progress review', sections: ['summary', 'chapters', 'writing', 'meetings', 'publications'], range: { preset: 'ay', start: '', end: '' } },
  { key: 'committee', label: 'Committee meeting packet', sections: ['summary', 'chapters', 'actions', 'publications'], range: { preset: '90', start: '', end: '' } },
  { key: 'cv', label: 'Publications for CV', sections: ['publications'], range: { preset: 'all', start: '', end: '' } },
  { key: 'bib', label: 'Working bibliography', sections: ['bibliography'], range: { preset: 'all', start: '', end: '' } },
];

interface ReportState {
  filter: GlobalFilter;
  sections: Section[];
  title: string;
}

function monthlyWriting(f: Filtered) {
  const by = new Map<string, { words: number; minutes: number; sessions: number }>();
  for (const s of f.sessions) {
    const k = monthKey(s.date);
    const v = by.get(k) ?? { words: 0, minutes: 0, sessions: 0 };
    v.words += s.words;
    v.minutes += s.minutes;
    v.sessions += 1;
    by.set(k, v);
  }
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function summary(data: AppData, f: Filtered, chapterId: string) {
  const chapters = f.chapters;
  const words = chapters.reduce((s, c) => s + c.wordCount, 0);
  const target = chapterId ? chapters.reduce((s, c) => s + c.targetWords, 0) : data.profile.targetWords;
  return {
    words,
    target,
    complete: chapters.filter((c) => c.status === 'complete').length,
    chapters: chapters.length,
    logged: f.sessions.reduce((s, x) => s + x.words, 0),
    hours: f.sessions.reduce((s, x) => s + x.minutes, 0) / 60,
    meetings: f.meetings.length,
    pending: f.publications.filter((p) => PUB_PENDING.includes(p.status)).length,
    cited: f.citations.filter((c) => c.status === 'cited').length,
    sources: f.citations.length,
  };
}

function toMarkdown(data: AppData, f: Filtered, st: ReportState, chapterName: (id: string) => string): string {
  const L: string[] = [];
  const p = data.profile;
  L.push(`# ${st.title}`, '', `**${p.dissertationTitle}**`, '');
  L.push([p.name, p.department, p.advisor && `Advisor: ${p.advisor}`].filter(Boolean).join(' · '), '');
  L.push(`_${describeFilter(st.filter, chapterName)} · generated ${fmtDate(today())}_`, '');
  const S = summary(data, f, st.filter.chapterId);
  const has = (s: Section) => st.sections.includes(s);
  if (has('summary')) {
    L.push('## Summary', '');
    L.push(`- Words drafted: ${fmtNum(S.words)} of ${fmtNum(S.target)} (${fmtPct(S.target ? S.words / S.target : 0)})`);
    L.push(`- Chapters complete: ${S.complete} of ${S.chapters}`);
    L.push(`- Words logged in period: ${fmtNum(S.logged)} over ${fmtNum(S.hours)} hours`);
    L.push(`- Meetings: ${S.meetings}`);
    L.push(`- Sources: ${S.sources} (${S.cited} cited)`);
    L.push(`- Publications awaiting decision: ${S.pending}`);
    L.push(`- Days to planned defense (${fmtDate(p.defenseDate)}): ${diffDays(p.defenseDate, today())}`, '');
  }
  if (has('chapters')) {
    L.push('## Chapters', '', '| Chapter | Stage | Words | Target | Drafting | Revising | Advisor review | Deadline |', '|---|---|--:|--:|---|---|---|---|');
    for (const c of sortedChapters(f.chapters))
      L.push(
        `| ${chapterLabel(c)} | ${CHAPTER_STATUS_LABEL[c.status]} | ${fmtNum(c.wordCount)} | ${fmtNum(c.targetWords)} | ${STAGES.map((s) => `${c.stages[s.key].start} → ${c.stages[s.key].end}`).join(' | ')} | ${c.deadline} |`,
      );
    L.push('');
  }
  if (has('writing')) {
    L.push('## Writing log by month', '', '| Month | Sessions | Words | Hours |', '|---|--:|--:|--:|');
    for (const [m, v] of monthlyWriting(f)) L.push(`| ${fmtMonth(`${m}-01`)} | ${v.sessions} | ${fmtNum(v.words)} | ${fmtNum(v.minutes / 60)} |`);
    L.push('');
  }
  if (has('meetings')) {
    L.push('## Meetings', '');
    for (const m of [...f.meetings].sort((a, b) => a.date.localeCompare(b.date))) {
      L.push(`### ${fmtDate(m.date)} — ${m.kind} (${m.attendees})`);
      if (m.agenda) L.push(`**Agenda:** ${m.agenda}`);
      if (m.notes) L.push('', m.notes);
      for (const a of m.actionItems) L.push(`- [${a.done ? 'x' : ' '}] ${a.text}${a.due ? ` (due ${a.due})` : ''}`);
      L.push('');
    }
  }
  if (has('actions')) {
    L.push('## Open action items', '');
    const items = f.meetings.flatMap((m) => m.actionItems.filter((a) => !a.done).map((a) => ({ a, m })));
    if (!items.length) L.push('_None._');
    for (const { a, m } of items) L.push(`- [ ] ${a.text}${a.due ? ` — due ${fmtDate(a.due)}` : ''} _(from ${m.kind} meeting, ${fmtDate(m.date)})_`);
    L.push('');
  }
  if (has('publications')) {
    L.push('## Publications', '', '| Title | Venue | Type | Status | Submitted | Decision |', '|---|---|---|---|---|---|');
    for (const x of f.publications) L.push(`| ${x.title} | ${x.venue} | ${x.type} | ${PUBLICATION_STATUS_LABEL[x.status]} | ${x.submittedOn || '—'} | ${x.decisionOn || '—'} |`);
    L.push('');
  }
  if (has('bibliography')) {
    L.push('## Bibliography', '');
    for (const c of sortBibliography(f.citations)) L.push(chicago(c), '');
  }
  return L.join('\n');
}

export function Reports() {
  const { data, chapterName } = useStore();
  const [st, setSt] = usePersistentState<ReportState>('report', {
    filter: { range: PRESETS[0].range, chapterId: '' },
    sections: PRESETS[0].sections,
    title: PRESETS[0].label,
  });
  const f = useMemo(() => applyFilter(data, st.filter), [data, st.filter]);
  const docRef = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState(false);
  const now = today();
  const stem = `${safeFilename(st.title)}-${now}`;

  const downloadHtml = () => {
    const css = `body{font-family:'Iowan Old Style',Palatino,Georgia,serif;max-width:900px;margin:40px auto;padding:0 24px;color:#111;line-height:1.55}
h1{font-size:26px;margin-bottom:4px}h2{font-size:18px;margin:28px 0 8px;padding-bottom:4px;border-bottom:1px solid #ddd}
.meta{color:#555;font-family:system-ui,sans-serif;font-size:12.5px}table{width:100%;border-collapse:collapse;font-family:system-ui,sans-serif;font-size:12.5px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;vertical-align:top}th{background:#f5f5f2}.num{text-align:right}
.bib p{margin:0 0 6px;padding-left:2em;text-indent:-2em}.report-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font-family:system-ui,sans-serif}
.report-kpis div{border:1px solid #e5e5e5;border-radius:8px;padding:10px 12px}.report-kpis b{display:block;font-size:20px}.report-kpis small{color:#555}`;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${st.title.replace(/</g, '&lt;')}</title><style>${css}</style></head><body>${docRef.current?.innerHTML ?? ''}</body></html>`;
    download(`${stem}.html`, html, 'text/html');
  };

  const exportCsvs = () => {
    downloadCsv(`${stem}-chapters.csv`, sortedChapters(f.chapters), [
      { header: 'Chapter', value: (c) => chapterLabel(c) },
      { header: 'Stage', value: (c) => CHAPTER_STATUS_LABEL[c.status] },
      { header: 'Words', value: (c) => c.wordCount },
      { header: 'Target', value: (c) => c.targetWords },
      ...STAGES.flatMap((s) => [
        { header: `${s.label} start`, value: (c: (typeof f.chapters)[number]) => c.stages[s.key].start },
        { header: `${s.label} end`, value: (c: (typeof f.chapters)[number]) => c.stages[s.key].end },
      ]),
      { header: 'Deadline', value: (c) => c.deadline },
    ]);
    setTimeout(
      () =>
        downloadCsv(`${stem}-writing.csv`, f.sessions, [
          { header: 'Date', value: (s) => s.date },
          { header: 'Chapter', value: (s) => chapterName(s.chapterId) },
          { header: 'Kind', value: (s) => s.kind },
          { header: 'Words', value: (s) => s.words },
          { header: 'Minutes', value: (s) => s.minutes },
        ]),
      250,
    );
    setTimeout(
      () =>
        downloadCsv(`${stem}-meetings.csv`, f.meetings, [
          { header: 'Date', value: (m) => m.date },
          { header: 'Kind', value: (m) => m.kind },
          { header: 'Attendees', value: (m) => m.attendees },
          { header: 'Agenda', value: (m) => m.agenda },
          { header: 'Notes', value: (m) => m.notes },
          { header: 'Action items', value: (m) => m.actionItems.map((a) => `${a.done ? '[x]' : '[ ]'} ${a.text}`).join('; ') },
        ]),
      500,
    );
    setTimeout(
      () =>
        downloadCsv(`${stem}-publications.csv`, f.publications, [
          { header: 'Title', value: (p) => p.title },
          { header: 'Venue', value: (p) => p.venue },
          { header: 'Type', value: (p) => p.type },
          { header: 'Status', value: (p) => PUBLICATION_STATUS_LABEL[p.status] },
          { header: 'Submitted', value: (p) => p.submittedOn },
          { header: 'Decision', value: (p) => p.decisionOn },
        ]),
      750,
    );
    setTimeout(
      () =>
        downloadCsv(`${stem}-citations.csv`, f.citations, [
          { header: 'Authors', value: (c) => c.authors },
          { header: 'Title', value: (c) => c.title },
          { header: 'Year', value: (c) => c.year },
          { header: 'Type', value: (c) => c.type },
          { header: 'Status', value: (c) => CITATION_STATUS_LABEL[c.status] },
          { header: 'Chapters', value: (c) => c.chapterIds.map(chapterName).join('; ') },
        ]),
      1000,
    );
  };

  const toggle = (s: Section) => setSt({ ...st, sections: st.sections.includes(s) ? st.sections.filter((x) => x !== s) : SECTIONS.map((x) => x.key).filter((k) => k === s || st.sections.includes(k)) });

  return (
    <>
      <div className="no-print">
        <PageHead title="Reports" subtitle="Pick a template, check the preview, then print or download." />

        <section className="card" style={{ marginBottom: 16 }}>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <Field label="Start from a template">
              <select
                className="input"
                value=""
                onChange={(e) => {
                  const p = PRESETS.find((x) => x.key === e.target.value);
                  if (p) setSt({ filter: { ...st.filter, range: p.range }, sections: p.sections, title: p.label });
                }}
              >
                <option value="">Choose a template…</option>
                {PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Report title">
              <input className="input" value={st.title} onChange={(e) => setSt({ ...st, title: e.target.value })} />
            </Field>
          </div>
          <div className="filters" style={{ border: 0, padding: 0, margin: '14px 0 0', background: 'none' }}>
            <DateRangeField value={st.filter.range} onChange={(range) => setSt({ ...st, filter: { ...st.filter, range } })} />
            <Field label="Chapter">
              <select className="input" value={st.filter.chapterId} onChange={(e) => setSt({ ...st, filter: { ...st.filter, chapterId: e.target.value } })}>
                <option value="">All chapters</option>
                {sortedChapters(data.chapters).map((c) => (
                  <option key={c.id} value={c.id}>
                    {chapterLabel(c)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {custom && (
            <div className="field" style={{ marginTop: 14 }}>
              <span>Sections</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                {SECTIONS.map((s) => (
                  <label className="check" key={s.key}>
                    <input type="checkbox" checked={st.sections.includes(s.key)} onChange={() => toggle(s.key)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Icon name="printer" size={14} /> Print / save as PDF
            </button>
            <Menu
              align="left"
              label="Other formats"
              items={[
                { label: 'Web page (HTML)', hint: 'Opens in any browser; easy to email', onClick: downloadHtml },
                { label: 'Markdown (.md)', hint: 'Paste into Word, Google Docs or notes', onClick: () => download(`${stem}.md`, toMarkdown(data, f, st, chapterName), 'text/markdown') },
                { label: 'Spreadsheets (CSV)', hint: 'One file per section', onClick: exportCsvs },
                { label: 'BibTeX (.bib)', hint: 'Sources in this report', onClick: () => download(`${stem}.bib`, toBibtex(f.citations), 'application/x-bibtex') },
                { label: 'Full backup (JSON)', hint: 'Everything, to restore later', onClick: () => download(`dissertateai-backup-${now}.json`, JSON.stringify(data, null, 2), 'application/json') },
              ]}
            />
            <button className="btn btn-ghost" aria-expanded={custom} onClick={() => setCustom(!custom)} style={{ marginLeft: 'auto' }}>
              {custom ? 'Done choosing sections' : 'Choose sections…'}
            </button>
          </div>
        </section>
        <h2 style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 8px' }}>Preview</h2>
      </div>

      <div className="report" ref={docRef}>
        <ReportDoc data={data} f={f} st={st} chapterName={chapterName} />
      </div>
    </>
  );
}

function ReportDoc({ data, f, st, chapterName }: { data: AppData; f: Filtered; st: ReportState; chapterName: (id: string) => string }) {
  const p = data.profile;
  const has = (s: Section) => st.sections.includes(s);
  const S = summary(data, f, st.filter.chapterId);
  const now = today();
  const openItems = f.meetings.flatMap((m) => m.actionItems.filter((a) => !a.done).map((a) => ({ a, m })));
  return (
    <>
      <h1>{st.title}</h1>
      <div style={{ fontStyle: 'italic' }}>{p.dissertationTitle}</div>
      <div className="meta" style={{ marginTop: 6 }}>
        {[p.name, p.department, p.advisor && `Advisor: ${p.advisor}`, p.committee && `Committee: ${p.committee}`].filter(Boolean).join(' · ')}
        <br />
        {describeFilter(st.filter, chapterName)} · Generated {fmtDate(now)}
      </div>

      {has('summary') && (
        <>
          <h2>Summary</h2>
          <div className="report-kpis">
            <div>
              <b>{fmtNum(S.words)}</b>
              <small>words drafted ({fmtPct(S.target ? S.words / S.target : 0)} of {fmtNum(S.target)})</small>
            </div>
            <div>
              <b>
                {S.complete} / {S.chapters}
              </b>
              <small>chapters complete</small>
            </div>
            <div>
              <b>{fmtNum(S.logged)}</b>
              <small>words logged · {fmtNum(S.hours)} hrs</small>
            </div>
            <div>
              <b>{diffDays(p.defenseDate, now)}</b>
              <small>days to defense ({fmtDate(p.defenseDate)})</small>
            </div>
            <div>
              <b>{S.meetings}</b>
              <small>meetings</small>
            </div>
            <div>
              <b>{openItems.length}</b>
              <small>open action items</small>
            </div>
            <div>
              <b>{S.sources}</b>
              <small>sources ({S.cited} cited)</small>
            </div>
            <div>
              <b>{S.pending}</b>
              <small>publications under review</small>
            </div>
          </div>
        </>
      )}

      {has('chapters') && (
        <>
          <h2>Chapter status & schedule</h2>
          <table>
            <thead>
              <tr>
                <th>Chapter</th>
                <th>Stage</th>
                <th className="num">Words</th>
                {STAGES.map((s) => (
                  <th key={s.key}>{s.label}</th>
                ))}
                <th>Deadline</th>
              </tr>
            </thead>
            <tbody>
              {sortedChapters(f.chapters).map((c) => (
                <tr key={c.id}>
                  <td>{chapterLabel(c)}</td>
                  <td>{CHAPTER_STATUS_LABEL[c.status]}</td>
                  <td className="num">
                    {fmtNum(c.wordCount)} / {fmtNum(c.targetWords)}
                  </td>
                  {STAGES.map((s) => (
                    <td key={s.key}>
                      {fmtDate(c.stages[s.key].start, { year: false })} – {fmtDate(c.stages[s.key].end)}
                    </td>
                  ))}
                  <td>
                    {fmtDate(c.deadline)}
                    {c.status !== 'complete' && c.stages.review.end > c.deadline ? ' ⚠ review runs late' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {has('writing') && (
        <>
          <h2>Writing log by month</h2>
          {f.sessions.length === 0 ? (
            <p>No writing sessions logged in this period.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="num">Sessions</th>
                  <th className="num">Words</th>
                  <th className="num">Hours</th>
                </tr>
              </thead>
              <tbody>
                {monthlyWriting(f).map(([m, v]) => (
                  <tr key={m}>
                    <td>{fmtMonth(`${m}-01`)}</td>
                    <td className="num">{v.sessions}</td>
                    <td className="num">{fmtNum(v.words)}</td>
                    <td className="num">{fmtNum(v.minutes / 60)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {has('meetings') && (
        <>
          <h2>Meetings & feedback</h2>
          {f.meetings.length === 0 && <p>No meetings in this period.</p>}
          {[...f.meetings]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((m) => (
              <div key={m.id} style={{ marginBottom: 12 }}>
                <b>
                  {fmtDate(m.date)} — {m.kind}
                </b>{' '}
                <span className="meta">{m.attendees}</span>
                {m.agenda && (
                  <div>
                    <i>Agenda:</i> {m.agenda}
                  </div>
                )}
                {m.notes && <div>{m.notes}</div>}
                {m.actionItems.length > 0 && (
                  <ul style={{ margin: '4px 0 0' }}>
                    {m.actionItems.map((a) => (
                      <li key={a.id}>
                        {a.done ? '☑' : '☐'} {a.text}
                        {a.due ? ` (due ${fmtDate(a.due)})` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
        </>
      )}

      {has('actions') && (
        <>
          <h2>Open action items</h2>
          {openItems.length === 0 ? (
            <p>None outstanding.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>From</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {openItems.map(({ a, m }) => (
                  <tr key={a.id}>
                    <td>{a.text}</td>
                    <td>
                      {m.kind}, {fmtDate(m.date)}
                    </td>
                    <td>
                      {a.due ? fmtDate(a.due) : '—'}
                      {a.due && a.due < now ? ' (overdue)' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {has('publications') && (
        <>
          <h2>Publications</h2>
          {f.publications.length === 0 ? (
            <p>No publications in this period.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Venue</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {f.publications.map((x) => (
                  <tr key={x.id}>
                    <td>{x.title}</td>
                    <td>{x.venue || '—'}</td>
                    <td>{x.type}</td>
                    <td>{PUBLICATION_STATUS_LABEL[x.status]}</td>
                    <td>{fmtDate(x.submittedOn)}</td>
                    <td>{fmtDate(x.decisionOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {has('bibliography') && (
        <>
          <h2>Bibliography</h2>
          <div className="bib">
            {sortBibliography(f.citations).map((c) => (
              <p key={c.id}>{renderItalics(chicago(c))}</p>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** Turn the `*italic*` markers from `chicago()` into <i> elements (no innerHTML). */
function renderItalics(s: string) {
  return s.split(/\*([^*]+)\*/g).map((part, i) => (i % 2 ? <i key={i}>{part}</i> : part));
}
