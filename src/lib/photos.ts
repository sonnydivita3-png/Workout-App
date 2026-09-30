/** Progress photos live in this device's IndexedDB (too big for normal storage) and are never uploaded. */
export interface Photo { id: string; date: string; blob: Blob }

const DB = 'ez-workout-photos'
const STORE = 'photos'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const listPhotos = async () => ((await tx<Photo[]>('readonly', (s) => s.getAll() as IDBRequest<Photo[]>)) ?? []).sort((a, b) => a.date.localeCompare(b.date))
export const deletePhoto = (id: string) => tx('readwrite', (s) => s.delete(id))

/** Shrink a picture to at most 1080px on its long side (JPEG) and save it. */
export async function addPhoto(file: File, date: string): Promise<void> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1080 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Couldn’t read that picture'))), 'image/jpeg', 0.82))
  await tx('readwrite', (s) => s.put({ id: `p-${Date.now().toString(36)}`, date, blob }))
}
