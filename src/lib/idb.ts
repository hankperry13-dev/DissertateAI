/**
 * Minimal IndexedDB wrapper for uploaded Gantt chart files.
 * Files can be several MB (PDF exports, high-res PNGs), which is too much for localStorage.
 */
const DB_NAME = 'dissertateai';
const STORE = 'gantt-files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export const fileStore = {
  put: (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id)),
  get: (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>),
  remove: (id: string) => tx('readwrite', (s) => s.delete(id)),
  clear: () => tx('readwrite', (s) => s.clear()),
};
