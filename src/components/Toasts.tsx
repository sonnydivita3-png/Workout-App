import { useEffect, useState } from 'react'
import { useToasts, type Toast } from '../toastStore'

function ToastItem({ toast, onOpen }: { toast: Toast; onOpen?: (to: NonNullable<Toast['open']>) => void }) {
  const dismiss = useToasts((s) => s.dismiss)
  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), 5000)
    return () => clearTimeout(t)
  }, [toast, dismiss])
  const go = toast.open && onOpen ? toast.open : null
  return (
    <button
      onClick={() => { dismiss(toast.id); if (go) onOpen!(go) }}
      className="pop-in flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-2.5 text-left text-neutral-900 shadow-lg ring-1 ring-accent"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{toast.title}</span>
        <span className="line-clamp-2 block text-xs text-neutral-500">{toast.body}</span>
      </span>
      {go && <span className="shrink-0 text-xs font-medium text-neutral-600">Tap to open ›</span>}
    </button>
  )
}

const BITS = ['🎉', '🔥', '💪', '⭐', '✨', '💯']

/** A short shower of confetti; ignores taps and disappears on its own. */
function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 34 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      dur: 1.8 + Math.random() * 1.4,
      size: 14 + Math.random() * 14,
      bit: i % 3 === 0 ? BITS[i % BITS.length] : null,
      hue: Math.floor(Math.random() * 360),
    })),
  )
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti absolute top-0"
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, ['--dur' as string]: `${p.dur}s`, fontSize: p.size, ...(p.bit ? {} : { width: 8, height: 12, borderRadius: 2, background: `hsl(${p.hue} 90% 60%)` }) }}
        >
          {p.bit}
        </span>
      ))}
    </div>
  )
}

export function Toasts({ onOpen }: { onOpen?: (to: NonNullable<Toast['open']>) => void } = {}) {
  const toasts = useToasts((s) => s.toasts)
  const burst = useToasts((s) => s.burst)
  const [shown, setShown] = useState(0)
  // Play confetti once per new burst, for a few seconds.
  useEffect(() => {
    if (burst === 0) return
    const t = setTimeout(() => setShown(burst), 0)
    const off = setTimeout(() => setShown(0), 3600)
    return () => { clearTimeout(t); clearTimeout(off) }
  }, [burst])
  return (
    <>
      {shown > 0 && <Confetti key={shown} />}
      {toasts.length > 0 && (
        // At the top, where nothing is being logged and a thumb doesn't tap by accident (the ✓ column and the main
        // buttons are lower down); a finished exercise scrolls to just below them.
        <div role="status" className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto max-w-md space-y-1.5 px-4">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto"><ToastItem toast={t} onOpen={onOpen} /></div>
          ))}
        </div>
      )}
    </>
  )
}
