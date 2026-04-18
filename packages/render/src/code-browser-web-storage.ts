/**
 * `localStorage` / `sessionStorage` can throw on `file:` URLs and in hardened browsers
 * (Safari, strict privacy). Treat failures as "no persisted value".
 */
export function readWebStorageItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeWebStorageItem(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // ignore — e.g. file://, private mode, quota
  }
}
