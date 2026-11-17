import { useEffect, useRef, useState } from 'react';
import { chapterLabel, sortedChapters, useStore } from '../store';
import type { GanttUpload } from '../types';
import { fileStore } from '../lib/idb';
import { fmtBytes, uid } from '../lib/format';
import { download } from '../lib/export';
import { fmtDate } from '../lib/date';
import { Empty, Field, Icon, Modal, confirmDelete, toast, usePersistentState } from '../components/ui';

const MAX_BYTES = 40 * 1024 * 1024;
const ACCEPT = 'image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.mpp,.gan,.xlsx,.xls,.csv,.html,.htm';
const SOURCES = ['', 'Microsoft Project', 'GanttProject', 'TeamGantt', 'Office Timeline', 'Excel / Google Sheets', 'Notion', 'Asana', 'Monday.com', 'Smartsheet', 'OmniPlan', 'Other'];

const isImage = (m: string) => m.startsWith('image/');
const isPdf = (m: string, n: string) => m === 'application/pdf' || n.toLowerCase().endsWith('.pdf');

function useBlobUrl(id: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    let u: string | null = null;
    fileStore
      .get(id)
      .then((b) => {
        if (b && live) {
          u = URL.createObjectURL(b);
          setUrl(u);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]);
  return url;
}

export function GanttUploads() {
  const { data, uploads, setUploads, chapterName } = useStore();
  const [chapterFor, setChapterFor] = useState('');
  const [filter, setFilter] = usePersistentState('uploads-ch', '');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<GanttUpload | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chapters = sortedChapters(data.chapters);

  const addFiles = async (files: File[]) => {
    const ok = files.filter((f) => f.size <= MAX_BYTES);
    if (ok.length < files.length) window.alert(`Skipped ${files.length - ok.length} file(s) over ${fmtBytes(MAX_BYTES)}.`);
    if (!ok.length) return;
    setBusy(true);
    try {
      const metas: GanttUpload[] = [];
      for (const f of ok) {
        const id = uid('g');
        await fileStore.put(id, f);
        metas.push({ id, name: f.name || 'Pasted image.png', mime: f.type || 'application/octet-stream', size: f.size, chapterId: chapterFor, note: '', source: '', uploadedAt: new Date().toISOString() });
      }
      setUploads((u) => [...metas, ...u]);
      toast(`${metas.length} file${metas.length > 1 ? 's' : ''} uploaded`);
    } catch (e) {
      window.alert(`Upload failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  // Paste a screenshot of a Gantt chart straight from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const update = (id: string, patch: Partial<GanttUpload>) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const del = async (g: GanttUpload) => {
    if (!confirmDelete(`“${g.name}”`)) return;
    await fileStore.remove(g.id).catch(() => undefined);
    setUploads((u) => u.filter((x) => x.id !== g.id));
  };

  const save = async (g: GanttUpload) => {
    const b = await fileStore.get(g.id);
    if (b) download(g.name, b);
    else toast('File not found in this browser');
  };

  const shown = uploads.filter((u) => !filter || (filter === '_none' ? !u.chapterId : u.chapterId === filter));

  return (
    <>
      <div
        className={`dropzone${over ? ' is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          addFiles([...e.dataTransfer.files]);
        }}
      >
        <Icon name="upload" size={26} />
        <h3>Drop Gantt charts here</h3>
        <p className="ink-2" style={{ margin: '0 0 14px' }}>
          Exports from Microsoft Project, GanttProject, TeamGantt, Office Timeline, Excel and others — PNG, JPG, SVG and PDF preview here; .mpp, .gan, .xlsx and .csv
          are stored for download. You can also paste a screenshot (Ctrl/⌘+V).
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Attach to chapter">
            <select className="input" value={chapterFor} onChange={(e) => setChapterFor(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Whole dissertation</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {chapterLabel(c)}
                </option>
              ))}
            </select>
          </Field>
          <button className="btn btn-primary" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Icon name="plus" size={14} /> {busy ? 'Uploading…' : 'Choose files'}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            addFiles([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <p className="muted" style={{ fontSize: 12, margin: '12px 0 0' }}>
          Files are stored privately in this browser (IndexedDB), up to {fmtBytes(MAX_BYTES)} each.
        </p>
      </div>

      <div className="filters" style={{ marginTop: 18 }} role="group" aria-label="Upload filters">
        <Field label="Show">
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All uploads</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {chapterLabel(c)}
              </option>
            ))}
            <option value="_none">Whole dissertation</option>
          </select>
        </Field>
        <span className="filters-note">
          {shown.length} of {uploads.length} files
        </span>
      </div>

      {shown.length === 0 ? (
        <Empty>{uploads.length ? 'No uploads for this chapter.' : 'No Gantt charts uploaded yet.'}</Empty>
      ) : (
        <div className="uploads">
          {shown.map((g) => (
            <UploadCard
              key={g.id}
              g={g}
              chapterOptions={chapters.map((c) => ({ id: c.id, label: chapterLabel(c) }))}
              onView={() => setViewing(g)}
              onSave={() => save(g)}
              onDelete={() => del(g)}
              onChange={(patch) => update(g.id, patch)}
            />
          ))}
        </div>
      )}

      {viewing && <Viewer g={viewing} title={`${viewing.name}${viewing.chapterId ? ` · ${chapterName(viewing.chapterId)}` : ''}`} onClose={() => setViewing(null)} onSave={() => save(viewing)} />}
    </>
  );
}

