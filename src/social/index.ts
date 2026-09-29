import type { SocialBackend } from './backend'
import { DemoBackend } from './demo'
import { SupabaseBackend } from './supabase'

let backend: SocialBackend | null = null

/** True when a Supabase project is configured for this build. */
export const socialConfigured = () => !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

/** The real server if this build has one configured, otherwise the on-device demo. */
export function getBackend(): SocialBackend {
  if (!backend) {
    backend = socialConfigured()
      ? new SupabaseBackend(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string)
      : new DemoBackend()
  }
  return backend
}
