import { useEffect, useCallback } from 'react';
import type { Recording } from '../types';

const DB_NAME = 'rapidfit-v1';
const STORE   = 'recordings';

function openDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}

type StoredRec = Omit<Recording, 'url'>;

async function dbGetAll(): Promise<Recording[]> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () =>
      res((req.result as StoredRec[]).map(r => ({
        ...r,
        createdAt: new Date(r.createdAt), // IndexedDB serialises dates as strings
        url: URL.createObjectURL(r.blob),
      })));
    req.onerror = () => rej(req.error);
  });
}

async function dbPut(rec: Recording): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { url: _url, ...stored } = rec; // object URLs are ephemeral — don't store them
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(stored);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

async function dbDelete(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

interface Props {
  onLoad: (recs: Recording[]) => void;
}

/**
 * Persists recordings in IndexedDB so they survive page refreshes.
 * Blobs are stored natively; object URLs are recreated on load.
 */
export function useStorage({ onLoad }: Props) {
  // Load existing recordings on mount
  useEffect(() => {
    dbGetAll()
      .then(recs => { if (recs.length) onLoad(recs); })
      .catch(err => console.warn('[useStorage] load failed', err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const persistRecording = useCallback((rec: Recording) => {
    dbPut(rec).catch(err => console.warn('[useStorage] save failed', err));
  }, []);

  const removeRecording = useCallback((id: string) => {
    dbDelete(id).catch(err => console.warn('[useStorage] delete failed', err));
  }, []);

  return { persistRecording, removeRecording };
}
