import { create } from 'zustand'

export interface Toast {
  id: string
  title: string
  body: string
  /** Shower the screen with confetti (personal bests, goals, finished challenges). */
  celebrate?: boolean
}

interface ToastState {
  toasts: Toast[]
  /** Changes each time a celebration should play; 0 when idle. */
  burst: number
  push: (t: Toast) => void
  dismiss: (id: string) => void
}

/** Transient in-app banners; not persisted. */
export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  burst: 0,
  push: (t) => set((s) => ({ toasts: [...s.toasts.filter((x) => x.id !== t.id), t].slice(-3), burst: t.celebrate ? s.burst + 1 : s.burst })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