function UploadCard({
  g,
  chapterOptions,
  onView,
  onSave,
  onDelete,
  onChange,
}: {
  g: GanttUpload;
  chapterOptions: { id: string; label: string }[];
  onView: () => void;
  onSave: () => void;
  onDelete: () => void;
  onChange: (p: Partial<GanttUpload>) => void;
}) {
  const url = useBlobUrl(isImage(g.mime) ? g.id : null);
  const ext = g.name.split('.').pop()?.toUpperCase() ?? 'FILE';
  return (
    <article className="card upload-card">
      <button className="upload-thumb" onClick={onView} aria-label={`Open ${g.name}`}>
        {url ? (
          <img src={url} alt={`Gantt chart: ${g.name}`} />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--ink-2)' }}>
            <Icon name="file" size={36} />
            <div style={{ fontWeight: 600, marginTop: 4 }}>{isPdf(g.mime, g.name) ? 'PDF' : ext}</div>
          </div>
        )}
      </button>
      <div className="upload-meta">
        <div>
          <div className="cell-title" style={{ wordBreak: 'break-word' }}>
            {g.name}
          </div>
          <div className="cell-sub">
            {fmtBytes(g.size)} · uploaded {fmtDate(g.uploadedAt.slice(0, 10))}
          </div>
        </div>
        <select className="input" value={g.chapterId} onChange={(e) => onChange({ chapterId: e.target.value })} aria-label="Chapter">
          <option value="">Whole dissertation</option>
          {chapterOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select className="input" value={g.source} onChange={(e) => onChange({ source: e.target.value })} aria-label="Made with">
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s ? `Made with ${s}` : 'Made with… (optional)'}
            </option>
          ))}
        </select>
        <input className="input" value={g.note} placeholder="Note (version, what changed)" onChange={(e) => onChange({ note: e.target.value })} aria-label="Note" />
        <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
          <button className="btn btn-sm" onClick={onView}>
            Open
          </button>
          <button className="btn btn-sm" onClick={onSave}>
            <Icon name="download" size={13} /> Download
          </button>
          <button className="btn btn-sm btn-ghost btn-danger" style={{ marginLeft: 'auto' }} onClick={onDelete} aria-label={`Delete ${g.name}`}>
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

function Viewer({ g, title, onClose, onSave }: { g: GanttUpload; title: string; onClose: () => void; onSave: () => void }) {
  const url = useBlobUrl(g.id);
  const [zoom, setZoom] = useState(1);
  return (
    <Modal
      wide
      title={title}
      onClose={onClose}
      footer={
        <>
          {isImage(g.mime) && (
            <div className="seg" style={{ marginRight: 'auto' }}>
              {[1, 1.5, 2, 3].map((z) => (
                <button key={z} aria-pressed={zoom === z} onClick={() => setZoom(z)}>
                  {z === 1 ? 'Fit' : `${z * 100}%`}
                </button>
              ))}
            </div>
          )}
          <button className="btn" onClick={onSave}>
            <Icon name="download" size={14} /> Download
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {g.note && <p className="ink-2" style={{ marginTop: 0 }}>{g.note}</p>}
      {!url ? (
        <Empty>Loading…</Empty>
      ) : isImage(g.mime) ? (
        <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
          <img className="viewer-img" src={url} alt={`Gantt chart: ${g.name}`} style={{ maxWidth: zoom === 1 ? '100%' : 'none', width: zoom === 1 ? undefined : `${zoom * 100}%` }} />
        </div>
      ) : isPdf(g.mime, g.name) ? (
        <iframe className="viewer" src={url} title={g.name} />
      ) : (
        <Empty>
          This file type ({g.name.split('.').pop()}) can’t be previewed in the browser. Download it to open in the original Gantt tool, or export an image/PDF from that tool
          for an inline preview.
        </Empty>
      )}
    </Modal>
  );
}
