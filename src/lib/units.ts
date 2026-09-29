import type { Units } from '../types'

const LB_PER_KG = 2.20462262
const MI_PER_KM = 0.62137119

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp

export const weightFactor = (u: Units) => (u.weight === 'kg' ? 1 / LB_PER_KG : 1)
export const distanceFactor = (u: Units) => (u.distance === 'km' ? 1 / MI_PER_KM : 1)

export const showWeight = (lb: number | null, u: Units) => (lb == null ? null : round(lb * weightFactor(u)))
export const storeWeight = (v: number | null, u: Units) => (v == null ? null : v / weightFactor(u))
export const showDistance = (mi: number | null, u: Units) => (mi == null ? null : round(mi * distanceFactor(u)))
export const storeDistance = (v: number | null, u: Units) => (v == null ? null : v / distanceFactor(u))

export function formatPace(mi: number | null, minutes: number | null, u: Units): string | null {
  if (!mi || !minutes) return null
  const perUnit = minutes / (mi * distanceFactor(u))
  let m = Math.floor(perUnit)
  let s = Math.round((perUnit - m) * 60)
  if (s === 60) { m += 1; s = 0 }
  return `${m}:${String(s).padStart(2, '0')} /${u.distance}`
}

/** 45 -> "45s", 90 -> "1:30". */
export const formatSeconds = (s: number) =>
  s < 90 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
