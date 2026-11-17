import { useMemo, useState } from 'react';
import { chapterLabel, sortedChapters, useStore } from '../store';
import type { Chapter, ChapterStatus, WritingSession } from '../types';
import { addDays, fmtDate, inRange, resolveRange, today, type DateFilter } from '../lib/date';
import { fmtNum, fmtPct, uid } from '../lib/format';
import { CHAPTER_STATUSES, CHAPTER_STATUS_COLOR, CHAPTER_STATUS_LABEL, STAGES } from '../lib/labels';
import { downloadCsv } from '../lib/export';
import { Badge, DateRangeField, Empty, Field, Icon, Modal, PageHead, confirmDelete, defaultDateFilter, toast, usePersistentState } from '../components/ui';

export function newChapter(number: number): Chapter {
  const t = today();
  return {
    id: uid('ch'),
    number,
    title: '',
    status: 'not_started',
    wordCount: 0,
    targetWords: 12000,
    deadline: addDays(t, 150),
    stages: {
      drafting: { start: t, end: addDays(t, 75) },
      revising: { start: addDays(t, 76), end: addDays(t, 115) },
      review: { start: addDays(t, 116), end: addDays(t, 140) },
    },
    notes: '',
  };
}

export function Chapters() {
  const { data, upsert, remove, chapterName } = useStore();
  const [editing, setEditing] = useState<Chapter | null>(null);
  const [logging, setLogging] = useState<WritingSession | null>(null);
  const [range, setRange] = usePersistentState<DateFilter>('sessions-range', { ...defaultDateFilter, preset: '90' });
  const [chFilter, setChFilter] = usePersistentState('sessions-chapter', '');
  const [kind, setKind] = usePersistentState('sessions-kind', '');
  const chapters = sortedChapters(data.chapters);
  const now = today();

  const sessions = useMemo(() => {
    const b = resolveRange(range);
    return data.sessions
      .filter((s) => inRange(s.date, b) && (!chFilter || s.chapterId === chFilter) && (!kind || s.kind === kind))
      .sort((a, b2) => b2.date.localeCompare(a.date));
  }, [data.sessions, range, chFilter, kind]);
  const total = sessions.reduce((s, x) => s + x.words, 0);

  const exportChapters = () =>
    downloadCsv(`chapters-${now}.csv`, chapters, [
      { header: 'Number', value: (c) => c.number },
      { header: 'Title', value: (c) => c.title },
      { header: 'Stage', value: (c) => CHAPTER_STATUS_LABEL[c.status] },
      { header: 'Words', value: (c) => c.wordCount },
      { header: 'Target words', value: (c) => c.targetWords },
      ...STAGES.flatMap((s) => [
        { header: `${s.label} start`, value: (c: Chapter) => c.stages[s.key].start },
        { header: `${s.label} end`, value: (c: Chapter) => c.stages[s.key].end },
      ]),
      { header: 'Deadline', value: (c) => c.deadline },
      { header: 'Notes', value: (c) => c.notes },
    ]);

  const exportSessions = () =>
    downloadCsv(`writing-log-${now}.csv`, sessions, [
      { header: 'Date', value: (s) => s.date },
      { header: 'Chapter', value: (s) => chapterName(s.chapterId) },
      { header: 'Kind', value: (s) => s.kind },
      { header: 'Words', value: (s) => s.words },
      { header: 'Minutes', value: (s) => s.minutes },
      { header: 'Note', value: (s) => s.note },
    ]);

  return (
    <>
      <PageHead
        title="Chapters & writing"
        subtitle="Each chapter’s stage, length and deadlines, plus a log of your writing sessions."
        actions={
          <>
            <button className="btn" onClick={exportChapters}>
              <Icon name="download" size={14} /> Chapters CSV
            </button>
            <button className="btn btn-primary" onClick={() => setEditing(newChapter(chapters.length ? Math.max(...chapters.map((c) => c.number)) + 1 : 1))}>
              <Icon name="plus" size={14} /> Add chapter
            </button>
          </>
        }
      />

      <div className="table-wrap" style={{ marginBottom: 28 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Chapter</th>
              <th>Stage</th>
              <th className="num">Words</th>
              <th style={{ width: 160 }}>Progress</th>
              <th>Current stage window</th>
              <th>Deadline</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {chapters.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <Empty>No chapters yet.</Empty>
                </td>
              </tr>
            )}
            {chapters.map((c) => {
              const pct = c.targetWords ? c.wordCount / c.targetWords : 0;
              const stage = c.status === 'drafting' || c.status === 'revising' || c.status === 'review' ? c.stages[c.status] : null;
              const late = c.status !== 'complete' && c.stages.review.end > c.deadline;
              const overdue = c.status !== 'complete' && c.deadline < now;
              return (
                <tr key={c.id}>
                  <td>
                    <div className="cell-title">{c.number === 0 ? c.title : `${c.number}. ${c.title}`}</div>
                    {c.notes && <div className="cell-sub">{c.notes}</div>}
                  </td>
                  <td>
                    <Badge color={CHAPTER_STATUS_COLOR[c.status]}>{CHAPTER_STATUS_LABEL[c.status]}</Badge>
                  </td>
                  <td className="num">
                    {fmtNum(c.wordCount)}
                    <div className="cell-sub">of {fmtNum(c.targetWords)}</div>
                  </td>
                  <td>
                    <div className="meter" style={{ marginTop: 6 }} aria-label={`${fmtPct(pct)} of target`}>
                      <div style={{ width: `${Math.min(100, pct * 100)}%`, background: CHAPTER_STATUS_COLOR[c.status] }} />
                    </div>
                    <div className="cell-sub tnum">{fmtPct(pct)}</div>
                  </td>
                  <td className="tnum">{stage ? `${fmtDate(stage.start, { year: false })} – ${fmtDate(stage.end)}` : '—'}</td>
                  <td className="tnum">
                    {fmtDate(c.deadline)}
                    {(late || overdue) && (
                      <div className="flag flag-critical">
                        <Icon name="alert" size={12} /> {overdue ? 'Past due' : 'Review ends after deadline'}
                      </div>
                    )}
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(structuredClone(c))} aria-label={`Edit ${c.title}`}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm btn-danger"
                      aria-label={`Delete ${c.title}`}
                      onClick={() => confirmDelete(`“${c.title}”`) && remove('chapters', c.id)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <header className="page-head" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 18 }}>Writing log</h2>
          <p>
            {sessions.length} sessions · {fmtNum(total)} words · {fmtNum(sessions.reduce((s, x) => s + x.minutes, 0) / 60)} hours
          </p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={exportSessions}>
            <Icon name="download" size={14} /> Log CSV
          </button>
          <button
            className="btn btn-primary"
            disabled={!chapters.length}
            onClick={() => setLogging({ id: uid('s'), date: now, chapterId: chFilter || chapters.find((c) => c.status === 'drafting' || c.status === 'revising')?.id || chapters[0]?.id || '', words: 500, minutes: 90, kind: 'drafting', note: '' })}
          >
            <Icon name="plus" size={14} /> Log session
          </button>
        </div>
      </header>

      <div className="filters" role="group" aria-label="Writing log filters">
        <DateRangeField value={range} onChange={setRange} />
        <Field label="Chapter">
          <select className="input" value={chFilter} onChange={(e) => setChFilter(e.target.value)}>
            <option value="">All chapters</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {chapterLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kind">
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Drafting & revising</option>
            <option value="drafting">Drafting</option>
            <option value="revising">Revising</option>
          </select>
        </Field>
      </div>

      <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Chapter</th>
              <th>Kind</th>
              <th className="num">Words</th>
              <th className="num">Time</th>
              <th>Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <Empty>No sessions match these filters.</Empty>
                </td>
              </tr>
            )}
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="tnum">{fmtDate(s.date)}</td>
                <td>{chapterName(s.chapterId)}</td>
                <td>
                  <Badge color={s.kind === 'drafting' ? 'var(--series-1)' : 'var(--series-2)'}>{s.kind === 'drafting' ? 'Drafting' : 'Revising'}</Badge>
                </td>
                <td className="num">{fmtNum(s.words)}</td>
                <td className="num">{s.minutes} min</td>
                <td className="ink-2">{s.note}</td>
                <td className="row-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setLogging({ ...s })} aria-label="Edit session">
                    <Icon name="edit" size={14} />
                  </button>
                  <button className="btn btn-ghost btn-sm btn-danger" onClick={() => confirmDelete('this session') && remove('sessions', s.id)} aria-label="Delete session">
                    <Icon name="trash" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ChapterModal
          chapter={editing}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            upsert('chapters', c);
            toast('Chapter saved');
            setEditing(null);
          }}
        />
      )}
      {logging && (
        <SessionModal
          session={logging}
          isNew={!data.sessions.some((s) => s.id === logging.id)}
          chapters={chapters}
          onClose={() => setLogging(null)}
          onSave={(s, addToCount) => {
            upsert('sessions', s);
            const ch = data.chapters.find((c) => c.id === s.chapterId);
            if (addToCount && ch && s.kind === 'drafting') upsert('chapters', { ...ch, wordCount: ch.wordCount + s.words });
            toast('Session logged');
            setLogging(null);
          }}
        />
      )}
    </>
  );
}

