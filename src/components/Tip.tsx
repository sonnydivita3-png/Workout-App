import { useStore } from '../store'

/** A one-time hint shown the first time someone reaches a screen, instead of a long up-front walkthrough. */
export function Tip({ id, children }: { id: string; children: React.ReactNode }) {
  const seen = useStore((s) => s.tipsSeen.includes(id))
  const seeTip = useStore((s) => s.seeTip)
  if (seen) return null
  return (
    <div role="note" className="mb-3 flex items-start gap-3 rounded-2xl bg-accent/15 px-4 py-3 text-sm">
      <span aria-hidden>💡</span>
      <p className="flex-1">{children}</p>
      <button onClick={() => seeTip(id)} className="shrink-0 font-medium">Got it</button>
    </div>
  )
}
