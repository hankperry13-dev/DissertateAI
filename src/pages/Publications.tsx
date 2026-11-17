import { useMemo, useState } from 'react';
import { chapterLabel, sortedChapters, useStore } from '../store';
import type { Publication, PublicationStatus, PublicationType } from '../types';
import { diffDays, fmtDate, today } from '../lib/date';
import { fmtPct, uid } from '../lib/format';
import { PUBLICATION_STATUSES, PUBLICATION_STATUS_LABEL, PUBLICATION_TYPES, PUB_PENDING } from '../lib/labels';
import { downloadCsv } from '../lib/export';
import { Badge, Empty, Field, FilterPanel, Icon, Menu, Modal, PageHead, confirmDelete, toast, usePersistentState } from '../components/ui';

export function Publications() {
  const { data, upsert, remove, chapterName } = useStore();
  const [view, setView] = usePersistentState<'board' | 'table'>('pub-view', 'board');
  const [q, setQ] = usePersistentState('pub-q', '');
  const [type, setType] = usePersistentState('pub-type', '');
  const [chapter, setChapter] = usePersistentState('pub-ch', '');
  const [editing, setEditing] = useState<Publication | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const now = today();

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return data.publications.filter(
      (p) => (!n || `${p.title} ${p.venue} ${p.coauthors} ${p.notes}`.toLowerCase().includes(n)) && (!type || p.type === type) && (!chapter || p.relatedChapterId === chapter),
    );
  }, [data.publications, q, type, chapter]);

  const decided = rows.filter((p) => ['accepted', 'published', 'rejected'].includes(p.status));
  const wins = decided.filter((p) => p.status !== 'rejected');
  const pending = rows.filter((p) => PUB_PENDING.includes(p.status));

  const exportCsv = () =>
    downloadCsv(`publications-${now}.csv`, rows, [
                  { header: 'Title', value: (p) => p.title },
                  { header: 'Venue', value: (p) => p.venue },
                  { header: 'Type', value: (p) => p.type },
                  { header: 'Status', value: (p) => PUBLICATION_STATUS_LABEL[p.status] },
                  { header: 'Co-authors', value: (p) => p.coauthors },
                  { header: 'Related chapter', value: (p) => (p.relatedChapterId ? chapterName(p.relatedChapterId) : '') },
                  { header: 'Submitted', value: (p) => p.submittedOn },
                  { header: 'Decision', value: (p) => p.decisionOn },
                  { header: 'Notes', value: (p) => p.notes },
                ]);

  const move = (id: string, status: PublicationStatus) => {
    const p = data.publications.find((x) => x.id === id);
    if (!p || p.status === status) return;
    const patch: Partial<Publication> = { status };
    if (status === 'submitted' && !p.submittedOn) patch.submittedOn = now;
    if (['accepted', 'published', 'rejected', 'revise_resubmit'].includes(status) && !p.decisionOn) patch.decisionOn = now;
    upsert('publications', { ...p, ...patch });
    toast(`Moved to ${PUBLICATION_STATUS_LABEL[status]}`);
  };

  return (
    <>
      <PageHead
        title="Publications"
        subtitle="From idea to print. Drag a card to a new column to update it."
        actions={
          <>
            <Menu label="Export" items={[{ label: 'Spreadsheet (CSV)', hint: 'Publications in the current view', onClick: exportCsv }]} />
            <button
              className="btn btn-primary"
              onClick={() => setEditing({ id: uid('p'), title: '', venue: '', type: 'Journal article', status: 'idea', coauthors: '', relatedChapterId: chapter, submittedOn: '', decisionOn: '', notes: '' })}
            >
              <Icon name="plus" size={14} /> Add publication
            </button>
          </>
        }
      />

      <FilterPanel
        active={(type ? 1 : 0) + (chapter ? 1 : 0)}
        onClear={() => {
          setType('');
          setChapter('');
        }}
        lead={
          <>
            <input className="input search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or venue…" aria-label="Search publications" />
            <div className="seg" role="group" aria-label="View">
              <button aria-pressed={view === 'board'} onClick={() => setView('board')}>
                Board
              </button>
              <button aria-pressed={view === 'table'} onClick={() => setView('table')}>
                Table
              </button>
            </div>
          </>
        }
        summary={`${pending.length} awaiting a decision · ${wins.length} accepted or published${decided.length ? ` · ${fmtPct(wins.length / decided.length)} acceptance` : ''}`}
      >
        <Field label="Type">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {PUBLICATION_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Related chapter">
          <select className="input" value={chapter} onChange={(e) => setChapter(e.target.value)}>
            <option value="">Any chapter</option>
            {sortedChapters(data.chapters).map((c) => (
              <option key={c.id} value={c.id}>
                {chapterLabel(c)}
              </option>
            ))}
          </select>
        </Field>
      </FilterPanel>

      {view === 'board' ? (
        <div className="board" role="list" aria-label="Publication pipeline">
          {PUBLICATION_STATUSES.map((s) => {
            const items = rows.filter((p) => p.status === s.key);
            return (
              <div
                key={s.key}
                role="listitem"
                className={`board-col${over === s.key ? ' drop-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(s.key);
                }}
                onDragLeave={() => setOver((o) => (o === s.key ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain') || dragId;
                  if (id) move(id, s.key);
                  setOver(null);
                  setDragId(null);
                }}
              >
                <h3>
                  {s.label} <span className="tnum">{items.length}</span>
                </h3>
                {items.map((p) => (
                  <article
                    key={p.id}
                    className="pub-card"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', p.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDragId(p.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                    onDoubleClick={() => setEditing(structuredClone(p))}
                    style={{ opacity: dragId === p.id ? 0.5 : 1 }}
                  >
                    <div className="t">{p.title}</div>
                    <div className="v">
                      {p.type}
                      {p.venue && ` · ${p.venue}`}
                    </div>
                    {p.submittedOn && PUB_PENDING.includes(p.status) && <div className="v tnum">Submitted {fmtDate(p.submittedOn)} · {diffDays(now, p.submittedOn)} days</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <select
                        className="input"
                        style={{ height: 26, width: 'auto', fontSize: 12 }}
                        value={p.status}
                        aria-label={`Move “${p.title}” to`}
                        onChange={(e) => move(p.id, e.target.value as PublicationStatus)}
                      >
                        {PUBLICATION_STATUSES.map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(structuredClone(p))} aria-label={`Edit ${p.title}`}>
                        <Icon name="edit" size={13} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Decision</th>
                <th>Chapter</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <Empty>No publications match.</Empty>
                  </td>
                </tr>
              )}
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cell-title">{p.title}</div>
                    <div className="cell-sub">
                      {p.venue}
                      {p.coauthors && ` · with ${p.coauthors}`}
                    </div>
                  </td>
                  <td>{p.type}</td>
                  <td>
                    <Badge>{PUBLICATION_STATUS_LABEL[p.status]}</Badge>
                  </td>
                  <td className="tnum">{fmtDate(p.submittedOn)}</td>
                  <td className="tnum">{fmtDate(p.decisionOn)}</td>
                  <td className="ink-2">{p.relatedChapterId ? chapterName(p.relatedChapterId) : '—'}</td>
                  <td className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(structuredClone(p))} aria-label="Edit">
                      <Icon name="edit" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PublicationModal
          pub={editing}
          onClose={() => setEditing(null)}
          onDelete={
            data.publications.some((p) => p.id === editing.id)
              ? () => {
                  if (confirmDelete(`“${editing.title}”`)) {
                    remove('publications', editing.id);
                    setEditing(null);
                  }
                }
              : undefined
          }
          onSave={(p) => {
            upsert('publications', p);
            toast('Publication saved');
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function PublicationModal({ pub, onClose, onSave, onDelete }: { pub: Publication; onClose: () => void; onSave: (p: Publication) => void; onDelete?: () => void }) {
  const { data } = useStore();
  const [p, setP] = useState(pub);
  const set = <K extends keyof Publication>(k: K, v: Publication[K]) => setP({ ...p, [k]: v });
  return (
    <Modal
      title={pub.title ? 'Edit publication' : 'New publication'}
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
          <button className="btn btn-primary" disabled={!p.title.trim()} onClick={() => onSave({ ...p, title: p.title.trim() })}>
            Save
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Title" full>
          <input className="input" value={p.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Venue (journal, press, conference)">
          <input className="input" value={p.venue} onChange={(e) => set('venue', e.target.value)} />
        </Field>
        <Field label="Type">
          <select className="input" value={p.type} onChange={(e) => set('type', e.target.value as PublicationType)}>
            {PUBLICATION_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={p.status} onChange={(e) => set('status', e.target.value as PublicationStatus)}>
            {PUBLICATION_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Related dissertation chapter">
          <select className="input" value={p.relatedChapterId} onChange={(e) => set('relatedChapterId', e.target.value)}>
            <option value="">None</option>
            {sortedChapters(data.chapters).map((c) => (
              <option key={c.id} value={c.id}>
                {chapterLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Submitted on">
          <input className="input" type="date" value={p.submittedOn} onChange={(e) => set('submittedOn', e.target.value)} />
        </Field>
        <Field label="Decision on">
          <input className="input" type="date" value={p.decisionOn} onChange={(e) => set('decisionOn', e.target.value)} />
        </Field>
        <Field label="Co-authors / editors" full>
          <input className="input" value={p.coauthors} onChange={(e) => set('coauthors', e.target.value)} />
        </Field>
        <Field label="Notes (reader reports, deadlines, word limits)" full>
          <textarea className="input" value={p.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
