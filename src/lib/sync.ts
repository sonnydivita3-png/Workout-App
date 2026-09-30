/** Everything that gets backed up: workouts, plans and goals. Settings like theme stay per device. */
export const SYNC_KEYS = ['plan', 'overrides', 'logs', 'custom', 'units', 'name', 'bodyweight', 'routines', 'goals', 'timedLogs', 'measurements', 'programs', 'equipment', 'finishedDays', 'trainingPrefs'] as const

export function syncPayload(state: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(SYNC_KEYS.map((k) => [k, state[k]]))
}

/** A short fingerprint of the data, to tell whether it changed since the last sync. */
export function fingerprint(data: unknown): string {
  const s = JSON.stringify(data)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `${s.length}:${(h >>> 0).toString(36)}`
}

export interface SyncMeta {
  /** The server's timestamp for the last version this device uploaded or downloaded. */
  lastSyncedAt: string | null
  /** Fingerprint of the data at that point. */
  lastHash: string | null
}

export type SyncAction = 'push' | 'pull' | 'conflict' | 'none'

/**
 * What to do, given this device's data and the cloud copy. Changes on only one side flow to the other.
 * If both changed since the last sync, the person chooses (nothing is merged or thrown away silently).
 */
export function decideSync(p: { localHash: string; localEmpty: boolean; remote: { updatedAt: string } | null; meta: SyncMeta }): SyncAction {
  const { localHash, localEmpty, remote, meta } = p
  if (!remote) return localEmpty ? 'none' : 'push'
  const localChanged = localHash !== meta.lastHash
  const remoteChanged = remote.updatedAt !== meta.lastSyncedAt
  if (remoteChanged && (!localChanged || localEmpty)) return 'pull'
  if (remoteChanged && localChanged) return meta.lastSyncedAt === null && localEmpty ? 'pull' : 'conflict'
  return localChanged ? 'push' : 'none'
}
