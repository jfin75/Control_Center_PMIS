/** Attachment files, kept in this browser's IndexedDB. The RFI record holds
 *  only the metadata; the bytes live here under the attachment id, so the
 *  localStorage store stays small. Replace with object storage once there is a
 *  backend. */

const DB_NAME = "cc.files";
const STORE = "files";

/** Largest single file accepted, in bytes. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("File storage is not available in this browser."));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open file storage."));
  });
  dbp.catch(() => {
    dbp = null;
  });
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => resolve(req ? req.result : undefined);
        t.onerror = () => reject(t.error ?? new Error("File storage failed."));
        t.onabort = () => reject(t.error ?? new Error("File storage was interrupted."));
      }),
  );
}

export const putFile = (id: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, id)).then(() => undefined);
export const getFile = (id: string) => tx<Blob>("readonly", (s) => s.get(id));
export const deleteFiles = (ids: string[]) =>
  tx("readwrite", (s) => {
    for (const id of ids) s.delete(id);
  }).then(() => undefined);

/** Save a stored file to the user's downloads. */
export async function downloadFile(id: string, name: string): Promise<boolean> {
  const blob = await getFile(id);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export const isImage = (type: string) => type.startsWith("image/");