function ChapterModal({ chapter, onClose, onSave }: { chapter: Chapter; onClose: () => void; onSave: (c: Chapter) => void }) {
  const [c, setC] = useState(chapter);
  const valid = c.title.trim() && STAGES.every((s) => c.stages[s.key].start <= c.stages[s.key].end);
  return (
    <Modal
      title={chapter.title ? 'Edit chapter' : 'New chapter'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!valid} onClick={() => onSave({ ...c, title: c.title.trim() })}>
            Save chapter
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Number (0 = introduction)">
          <input className="input" type="number" min={0} value={c.number} onChange={(e) => setC({ ...c, number: Number(e.target.value) })} />
        </Field>
        <Field label="Stage">
          <select className="input" value={c.status} onChange={(e) => setC({ ...c, status: e.target.value as ChapterStatus })}>
            {CHAPTER_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title" full>
          <input className="input" value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} placeholder="e.g. The Scrapbook as Archive" />
        </Field>
        <Field label="Current word count">
          <input className="input" type="number" min={0} step={100} value={c.wordCount} onChange={(e) => setC({ ...c, wordCount: Number(e.target.value) })} />
        </Field>
        <Field label="Target words">
          <input className="input" type="number" min={0} step={500} value={c.targetWords} onChange={(e) => setC({ ...c, targetWords: Number(e.target.value) })} />
        </Field>
        {STAGES.map((s) => (
          <div key={s.key} className="full" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={`${s.label} — start`}>
              <input className="input" type="date" value={c.stages[s.key].start} onChange={(e) => setC({ ...c, stages: { ...c.stages, [s.key]: { ...c.stages[s.key], start: e.target.value } } })} />
            </Field>
            <Field label={`${s.label} — end`}>
              <input className="input" type="date" value={c.stages[s.key].end} min={c.stages[s.key].start} onChange={(e) => setC({ ...c, stages: { ...c.stages, [s.key]: { ...c.stages[s.key], end: e.target.value } } })} />
            </Field>
          </div>
        ))}
        <Field label="Chapter deadline">
          <input className="input" type="date" value={c.deadline} onChange={(e) => setC({ ...c, deadline: e.target.value })} />
        </Field>
        <Field label="Notes" full>
          <textarea className="input" value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })} />
        </Field>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>
        Tip: you can also drag these dates directly on the Timeline page.
      </p>
    </Modal>
  );
}

