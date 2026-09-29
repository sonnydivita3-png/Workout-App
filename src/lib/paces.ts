const M_PER_MILE = 1609.344

/** Oxygen cost of running at `v` metres per minute (Daniels & Gilbert). */
const vo2At = (v: number) => -4.6 + 0.182258 * v + 0.000104 * v * v
/** Fraction of VO2max a runner can hold for `t` minutes. */
const fractionHeld = (t: number) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t)

/** Daniels' VDOT: a fitness score from any race result (distance in miles, time in minutes). */
export function vdot(miles: number, minutes: number): number {
  return vo2At((miles * M_PER_MILE) / minutes) / fractionHeld(minutes)
}

/** Pace (minutes per mile) at a given fraction of VDOT. */
export function paceAt(v: number, fraction: number): number {
  const vo2 = v * fraction
  const speed = (-0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * (vo2 + 4.6))) / (2 * 0.000104)
  return M_PER_MILE / speed
}

export interface TrainingPaces {
  vdot: number
  /** [slowest, fastest] easy pace, minutes per mile. */
  easy: [number, number]
  marathon: number
  threshold: number
  interval: number
  repetition: number
}

/**
 * Training paces from a recent or goal race result. Intensities follow Daniels' zones: easy is roughly
 * 62–70% of VDOT, marathon 80%, threshold 84%, interval 96%, repetition 105%. These are estimates: adjust by feel.
 */
export function trainingPaces(miles: number, minutes: number): TrainingPaces | null {
  const v = vdot(miles, minutes)
  if (!Number.isFinite(v) || v < 20 || v > 90) return null
  return {
    vdot: v,
    easy: [paceAt(v, 0.62), paceAt(v, 0.7)],
    marathon: paceAt(v, 0.8),
    threshold: paceAt(v, 0.84),
    interval: paceAt(v, 0.96),
    repetition: paceAt(v, 1.05),
  }
}

/** Parse "h:mm:ss", "mm:ss" or "mm" (minutes) into minutes. */
export function parseDuration(text: string): number | null {
  const parts = text.trim().split(':').map((p) => Number(p))
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !Number.isFinite(p) || p < 0)) return null
  const [h, m, s] = parts.length === 3 ? parts : parts.length === 2 ? [0, parts[0], parts[1]] : [0, parts[0], 0]
  const total = h * 60 + m + s / 60
  return total > 0 ? total : null
}

/** Minutes → "3:45:00" or "24:30". */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes * 60)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return h ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`
}
