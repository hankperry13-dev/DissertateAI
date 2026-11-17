import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import type { AppData, Chapter, Citation, GanttUpload, Meeting, Profile, Publication, WritingSession } from './types';
import { sampleData } from './lib/seed';

const DATA_KEY = 'dissertateai:data:v1';
const UPLOADS_KEY = 'dissertateai:uploads:v1';

type CollectionMap = {
  chapters: Chapter;
  sessions: WritingSession;
  citations: Citation;
  meetings: Meeting;
  publications: Publication;
};
export type Collection = keyof CollectionMap;

type Action =
  | { type: 'upsert'; collection: Collection; item: { id: string } }
  | { type: 'remove'; collection: Collection; id: string }
  | { type: 'chapters'; chapters: Chapter[] }
  | { type: 'profile'; profile: Profile }
  | { type: 'replace'; data: AppData };

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'upsert': {
      const list = state[action.collection] as { id: string }[];
      const exists = list.some((x) => x.id === action.item.id);
      const next = exists ? list.map((x) => (x.id === action.item.id ? action.item : x)) : [...list, action.item];
      return { ...state, [action.collection]: next };
    }
    case 'remove': {
      const list = state[action.collection] as { id: string }[];
      return { ...state, [action.collection]: list.filter((x) => x.id !== action.id) };
    }
    case 'chapters':
      return { ...state, chapters: action.chapters };
    case 'profile':
      return { ...state, profile: action.profile };
    case 'replace':
      return action.data;
  }
}

function load<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* storage unavailable or corrupt: fall back */
  }
  return fallback();
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or private mode: the session still works in memory */
  }
}

/** Validate an imported backup just enough to avoid crashing the UI. */
export function parseBackup(text: string): AppData {
  const raw = JSON.parse(text) as Partial<AppData> & { data?: AppData };
  const d = (raw.data ?? raw) as Partial<AppData>;
  const lists = ['chapters', 'sessions', 'citations', 'meetings', 'publications'] as const;
  for (const k of lists) if (!Array.isArray(d[k])) throw new Error(`Backup is missing “${k}”.`);
  if (!d.profile || typeof d.profile !== 'object') throw new Error('Backup is missing the profile.');
  return { ...(d as AppData), version: 1 };
}

interface Store {
  data: AppData;
  upsert<K extends Collection>(collection: K, item: CollectionMap[K]): void;
  remove(collection: Collection, id: string): void;
  setChapters(chapters: Chapter[]): void;
  setProfile(profile: Profile): void;
  replace(data: AppData): void;
  uploads: GanttUpload[];
  setUploads(fn: (u: GanttUpload[]) => GanttUpload[]): void;
  chapterName(id: string): string;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, () => load(DATA_KEY, sampleData));
  const [uploads, setUploadsState] = useState<GanttUpload[]>(() => load(UPLOADS_KEY, () => []));

  useEffect(() => save(DATA_KEY, data), [data]);
  useEffect(() => save(UPLOADS_KEY, uploads), [uploads]);

  const setUploads = useCallback((fn: (u: GanttUpload[]) => GanttUpload[]) => setUploadsState(fn), []);

  const store = useMemo<Store>(() => {
    const names = new Map(data.chapters.map((c) => [c.id, chapterLabel(c)]));
    return {
      data,
      upsert: (collection, item) => dispatch({ type: 'upsert', collection, item }),
      remove: (collection, id) => dispatch({ type: 'remove', collection, id }),
      setChapters: (chapters) => dispatch({ type: 'chapters', chapters }),
      setProfile: (profile) => dispatch({ type: 'profile', profile }),
      replace: (d) => dispatch({ type: 'replace', data: d }),
      uploads,
      setUploads,
      chapterName: (id) => names.get(id) ?? '—',
    };
  }, [data, uploads, setUploads]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside <StoreProvider>');
  return s;
}

export function chapterLabel(c: Pick<Chapter, 'number' | 'title'>): string {
  const short = c.title.split(':')[0];
  return c.number === 0 ? short : `Ch. ${c.number} · ${short}`;
}

export function sortedChapters(chapters: Chapter[]): Chapter[] {
  return [...chapters].sort((a, b) => a.number - b.number);
}
