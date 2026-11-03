/** What an empty screen or section says: what will show up here, and how to get it there. */
export function EmptyState({ icon, title, children, className = '' }: { icon: string; title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center px-4 py-10 text-center ${className}`}>
      <span aria-hidden className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-2xl">{icon}</span>
      <p className="font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-xs text-balance text-sm text-neutral-500">{children}</p>}
    </div>
  )
}
