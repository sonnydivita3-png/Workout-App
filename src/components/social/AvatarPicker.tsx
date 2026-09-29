import { useRef, useState } from 'react'
import { photoToAvatar } from '../../lib/avatarImage'
import { avatarKind, AVATARS, letterAvatar } from '../../social/types'
import { chip } from './styles'
import { AvatarView, ErrorNote } from './ui'

type Tab = 'emoji' | 'letter' | 'photo'
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/** Choose an avatar: an emoji, a letter, or your own picture (shrunk on this device). */
export function AvatarPicker({ value, onChange, name = '' }: { value: string; onChange: (avatar: string) => void; name?: string }) {
  const [tab, setTab] = useState<Tab>(avatarKind(value))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const initial = name.trim().charAt(0).toUpperCase()

  const pickTab = (t: Tab) => {
    setTab(t); setError(null)
    if (t === 'letter' && avatarKind(value) !== 'letter') onChange(letterAvatar(/[A-Z0-9]/.test(initial) ? initial : 'A'))
    if (t === 'emoji' && avatarKind(value) !== 'emoji') onChange(AVATARS[0])
  }

  const upload = async (f: File | undefined) => {
    if (!f) return
    setBusy(true); setError(null)
    try { onChange(await photoToAvatar(f)) } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t use that picture.') } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <AvatarView avatar={value} className="h-16 w-16 text-4xl" />
        <div className="flex gap-2">
          {(['emoji', 'letter', 'photo'] as const).map((t) => <button key={t} onClick={() => pickTab(t)} className={chip(tab === t)}>{t === 'emoji' ? 'Emoji' : t === 'letter' ? 'Letter' : 'Photo'}</button>)}
        </div>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {tab === 'emoji' && (
        <div className="flex flex-wrap gap-2">
          {AVATARS.map((a) => <button key={a} onClick={() => onChange(a)} aria-label={`Avatar ${a}`} className={`${chip(a === value)} text-lg`}>{a}</button>)}
        </div>
      )}
      {tab === 'letter' && (
        <div className="grid grid-cols-9 gap-1.5">
          {LETTERS.map((l) => <button key={l} onClick={() => onChange(letterAvatar(l))} aria-label={`Letter ${l}`} className={`rounded-lg py-1.5 text-sm ${value === letterAvatar(l) ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`}>{l}</button>)}
        </div>
      )}
      {tab === 'photo' && (
        <div>
          <input ref={file} type="file" accept="image/*" aria-label="Choose a picture" className="hidden" onChange={(e) => { const input = e.target; void upload(input.files?.[0]).finally(() => { input.value = '' }) }} />
          <button disabled={busy} onClick={() => file.current?.click()} className="w-full rounded-2xl bg-neutral-100 py-3 text-sm font-medium text-neutral-700 disabled:opacity-40">{busy ? 'Working…' : avatarKind(value) === 'photo' ? 'Choose a different picture' : 'Choose a picture'}</button>
          <p className="mt-2 text-xs text-neutral-400">Your picture is shrunk to a small square on this device. Friends you accept can see it next to your name.</p>
        </div>
      )}
    </div>
  )
}
