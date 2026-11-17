import { useMemo, useState } from 'react';
import { chapterLabel, chapterShort, sortedChapters, useStore } from '../store';
import type { ActionItem, Meeting, MeetingKind } from '../types';
import { type DateFilter, fmtDate, inRange, relativeDays, resolveRange, today } from '../lib/date';
import { uid } from '../lib/format';
import { MEETING_KINDS } from '../lib/labels';
import { download, downloadCsv } from '../lib/export';
import { Badge, ChipSelect, DateRangeField, Empty, Field, FilterPanel, Icon, Menu, Modal, PageHead, confirmDelete, defaultDateFilter, toast, usePersistentState } from '../components/ui';

const KIND_COLOR = Object.fromEntries(MEETING_KINDS.map((k) => [k.key, k.color])) as Record<MeetingKind, string>;

function toIcs(meetings: Meeting[], chapterName: (id: string) => string): string {
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const events = meetings.map((m) => {
    const [h, min] = (m.time || '10:00').split(':');
    const start = `${m.date.replace(/-/g, '')}T${h.padStart(2, '0')}${(min || '00').padStart(2, '0')}00`;
    const endH = String(Math.min(23, Number(h) + 1)).padStart(2, '0');
    const end = `${m.date.replace(/-/g, '')}T${endH}${(min || '00').padStart(2, '0')}00`;
    const desc = [m.agenda && `Agenda: ${m.agenda}`, m.chapterIds.length && `Chapters: ${m.chapterIds.map(chapterName).join(', ')}`, ...m.actionItems.map((a) => `${a.done ? '[x]' : '[ ]'} ${a.text}`)]
      .filter(Boolean)
      .join('\n');
    return ['BEGIN:VEVENT', `UID:${m.id}@dissertateai`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${esc(`${m.kind} meeting — ${m.attendees}`)}`, `DESCRIPTION:${esc(desc)}`, 'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DissertateAI//Meetings//EN', ...events, 'END:VCALENDAR'].join('\r\n');
}

export function Meetings() {
  const { data, upsert, remove, chapterName } = useStore();
  const [range, setRange] = usePersistentState<DateFilter>('meet-range', defaultDateFilter);
  const [kind, setKind] = usePersistentState('meet-kind', '');
  const [chapter, setChapter] = usePersistentState('meet-ch', '');
  const [when, setWhen] = usePersistentState<'all' | 'upcoming' | 'past'>('meet-when', 'all');
  const [openOnly, setOpenOnly] = usePersistentState('meet-open', false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const now = today();
  const chapters = sortedChapters(data.chapters);

  const rows = useMemo(() => {
    const b = resolveRange(range);
    return data.meetings
      .filter(
        (m) =>
          inRange(m.date, b) &&
          (!kind || m.kind === kind) &&
          (!chapter || m.chapterIds.includes(chapter)) &&
          (when === 'all' || (when === 'upcoming' ? m.date >= now : m.date < now)) &&
          (!openOnly || m.actionItems.some((a) => !a.done)),
      )
      .sort((a, b2) => (when === 'upcoming' ? a.date.localeCompare(b2.date) : b2.date.localeCompare(a.date)));
  }, [data.meetings, range, kind, chapter, when, openOnly, now]);

  const items = rows.flatMap((m) => m.actionItems);
  const open = items.filter((a) => !a.done);
  const overdue = open.filter((a) => a.due && a.due < now);
  const upcoming = rows.filter((m) => m.date >= now);

  const exportCsv = () =>
    downloadCsv(`meetings-${now}.csv`, rows, [
                  { header: 'Date', value: (m) => m.date },
                  { header: 'Time', value: (m) => m.time },
                  { header: 'Kind', value: (m) => m.kind },
                  { header: 'Attendees', value: (m) => m.attendees },
                  { header: 'Chapters', value: (m) => m.chapterIds.map(chapterName).join('; ') },
                  { header: 'Agenda', value: (m) => m.agenda },
                  { header: 'Notes', value: (m) => m.notes },
                  { header: 'Open action items', value: (m) => m.actionItems.filter((a) => !a.done).map((a) => a.text).join('; ') },
                  { header: 'Completed action items', value: (m) => m.actionItems.filter((a) => a.done).map((a) => a.text).join('; ') },
                ]);

  const toggle = (m: Meeting, a: ActionItem) => upsert('meetings', { ...m, actionItems: m.actionItems.map((x) => (x.id === a.id ? { ...x, done: !x.done } : x)) });

  return (
    <>
      <PageHead
        title="Meetings"
        subtitle="Notes and action items from every meeting."
        actions={
          <>
            <Menu
              label="Export"
              items={[
                { label: 'Spreadsheet (CSV)', hint: 'Meetings in the current view', onClick: exportCsv },
                { label: 'Add to calendar (.ics)', hint: upcoming.length ? `${upcoming.length} upcoming meetings` : 'No upcoming meetings', disabled: !upcoming.length, onClick: () => download(`meetings-${now}.ics`, toIcs(upcoming, chapterName), 'text/calendar') },
              ]}
            />
            <button
              className="btn btn-primary"
              onClick={() => setEditing({ id: uid('m'), date: now, time: '10:00', kind: 'Advisor', attendees: data.profile.advisor, chapterIds: chapter ? [chapter] : [], agenda: '', notes: '', actionItems: [] })}
            >
              <Icon name="plus" size={14} /> Add meeting
            </button>
          </>
        }
      />

      <FilterPanel
        active={(range.preset !== 'all' ? 1 : 0) + (kind ? 1 : 0) + (chapter ? 1 : 0) + (openOnly ? 1 : 0)}
        onClear={() => {
          setRange(defaultDateFilter);
          setKind('');
          setChapter('');
          setOpenOnly(false);
        }}
        lead={
          <div className="seg" role="group" aria-label="Show">
            {(['upcoming', 'past', 'all'] as const).map((w) => (
              <button key={w} aria-pressed={when === w} onClick={() => setWhen(w)}>
                {w === 'all' ? 'All' : w === 'upcoming' ? 'Upcoming' : 'Past'}
              </button>
            ))}
          </div>
        }
        summary={
          <>
            {rows.length} meetings · {open.length} open action items
            {overdue.length > 0 && (
              <span className="flag flag-critical" style={{ marginLeft: 8 }}>
                <Icon name="alert" size={12} /> {overdue.length} overdue
              </span>
            )}
          </>
        }
      >
        <DateRangeField value={range} onChange={setRange} />
        <Field label="Kind">
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All kinds</option>
            {MEETING_KINDS.map((k) => (
              <option key={k.key}>{k.key}</option>
            ))}
          </select>
        </Field>
        <Field label="Chapter">
          <select className="input" value={chapter} onChange={(e) => setChapter(e.target.value)}>
            <option value="">All chapters</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {chapterLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <label className="check" style={{ alignSelf: 'center' }}>
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Only with open action items
        </label>
      </FilterPanel>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Meeting</th>
              <th>Notes</th>
              <th>Action items</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <Empty>No meetings match these filters.</Empty>
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="tnum" style={{ whiteSpace: 'nowrap' }}>
                  <div className="cell-title">{fmtDate(m.date)}</div>
                  <div className="cell-sub">
                    {m.time} · {relativeDays(m.date)}
                  </div>
                </td>
                <td style={{ minWidth: 200 }}>
                  <Badge color={KIND_COLOR[m.kind]}>{m.kind}</Badge>
                  <div style={{ marginTop: 4 }}>{m.attendees}</div>
                  {m.agenda && <div className="cell-sub">{m.agenda}</div>}
                  {m.chapterIds.map((id) => (
                    <span className="tag" key={id} title={chapterName(id)}>
                      {chapterShort(data.chapters, id)}
                    </span>
                  ))}
                </td>
                <td className="ink-2" style={{ maxWidth: 320 }}>
                  {m.notes || <span className="muted">—</span>}
                </td>
                <td style={{ minWidth: 220 }}>
                  {m.actionItems.length === 0 && <span className="muted">—</span>}
                  {m.actionItems
                    .filter((a) => !a.done)
                    .map((a) => (
                      <label key={a.id} className="check" style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 4 }}>
                        <input type="checkbox" checked={false} onChange={() => toggle(m, a)} style={{ marginTop: 3 }} />
                        <span>
                          {a.text}
                          {a.due && (
                            <span className={`cell-sub${a.due < now ? ' flag flag-critical' : ''}`} style={{ marginLeft: 6 }}>
                              {a.due < now && <Icon name="alert" size={11} />} due {fmtDate(a.due, { year: false })}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  {m.actionItems.some((a) => a.done) && (
                    <span className="cell-sub" title={m.actionItems.filter((a) => a.done).map((a) => a.text).join('\n')}>
                      <Icon name="check" size={12} /> {m.actionItems.filter((a) => a.done).length} done
                    </span>
                  )}
                </td>
                <td className="row-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(structuredClone(m))} aria-label="Edit meeting">
                    <Icon name="edit" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <MeetingModal
          meeting={editing}
          onClose={() => setEditing(null)}
          onDelete={
            data.meetings.some((m) => m.id === editing.id)
              ? () => {
                  if (confirmDelete('this meeting')) {
                    remove('meetings', editing.id);
                    setEditing(null);
                  }
                }
              : undefined
          }
          onSave={(m) => {
            upsert('meetings', m);
            toast('Meeting saved');
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function MeetingModal({ meeting, onClose, onSave, onDelete }: { meeting: Meeting; onClose: () => void; onSave: (m: Meeting) => void; onDelete?: () => void }) {
  const { data } = useStore();
  const [m, setM] = useState(meeting);
  const [draft, setDraft] = useState('');
  const set = <K extends keyof Meeting>(k: K, v: Meeting[K]) => setM({ ...m, [k]: v });
  const addItem = () => {
    if (!draft.trim()) return;
    set('actionItems', [...m.actionItems, { id: uid('a'), text: draft.trim(), done: false }]);
    setDraft('');
  };
  return (
    <Modal
      title={data.meetings.some((x) => x.id === meeting.id) ? 'Edit meeting' : 'New meeting'}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={onDelete}>
              <Icon name="trash" size={14} /> Delete
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!m.date} onClick={() => onSave(draft.trim() ? { ...m, actionItems: [...m.actionItems, { id: uid('a'), text: draft.trim(), done: false }] } : m)}>
            Save meeting
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Date">
          <input className="input" type="date" value={m.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Time">
          <input className="input" type="time" value={m.time} onChange={(e) => set('time', e.target.value)} />
        </Field>
        <Field label="Kind">
          <select className="input" value={m.kind} onChange={(e) => set('kind', e.target.value as MeetingKind)}>
            {MEETING_KINDS.map((k) => (
              <option key={k.key}>{k.key}</option>
            ))}
          </select>
        </Field>
        <Field label="With">
          <input className="input" value={m.attendees} onChange={(e) => set('attendees', e.target.value)} />
        </Field>
        <Field label="Agenda" full>
          <input className="input" value={m.agenda} onChange={(e) => set('agenda', e.target.value)} />
        </Field>
        <div className="field full">
          <span>Chapters discussed</span>
          <ChipSelect options={sortedChapters(data.chapters).map((c) => ({ value: c.id, label: chapterLabel(c) }))} value={m.chapterIds} onChange={(v) => set('chapterIds', v)} />
        </div>
        <Field label="Notes & feedback" full>
          <textarea className="input" value={m.notes} onChange={(e) => set('notes', e.target.value)} rows={4} />
        </Field>
        <div className="field full">
          <span>Action items</span>
          {m.actionItems.map((a, i) => (
            <div key={a.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 150px auto', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={a.done} aria-label="Done" onChange={() => set('actionItems', m.actionItems.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} />
              <input className="input" value={a.text} onChange={(e) => set('actionItems', m.actionItems.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              <input className="input" type="date" value={a.due ?? ''} aria-label="Due date" onChange={(e) => set('actionItems', m.actionItems.map((x, j) => (j === i ? { ...x, due: e.target.value || undefined } : x)))} />
              <button className="btn btn-ghost btn-sm btn-danger" onClick={() => set('actionItems', m.actionItems.filter((_, j) => j !== i))} aria-label="Remove item">
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={draft} placeholder="Add an action item and press Enter" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())} />
            <button className="btn" onClick={addItem}>
              Add
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
