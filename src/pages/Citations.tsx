import { useMemo, useState } from 'react';
import { chapterLabel, chapterShort, sortedChapters, useStore } from '../store';
import type { Citation, CitationStatus, CitationType } from '../types';
import { today } from '../lib/date';
import { uid } from '../lib/format';
import { CITATION_STATUSES, CITATION_STATUS_LABEL, CITATION_TYPES } from '../lib/labels';
import { chicago, download, downloadCsv, sortBibliography, toBibtex } from '../lib/export';
import { Badge, ChipSelect, Empty, Field, FilterPanel, Icon, Menu, Modal, PageHead, confirmDelete, toast, usePersistentState } from '../components/ui';

type SortKey = 'authors' | 'year' | 'title' | 'addedOn';

const blank = (): Citation => ({
  id: uid('c'),
  authors: '',
  title: '',
  year: '',
  type: 'Monograph',
  container: '',
  volume: '',
  publisher: '',
  place: '',
  pages: '',
  chapterIds: [],
  status: 'to_read',
  tags: [],
  notes: '',
  addedOn: today(),
});

export function Citations() {
  const { data, upsert, remove, chapterName } = useStore();
  const [q, setQ] = usePersistentState('cite-q', '');
  const [chapter, setChapter] = usePersistentState('cite-ch', '');
  const [type, setType] = usePersistentState('cite-type', '');
  const [status, setStatus] = usePersistentState('cite-status', '');
  const [tag, setTag] = usePersistentState('cite-tag', '');
  const [sort, setSort] = usePersistentState<{ key: SortKey; dir: 1 | -1 }>('cite-sort', { key: 'authors', dir: 1 });
  const [editing, setEditing] = useState<Citation | null>(null);
  const chapters = sortedChapters(data.chapters);
  const allTags = useMemo(() => [...new Set(data.citations.flatMap((c) => c.tags))].sort(), [data.citations]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.citations
      .filter(
        (c) =>
          (!needle || [c.authors, c.title, c.container, c.publisher, c.notes, c.tags.join(' ')].join(' ').toLowerCase().includes(needle)) &&
          (!chapter || (chapter === '_none' ? c.chapterIds.length === 0 : c.chapterIds.includes(chapter))) &&
          (!type || c.type === type) &&
          (!status || c.status === status) &&
          (!tag || c.tags.includes(tag)),
      )
      .sort((a, b) => sort.dir * String(a[sort.key]).localeCompare(String(b[sort.key]), undefined, { numeric: true }));
  }, [data.citations, q, chapter, type, status, tag, sort]);

  const fileStem = `citations-${today()}`;
  const exportCsv = () =>
    downloadCsv(`${fileStem}.csv`, rows, [
                  { header: 'Authors', value: (c) => c.authors },
                  { header: 'Title', value: (c) => c.title },
                  { header: 'Year', value: (c) => c.year },
                  { header: 'Type', value: (c) => c.type },
                  { header: 'Journal / collection', value: (c) => c.container },
                  { header: 'Volume', value: (c) => c.volume },
                  { header: 'Publisher', value: (c) => c.publisher },
                  { header: 'Place', value: (c) => c.place },
                  { header: 'Pages', value: (c) => c.pages },
                  { header: 'Chapters', value: (c) => c.chapterIds.map(chapterName).join('; ') },
                  { header: 'Status', value: (c) => CITATION_STATUS_LABEL[c.status] },
                  { header: 'Tags', value: (c) => c.tags.join('; ') },
                  { header: 'Notes', value: (c) => c.notes },
                  { header: 'Added', value: (c) => c.addedOn },
                ]);
  const header = (key: SortKey, label: string) => (
    <th aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      <button onClick={() => setSort({ key, dir: sort.key === key ? ((-sort.dir) as 1 | -1) : 1 })}>
        {label} {sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : ''}
      </button>
    </th>
  );

  return (
    <>
      <PageHead
        title="Citations"
        subtitle="Your working bibliography, linked to chapters."
        actions={
          <>
            <Menu
              label="Export"
              items={[
                { label: 'Chicago bibliography', hint: 'Markdown, sorted by author', onClick: () => download(`${fileStem}-chicago.md`, `# Bibliography\n\n${sortBibliography(rows).map((c) => chicago(c)).join('\n\n')}\n`, 'text/markdown') },
                { label: 'BibTeX (.bib)', hint: 'For Zotero, LaTeX, etc.', onClick: () => download(`${fileStem}.bib`, toBibtex(rows), 'application/x-bibtex') },
                { label: 'Spreadsheet (CSV)', onClick: exportCsv },
              ]}
            />
            <button className="btn btn-primary" onClick={() => setEditing({ ...blank(), chapterIds: chapter && chapter !== '_none' ? [chapter] : [] })}>
              <Icon name="plus" size={14} /> Add source
            </button>
          </>
        }
      />

      <FilterPanel
        active={[chapter, type, status, tag].filter(Boolean).length}
        onClear={() => {
          setChapter('');
          setType('');
          setStatus('');
          setTag('');
        }}
        lead={<input className="input search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search author, title, tag…" aria-label="Search citations" />}
        summary={`${rows.length} of ${data.citations.length} sources`}
      >
        <Field label="Chapter">
          <select className="input" value={chapter} onChange={(e) => setChapter(e.target.value)}>
            <option value="">All chapters</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {chapterLabel(c)}
              </option>
            ))}
            <option value="_none">Not yet assigned</option>
          </select>
        </Field>
        <Field label="Type">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {CITATION_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            {CITATION_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tag">
          <select className="input" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Any tag</option>
            {allTags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      </FilterPanel>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {header('authors', 'Author')}
              {header('title', 'Title')}
              {header('year', 'Year')}
              <th>Type</th>
              <th>Chapters</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <Empty>{data.citations.length ? 'No sources match these filters.' : 'No sources yet — add your first one.'}</Empty>
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{c.authors || '—'}</td>
                <td>
                  <div className="cell-title">
                    <em>{c.title}</em>
                  </div>
                  <div className="cell-sub">{[c.container, c.volume, c.publisher, c.place].filter(Boolean).join(' · ')}</div>
                </td>
                <td className="tnum">{c.year}</td>
                <td>{c.type}</td>
                <td className="ink-2" style={{ fontSize: 12.5 }}>
                  {c.chapterIds.length ? c.chapterIds.map((id) => <span className="tag" key={id} title={chapterName(id)}>{chapterShort(data.chapters, id)}</span>) : '—'}
                </td>
                <td>
                  <select
                    className="input"
                    style={{ height: 28, width: 'auto', fontSize: 12.5 }}
                    value={c.status}
                    aria-label={`Status of ${c.title}`}
                    onChange={(e) => upsert('citations', { ...c, status: e.target.value as CitationStatus })}
                  >
                    {CITATION_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="row-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(structuredClone(c))} aria-label={`Edit ${c.title}`}>
                    <Icon name="edit" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <CitationModal
          citation={editing}
          onClose={() => setEditing(null)}
          onDelete={
            data.citations.some((c) => c.id === editing.id)
              ? () => {
                  if (confirmDelete(`“${editing.title}”`)) {
                    remove('citations', editing.id);
                    setEditing(null);
                  }
                }
              : undefined
          }
          onSave={(c) => {
            upsert('citations', c);
            toast('Source saved');
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function CitationModal({ citation, onClose, onSave, onDelete }: { citation: Citation; onClose: () => void; onSave: (c: Citation) => void; onDelete?: () => void }) {
  const { data } = useStore();
  const [c, setC] = useState(citation);
  const [tags, setTags] = useState(citation.tags.join(', '));
  const set = <K extends keyof Citation>(k: K, v: Citation[K]) => setC({ ...c, [k]: v });
  const containerLabel =
    c.type === 'Journal article' ? 'Journal' : c.type === 'Book chapter' ? 'Book title' : c.type === 'Archival source' ? 'Archive / collection' : 'Series / collection';
  const preview = chicago({ ...c, tags: [] }, (s) => s);

  return (
    <Modal
      title={citation.title ? 'Edit source' : 'Add source'}
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
          <button
            className="btn btn-primary"
            disabled={!c.title.trim()}
            onClick={() =>
              onSave({
                ...c,
                title: c.title.trim(),
                tags: tags
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          >
            Save source
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Author(s) — Last, First; separate with semicolons" full>
          <input className="input" value={c.authors} onChange={(e) => set('authors', e.target.value)} placeholder="Steedman, Carolyn" />
        </Field>
        <Field label="Title" full>
          <input className="input" value={c.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Type">
          <select className="input" value={c.type} onChange={(e) => set('type', e.target.value as CitationType)}>
            {CITATION_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Year">
          <input className="input" value={c.year} onChange={(e) => set('year', e.target.value)} inputMode="numeric" />
        </Field>
        <Field label={containerLabel}>
          <input className="input" value={c.container} onChange={(e) => set('container', e.target.value)} />
        </Field>
        {c.type === 'Journal article' ? (
          <Field label="Volume, issue">
            <input className="input" value={c.volume} onChange={(e) => set('volume', e.target.value)} placeholder="12, no. 2" />
          </Field>
        ) : (
          <Field label="Publisher">
            <input className="input" value={c.publisher} onChange={(e) => set('publisher', e.target.value)} />
          </Field>
        )}
        <Field label="Place of publication">
          <input className="input" value={c.place} onChange={(e) => set('place', e.target.value)} />
        </Field>
        <Field label="Pages">
          <input className="input" value={c.pages} onChange={(e) => set('pages', e.target.value)} />
        </Field>
        <Field label="Status">
          <select className="input" value={c.status} onChange={(e) => set('status', e.target.value as CitationStatus)}>
            {CITATION_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tags (comma-separated)">
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="archive theory, method" />
        </Field>
        <div className="field full">
          <span>Used in chapters</span>
          <ChipSelect options={sortedChapters(data.chapters).map((ch) => ({ value: ch.id, label: chapterLabel(ch) }))} value={c.chapterIds} onChange={(v) => set('chapterIds', v)} />
        </div>
        <Field label="Notes" full>
          <textarea className="input" value={c.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Key arguments, page references, where it fits…" />
        </Field>
      </div>
      {c.title && (
        <div style={{ marginTop: 14 }}>
          <Badge>Chicago preview</Badge>
          <p style={{ fontFamily: 'var(--serif)', margin: '6px 0 0', paddingLeft: '2em', textIndent: '-2em' }}>{preview}</p>
        </div>
      )}
    </Modal>
  );
}
