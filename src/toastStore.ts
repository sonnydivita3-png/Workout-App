import { create } from 'zustand'

export interface Toast {
  id: string
  title: string
  body: string
}

interface ToastState {
  toasts: Toast[]
  push: (t: Toast) => void
  dismiss: (id: string) => void
}

/** Transient in-app banners; not persisted. */
export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  push: (t) => set((s) => ({ toasts: [...s.toasts.filter((x) => x.id !== t.id), t].slice(-3) })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
