import { useRef, useState } from 'react';
import { parseBackup, useStore } from '../store';
import { emptyData, sampleData } from '../lib/seed';
import { download } from '../lib/export';
import { today } from '../lib/date';
import { fileStore } from '../lib/idb';
import { Field, Icon, Modal, toast } from './ui';
import type { Profile } from '../types';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { data, setProfile, replace, setUploads } = useStore();
  const [p, setP] = useState<Profile>(data.profile);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });

  const importBackup = async (f: File) => {
    try {
      const next = parseBackup(await f.text());
      if (!window.confirm('Replace all current dashboard data with this backup?')) return;
      replace(next);
      toast('Backup restored');
      onClose();
    } catch (e) {
      window.alert(`Couldn't import that file: ${(e as Error).message}`);
    }
  };

  const reset = async (kind: 'sample' | 'empty') => {
    const msg = kind === 'sample' ? 'Replace everything with the sample dissertation?' : 'Clear all chapters, citations, meetings, publications and uploaded Gantt charts?';
    if (!window.confirm(msg)) return;
    replace(kind === 'sample' ? sampleData() : emptyData());
    if (kind === 'empty') {
      setUploads(() => []);
      await fileStore.clear().catch(() => undefined);
    }
    toast(kind === 'sample' ? 'Sample data loaded' : 'Dashboard cleared');
    onClose();
  };

  return (
    <Modal
      title="Settings & data"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setProfile({ ...p, targetWords: Number(p.targetWords) || 0 });
              toast('Profile saved');
              onClose();
            }}
          >
            Save profile
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Dissertation title" full>
          <input className="input" value={p.dissertationTitle} onChange={(e) => set('dissertationTitle', e.target.value)} />
        </Field>
        <Field label="Your name (for reports)">
          <input className="input" value={p.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Department / program">
          <input className="input" value={p.department} onChange={(e) => set('department', e.target.value)} />
        </Field>
        <Field label="Advisor">
          <input className="input" value={p.advisor} onChange={(e) => set('advisor', e.target.value)} />
        </Field>
        <Field label="Total word target">
          <input className="input" type="number" min={0} step={1000} value={p.targetWords} onChange={(e) => set('targetWords', Number(e.target.value))} />
        </Field>
        <Field label="Committee" full>
          <input className="input" value={p.committee} onChange={(e) => set('committee', e.target.value)} />
        </Field>
        <Field label="Program start">
          <input className="input" type="date" value={p.programStart} onChange={(e) => set('programStart', e.target.value)} />
        </Field>
        <Field label="Planned defense date">
          <input className="input" type="date" value={p.defenseDate} onChange={(e) => set('defenseDate', e.target.value)} />
        </Field>
      </div>

      <h3 style={{ fontSize: 14, margin: '22px 0 6px' }}>Your data</h3>
      <p className="ink-2" style={{ margin: '0 0 10px', fontSize: 13 }}>
        Everything is stored in this browser only. Download a backup regularly, or before switching computers. Uploaded Gantt files are kept separately and are not
        included in the JSON backup.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button className="btn" onClick={() => download(`dissertateai-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json')}>
          <Icon name="download" size={14} /> Download backup (.json)
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={14} /> Restore from backup…
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
        <button className="btn" onClick={() => reset('sample')}>
          Load sample dissertation
        </button>
        <button className="btn btn-danger" onClick={() => reset('empty')}>
          <Icon name="trash" size={14} /> Start fresh
        </button>
      </div>
    </Modal>
  );
}
