import { useEffect, useRef, useState } from 'react'
import { fmtLong } from '../../lib/dates'
import { addPhoto, deletePhoto, listPhotos, type Photo } from '../../lib/photos'
import { useToday } from '../../lib/useToday'
import { useStore } from '../../store'
import type { Measurement } from '../../types'
import { LineChart } from '../LineChart'
import { NumberInput } from '../NumberInput'
import { Sheet } from '../Sheet'
import { BodyweightSection } from './BodyweightSection'

type Key = Exclude<keyof Measurement, 'id' | 'date'>
const FIELDS: { key: Key; label: string; pct?: boolean }[] = [
  { key: 'waist', label: 'Waist' }, { key: 'chest', label: 'Chest' }, { key: 'arms', label: 'Arms' },
  { key: 'hips', label: 'Hips' }, { key: 'thighs', label: 'Thighs' }, { key: 'bodyfat', label: 'Body fat', pct: true },
]
const CM = 2.54

/** Body measurements with trends, and progress photos kept on this device. */
export function BodyTab() {
  const { measurements, saveMeasurement, deleteMeasurement, units } = useStore()
  const today = useToday()
  const metric = units.distance === 'km'
  const u = metric ? 'cm' : 'in'
  const show = (v: number | undefined, pct?: boolean) => (v == null ? null : pct ? v : Math.round((metric ? v * CM : v) * 10) / 10)
  const store = (v: number | null, pct?: boolean) => (v == null ? undefined : pct ? v : metric ? v / CM : v)
  const [key, setKey] = useState<Key>('waist')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Partial<Record<Key, number | null>>>({})
  const [date, setDate] = useState(today)
  const field = FIELDS.find((f) => f.key === key)!
  const points = measurements.filter((m) => m[key] != null).map((m) => ({ date: m.date, y: show(m[key], field.pct)! }))
  const first = points[0]
  const last = points.at(-1)

  return (
    <div className="space-y-4">
      <BodyweightSection />
      <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Measurements</p>
          <button onClick={() => { setDraft({}); setDate(today); setAdding(true) }} className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-on-accent">+ Log</button>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FIELDS.map((f) => <button key={f.key} onClick={() => setKey(f.key)} className={`rounded-full px-3 py-1 text-xs ${key === f.key ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`}>{f.label}</button>)}
        </div>
        {points.length === 0 ? <p className="py-6 text-center text-sm text-neutral-400">No {field.label.toLowerCase()} logged yet.</p> : (
          <>
            <p className="mb-2 text-sm">
              <b className="text-lg">{last!.y}{field.pct ? '%' : ` ${u}`}</b>
              {points.length > 1 && <span className="ml-2 text-neutral-500">{last!.y - first.y >= 0 ? '+' : ''}{Math.round((last!.y - first.y) * 10) / 10}{field.pct ? '%' : ` ${u}`} since {fmtLong(first.date)}</span>}
            </p>
            <LineChart points={points} format={(v) => `${Math.round(v * 10) / 10}${field.pct ? '%' : ` ${u}`}`} label={field.label} />
          </>
        )}
        {measurements.length > 0 && (
          <details className="mt-3 text-xs text-neutral-500">
            <summary className="cursor-pointer">All entries</summary>
            <ul className="mt-2 divide-y divide-neutral-100">
              {[...measurements].reverse().map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span>{fmtLong(m.date)}: {FIELDS.filter((f) => m[f.key] != null).map((f) => `${f.label} ${show(m[f.key], f.pct)}${f.pct ? '%' : ''}`).join(', ')}</span>
                  <button onClick={() => confirm('Delete this entry?') && deleteMeasurement(m.id)} className="text-red-600">Delete</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <Photos />

      {adding && (
        <Sheet title="Log measurements" onClose={() => setAdding(false)} closeLabel="Cancel">
          <label className="mb-3 block text-sm text-neutral-500">Date<input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="mt-1 block w-full rounded-lg bg-neutral-100 px-3 py-2 text-neutral-900 outline-none" /></label>
          <div className="mb-4 grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="text-sm text-neutral-500">{f.label} ({f.pct ? '%' : u})
                <NumberInput value={draft[f.key] ?? null} step={0.5} placeholder="–" onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
              </label>
            ))}
          </div>
          <p className="mb-3 text-xs text-neutral-400">Fill in any you measured; the rest can stay empty. Measure at the same time of day each time.</p>
          <button
            disabled={!Object.values(draft).some((v) => v != null) || !date}
            onClick={() => { saveMeasurement({ date, ...Object.fromEntries(FIELDS.filter((f) => draft[f.key] != null).map((f) => [f.key, store(draft[f.key]!, f.pct)])) }); setAdding(false) }}
            className="w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent disabled:opacity-30"
          >
            Save
          </button>
        </Sheet>
      )}
    </div>
  )
}

function Photos() {
  const today = useToday()
  const [photos, setPhotos] = useState<(Photo & { url: string })[]>([])
  const [pick, setPick] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const reload = async () => {
    try {
      const list = await listPhotos()
      setPhotos((old) => { old.forEach((p) => URL.revokeObjectURL(p.url)); return list.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) })) })
    } catch { setError('Photos aren’t available in this browser mode.') }
  }
  useEffect(() => {
    listPhotos().then((list) => setPhotos(list.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) })))).catch(() => setError('Photos aren’t available in this browser mode.'))
  }, [])
  const compare = pick.length === 2 ? pick.map((id) => photos.find((p) => p.id === id)!).sort((a, b) => a.date.localeCompare(b.date)) : null

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-neutral-400">Progress photos</p>
        <button onClick={() => file.current?.click()} className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-on-accent">+ Photo</button>
      </div>
      <p className="mb-3 text-xs text-neutral-400">Saved only on this phone, never uploaded or shared, and not included in backups. Tap two to compare.</p>
      <input ref={file} type="file" accept="image/*" aria-label="Add a progress photo" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { await addPhoto(f, today); await reload() } catch { setError('Couldn’t save that picture.') } }} />
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      {compare && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {compare.map((p) => <figure key={p.id}><img src={p.url} alt={`Progress photo ${fmtLong(p.date)}`} className="aspect-[3/4] w-full rounded-xl object-cover" /><figcaption className="mt-1 text-center text-xs text-neutral-500">{fmtLong(p.date)}</figcaption></figure>)}
        </div>
      )}
      {photos.length === 0 ? <p className="py-4 text-center text-sm text-neutral-400">No photos yet.</p> : (
        <div className="grid grid-cols-3 gap-2">
          {[...photos].reverse().map((p) => (
            <div key={p.id} className="relative">
              <button onClick={() => setPick((c) => (c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id].slice(-2)))} aria-pressed={pick.includes(p.id)} className={`block w-full overflow-hidden rounded-xl ${pick.includes(p.id) ? 'ring-2 ring-accent' : ''}`}>
                <img src={p.url} alt={`Progress photo ${fmtLong(p.date)}`} className="aspect-[3/4] w-full object-cover" />
              </button>
              <span className="mt-0.5 block text-center text-[10px] text-neutral-400">{fmtLong(p.date)}</span>
              <button onClick={async () => { if (confirm('Delete this photo?')) { await deletePhoto(p.id); setPick((c) => c.filter((x) => x !== p.id)); await reload() } }} aria-label="Delete photo" className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/50 text-xs text-white">✕</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
