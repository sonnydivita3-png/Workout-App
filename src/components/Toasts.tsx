import { useEffect } from 'react'
import { useToasts, type Toast } from '../toastStore'

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss)
  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), 5000)
    return () => clearTimeout(t)
  }, [toast, dismiss])
  return (
    <button
      onClick={() => dismiss(toast.id)}
      className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-left text-white shadow-lg"
    >
      <span className="block text-sm font-medium">{toast.title}</span>
      <span className="block text-xs text-neutral-300">{toast.body}</span>
    </button>
  )
}

export function Toasts() {
  const toasts = useToasts((s) => s.toasts)
  if (toasts.length === 0) return null
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-30 mx-auto max-w-md space-y-2 px-4">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto"><ToastItem toast={t} /></div>
      ))}
    </div>
  )
}
