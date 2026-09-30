import type { ReactNode } from 'react'
import { avatarKind, PHOTO_RE, type Profile } from '../../social/types'

export function Avatar({ profile, size = 'md' }: { profile: Pick<Profile, 'avatar'>; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-14 w-14 text-3xl' : size === 'sm' ? 'h-8 w-8 text-base' : 'h-10 w-10 text-xl'
  return <AvatarView avatar={profile.avatar} className={cls} />
}

/** Render an avatar string: a photo, a letter on a colour, or an emoji. */
export function AvatarView({ avatar, className = 'h-10 w-10 text-xl' }: { avatar: string; className?: string }) {
  const kind = avatarKind(avatar)
  const base = `flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`
  if (kind === 'photo' && PHOTO_RE.test(avatar)) return <img src={avatar} alt="" className={`${base} object-cover`} />
  if (kind === 'letter') {
    const l = avatar.slice(-1)
    return <span className={`${base} bg-accent font-semibold text-on-accent`} aria-hidden>{l}</span>
  }
  return <span className={`${base} bg-neutral-100`} aria-hidden>{avatar}</span>
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>
}

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-neutral-200/70">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-sm font-semibold text-neutral-700">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

