import type { LocalState } from "./types";

/**
 * Local database for the shop PC: one IndexedDB record holding the whole state.
 * Works with zero internet. Falls back to localStorage if IndexedDB is blocked.
 */
const DB_NAME = "naya-potha";
const STORE = "kv";
const KEY = "state";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadState(): Promise<LocalState | null> {
  try {
    const db = await open();
    return await new Promise<LocalState | null>((resolve, reject) => {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve((r.result as LocalState | undefined) ?? null);
      r.onerror = () => reject(r.error);
    });
  } catch {
    const raw = localStorage.getItem(`${DB_NAME}:${KEY}`);
    return raw ? (JSON.parse(raw) as LocalState) : null;
  }
}

export async function saveState(state: LocalState): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(state, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem(`${DB_NAME}:${KEY}`, JSON.stringify(state));
  }
}
