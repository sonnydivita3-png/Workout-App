import type { Exercise } from '../types'
import { gearOf, isHomeSetup } from './equipment'

/**
 * Where an exercise is done in a typical gym, so supersets and circuits keep you in one spot instead of walking from
 * the squat rack to the cable stack and back.
 *
 * - Portable: dumbbells, kettlebells, bands, balls and floor moves come with you (or need only a patch of floor).
 * - Fixed: a barbell setup (rack, bench, platform), the cable stack, each machine, the pull-up and dip bars.
 *
 * Two moves at the same station pair perfectly (pushdown + cable curl, leg extension + leg curl, RDL + barbell row).
 * A floor move pairs with anything (squats + planks next to the rack). Dumbbells can be carried to a station.
 * Two different fixed stations mean walking, and holding two pieces of equipment at a busy gym.
 */
export type Station =
  | 'floor' | 'dumbbells' | 'kettlebells'
  | 'rack' | 'bench' | 'platform' | 'smith' | 'cable' | 'pullup' | 'dip' | 'turf' | 'box'
  | `machine:${string}`

const text = (e: Exercise) => `${e.name} ${e.fullName ?? ''}`

/** Machines that are usually one unit, or side by side (most gyms have a leg extension / curl combo). */
const MACHINE_GROUPS: [string, RegExp][] = [
  ['leg-ext-curl', /leg extension|leg curl/i],
  ['leg-press', /leg press|hack squat|calf press/i],
  ['pec-deck', /butterfly|pec deck|reverse machine fly|rear delt.*machine/i],
  ['hip', /abductor|adductor/i],
  ['calf', /calf raise/i],
  ['dip-chin', /dip machine|assisted/i],
]

export const stationOf = (e: Exercise): Station => {
  const t = text(e)
  const g = gearOf(e)
  if (/smith/i.test(t)) return 'smith'
  if (/pull-?ups?\b|chin-?ups?\b|hanging|toes[- ]to[- ]bar|muscle-up/i.test(t) && g !== 'Machine' && g !== 'Cable') return 'pullup'
  if (/\bdips?\b/i.test(t) && g !== 'Machine' && !/bench dip/i.test(t)) return 'dip'
  if (/sled|prowler/i.test(t)) return 'turf'
  if (e.equipment === 'Box') return 'box'
  switch (g) {
    case 'Dumbbell': return 'dumbbells'
    case 'Kettlebell': return 'kettlebells'
    case 'Bands': case 'Bodyweight': case 'Outdoor': return 'floor'
    case 'Cable': return 'cable'
    case 'Machine': {
      const m = MACHINE_GROUPS.find(([, re]) => re.test(t))
      return `machine:${m ? m[0] : e.id}`
    }
    case 'Barbell': {
      // Bench work on a bench (or bench rack); squats, presses, lunges and shrugs in the rack; the rest off the floor.
      if (/bench|skull|floor press|hip thrust|lying|pullover|incline|decline|jm press/i.test(t)) return 'bench'
      if (/squat|overhead press|military|shoulder press|push press|lunge|split|shrug|rack|good ?morning|step-?up/i.test(t)) return 'rack'
      return 'platform'
    }
    default:
      // Balls, ab rollers, sandbags and the like: floor moves.
      return 'floor'
  }
}

const PORTABLE = new Set<Station>(['floor', 'dumbbells', 'kettlebells'])
export const isPortable = (s: Station) => PORTABLE.has(s)

/** Barbell setups that share a bar, or are usually next to each other (a bench beside the rack, a pull-up bar on it). */
const NEARBY: [Station, Station][] = [
  ['rack', 'platform'], ['bench', 'platform'], ['rack', 'pullup'], ['rack', 'bench'], ['dip', 'pullup'],
]

// At home or in a garage (see isHomeSetup), the barbell, bench, rack and bars are all one setup.
const RIG = new Set<Station>(['rack', 'bench', 'platform', 'pullup', 'dip', 'box'])

/**
 * How much moving a pair (or the next station of a circuit) takes: 0 = same spot, 1 = carry your dumbbells over or a
 * few steps, 3 = across the gym.
 */
export function walkCost(a: Exercise, b: Exercise): number {
  const x = stationOf(a)
  const y = stationOf(b)
  if (x === y) return 0
  if (x === 'floor' || y === 'floor') return 0
  if (isHomeSetup() && RIG.has(x) && RIG.has(y)) return 0
  if (isPortable(x) && isPortable(y)) return 1 // dumbbells and kettlebells: usually the same corner
  if (isPortable(x) || isPortable(y)) return 1 // bring the dumbbells to the bench or cables
  if (NEARBY.some(([p, q]) => (p === x && q === y) || (p === y && q === x))) return 1
  return 3
}

/** The fixed stations a circuit would tie up (portable gear doesn't count). */
export const fixedStations = (list: Exercise[]) => new Set(list.map(stationOf).filter((s) => !isPortable(s)))

/**
 * Whether `e` can join a circuit that already has `picked` without leaving its area: anything portable, or a fixed
 * station when the circuit uses at most `max` of them (a bench and dumbbells, or the cable stack plus floor work).
 */
export function staysPut(picked: Exercise[], e: Exercise, max = 1): boolean {
  const s = stationOf(e)
  if (isPortable(s)) return true
  const fixed = fixedStations(picked)
  if (fixed.has(s)) return true
  if (isHomeSetup() && RIG.has(s) && [...fixed].every((f) => RIG.has(f))) return true
  return fixed.size < max
}