function SessionModal({
  session,
  isNew,
  chapters,
  onClose,
  onSave,
}: {
  session: WritingSession;
  isNew: boolean;
  chapters: Chapter[];
  onClose: () => void;
  onSave: (s: WritingSession, addToCount: boolean) => void;
}) {
  const [s, setS] = useState(session);
  const [add, setAdd] = useState(isNew);
  return (
    <Modal
      title={isNew ? 'Log a writing session' : 'Edit session'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!s.chapterId || !s.date} onClick={() => onSave(s, isNew && add)}>
            Save
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Date">
          <input className="input" type="date" value={s.date} onChange={(e) => setS({ ...s, date: e.target.value })} />
        </Field>
        <Field label="Chapter">
          <select className="input" value={s.chapterId} onChange={(e) => setS({ ...s, chapterId: e.target.value })}>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {chapterLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kind">
          <select className="input" value={s.kind} onChange={(e) => setS({ ...s, kind: e.target.value as WritingSession['kind'] })}>
            <option value="drafting">Drafting (new words)</option>
            <option value="revising">Revising</option>
          </select>
        </Field>
        <Field label="Words">
          <input className="input" type="number" min={0} step={50} value={s.words} onChange={(e) => setS({ ...s, words: Number(e.target.value) })} />
        </Field>
        <Field label="Minutes">
          <input className="input" type="number" min={0} step={15} value={s.minutes} onChange={(e) => setS({ ...s, minutes: Number(e.target.value) })} />
        </Field>
        <Field label="Note">
          <input className="input" value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} placeholder="What did you work on?" />
        </Field>
        {isNew && s.kind === 'drafting' && (
          <label className="check full">
            <input type="checkbox" checked={add} onChange={(e) => setAdd(e.target.checked)} />
            Add these words to the chapter’s word count
          </label>
        )}
      </div>
    </Modal>
  );
}
