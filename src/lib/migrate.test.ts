import { describe, expect, it } from 'vitest'
import { repairState } from './migrate'

const defaults = { plan: Array.from({ length: 7 }, () => []), overrides: {}, logs: [], custom: [], routines: [], goals: [], bodyweight: [], units: { weight: 'lb', distance: 'mi' }, name: '', tourDone: false, timedLogs: [], programs: [], notifications: [] }

describe('repairState', () => {
  it('fills fields missing from old versions', () => {
    const r = repairState({ plan: defaults.plan, logs: [], name: 'Jay' }, defaults)
    expect(r.name).toBe('Jay')
    expect(r.timedLogs).toEqual([])
    expect(r.units).toEqual({ weight: 'lb', distance: 'mi' })
  })
  it('drops bad entries and wrong types instead of crashing', () => {
    const r = repairState({
      plan: 'oops', logs: [{ exerciseId: 'a', date: '2026-01-01', sets: [] }, { exerciseId: 5 }, null, { exerciseId: 'b', date: 'yesterday', sets: [] }],
      overrides: { '2026-01-02': [{ exerciseId: 'x', sets: 3 }, 7], bad: [] }, name: 42, tourDone: 'yes', goals: [{ id: 'g' }, 'nope'],
      units: { weight: 'kg' }, bodyweight: [{ date: '2026-01-01', lb: 180 }, { date: 'x' }],
    }, defaults)
    expect(r.plan).toHaveLength(7)
    expect(r.logs).toHaveLength(1)
    expect(r.overrides).toEqual({ '2026-01-02': [{ exerciseId: 'x', sets: 3 }] })
    expect(r.name).toBe('')
    expect(r.tourDone).toBe(false)
    expect(r.goals).toHaveLength(1)
    expect(r.units).toEqual({ weight: 'kg', distance: 'mi' })
    expect(r.bodyweight).toHaveLength(1)
  })
  it('handles nothing saved, and keeps unknown future fields', () => {
    expect(repairState(null, defaults)).toEqual(defaults)
    expect((repairState({ fromTheFuture: [1] }, defaults) as Record<string, unknown>).fromTheFuture).toEqual([1])
  })
  it('keeps values for fields whose default is null', () => {
    const d = { ...defaults, backendKind: null as string | null, pendingInvite: null as string | null }
    const r = repairState({ backendKind: 'supabase', pendingInvite: 'sam' }, d)
    expect(r.backendKind).toBe('supabase')
    expect(r.pendingInvite).toBe('sam')
    expect(repairState({}, d).backendKind).toBeNull()
  })

  it('damaged numbers in a backup become empty, never NaN or text', () => {
    const r = repairState({
      plan: defaults.plan,
      logs: [
        { date: '2026-10-01', exerciseId: 'bench', sets: [{ weight: '135', reps: 8 }, { weight: 135, reps: Infinity }, 'junk', { weight: -5, reps: 5, rpe: 8 }] },
        { date: '2026-10-02', exerciseId: 'running', cardio: { distance: 'far', minutes: 30, calories: NaN } },
      ],
      bodyweight: [{ date: '2026-10-01', lb: 180 }, { date: '2026-10-02', lb: 'heavy' }, { date: 'yesterday', lb: 180 }, { date: '2026-10-03', lb: 0 }],
    }, defaults)
    const logs = r.logs as unknown as { sets?: unknown; cardio?: unknown }[]
    expect(logs[0].sets).toEqual([{ weight: null, reps: 8 }, { weight: 135, reps: null }, { weight: null, reps: 5, rpe: 8 }])
    expect(logs[1].cardio).toEqual({ distance: null, minutes: 30, calories: null })
    expect(r.bodyweight).toEqual([{ date: '2026-10-01', lb: 180 }])
    expect(repairState({ bodyweight: [{ date: '2026-10-05', lb: 178 }, { date: '2026-10-01', lb: 180 }] }, defaults).bodyweight.map((b: { date: string }) => b.date)).toEqual(['2026-10-01', '2026-10-05'])
  })
  it('never takes a prototype from saved or imported data', () => {
    const evil = JSON.parse('{"plan":[[],[],[],[],[],[],[]],"logs":[],"__proto__":{"isAdmin":true},"units":{"weight":"kg","__proto__":{"isAdmin":true}}}')
    const r = repairState(evil, defaults) as Record<string, unknown>
    expect(Object.getPrototypeOf(r)).toBe(Object.prototype)
    expect(r.isAdmin).toBeUndefined()
    expect(Object.getPrototypeOf(r.units)).toBe(Object.prototype)
    expect((r.units as Record<string, unknown>).isAdmin).toBeUndefined()
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined()
  })
})
