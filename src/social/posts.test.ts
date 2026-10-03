import { describe, expect, it } from 'vitest'
import { BUILTIN_BY_ID } from '../data/exercises'
import type { ExerciseLog } from '../types'
import { buildPost, describePostItem, newPosts, postItemName, sanitizePost } from './posts'
import type { Post } from './types'

const lookup = (id: string) => BUILTIN_BY_ID.get(id)
const lb = { weight: 'lb', distance: 'mi' } as const
const kg = { weight: 'kg', distance: 'km' } as const
const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'

describe('buildPost', () => {
  const logs: ExerciseLog[] = [
    { exerciseId: BENCH, date: '2026-09-01', sets: [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }] },
    { exerciseId: BENCH, date: '2026-09-08', sets: [{ weight: 95, reps: 10, warmup: true }, { weight: 135, reps: 8 }, { weight: 155, reps: 6, done: true }, { weight: 165, reps: 2, done: false }] },
    { exerciseId: 'Pushups', date: '2026-09-08', sets: [{ weight: null, reps: 15 }, { weight: null, reps: 20 }] },
    { exerciseId: 'running', date: '2026-09-08', cardio: { distance: 3.1, minutes: 25.5 } },
    { exerciseId: 'Pullups', date: '2026-09-09', sets: [{ weight: null, reps: 10 }] },
  ]

  it('sums up the day: working sets, the top set, cardio distance and time, and new personal bests', () => {
    const p = buildPost('2026-09-08', logs, lookup, lb)!
    expect(p.payload.items).toEqual([
      // The warm-up and the unticked set don't count.
      { exerciseId: BENCH, name: BUILTIN_BY_ID.get(BENCH)!.name, sets: 2, weight: 155, reps: 6, best: 'New best' },
      { exerciseId: 'Pushups', name: BUILTIN_BY_ID.get('Pushups')!.name, sets: 2, reps: 20 },
      { exerciseId: 'running', name: 'Running', cardio: true, distance: 3.1, minutes: 25.5 },
    ])
    expect(p.title).toBe('A new personal best')
    expect(p.emoji).toBe('🔥')
  })

  it('names cardio records without units, and has nothing to post for an empty day', () => {
    const runs: ExerciseLog[] = [
      { exerciseId: 'running', date: '2026-09-01', cardio: { distance: 3.1, minutes: 27 } },
      { exerciseId: 'running', date: '2026-09-08', cardio: { distance: 4, minutes: 33 } },
    ]
    const p = buildPost('2026-09-08', runs, lookup, kg)!
    expect(p.payload.items[0].best).toBe('Longest run yet')
    expect(p.title).toBe('A new personal best')
    expect(buildPost('2026-09-10', logs, lookup, lb)).toBeNull()
  })
})

describe('showing a post', () => {
  it('uses the viewer’s units, and the viewer’s name for library exercises', () => {
    const bench = { exerciseId: BENCH, name: 'Bench', sets: 2, weight: 155, reps: 6 }
    expect(describePostItem(bench, lb)).toBe('2 sets · top 155 lb × 6')
    expect(describePostItem(bench, kg)).toMatch(/^2 sets · top 70(\.\d+)? kg × 6$/)
    expect(describePostItem({ exerciseId: 'running', name: 'Running', cardio: true, distance: 3.1, minutes: 25.5 }, lb)).toBe('3.1 mi · 25:30')
    expect(describePostItem({ exerciseId: 'running', name: 'Running', cardio: true, distance: 3.1, minutes: 25.5 }, kg)).toMatch(/km · 25:30$/)
    expect(describePostItem({ exerciseId: 'Plank', name: 'Plank', sets: 3, seconds: 120 }, lb)).toBe('3 sets · best 2:00')
    expect(describePostItem({ exerciseId: 'Pushups', name: 'Pushups', sets: 1, reps: 20 }, lb)).toBe('1 set · best 20 reps')
    expect(postItemName(bench)).toBe(BUILTIN_BY_ID.get(BENCH)!.name)
    expect(postItemName({ exerciseId: 'custom-x1', name: 'Sled push' })).toBe('Sled push')
  })

  it('counts friends’ posts newer than the last look as new, never my own', () => {
    const p = (id: string, createdAt: string, mine = false) => ({ id, createdAt, mine }) as Post
    const list = [p('a', '2026-10-02T10:00:00Z'), p('b', '2026-10-01T10:00:00Z'), p('c', '2026-10-03T10:00:00Z', true)]
    expect(newPosts(list, '2026-10-01T12:00:00Z').map((x) => x.id)).toEqual(['a'])
    expect(newPosts(list, '').map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('sanitizePost', () => {
  it('keeps what it can show and drops anything malformed or out of range', () => {
    expect(sanitizePost(null)).toBeNull()
    expect(sanitizePost({ version: 2, items: [] })).toBeNull()
    expect(sanitizePost({ version: 1, items: 'lots' })).toBeNull()
    expect(sanitizePost({ version: 1, items: [{ exerciseId: 'x' }] })).toBeNull() // no name, so nothing left
    const clean = sanitizePost({
      version: 1,
      items: [
        { exerciseId: 'Pushups', name: 'Pushups', sets: 3, reps: 20, weight: -5, seconds: 'long', best: 'x'.repeat(500), extra: '<script>' },
        { exerciseId: 'running', name: 'Running', cardio: true, distance: 1e9, minutes: 30 },
        'junk',
      ],
    })
    expect(clean).toEqual({ version: 1, items: [{ exerciseId: 'Pushups', name: 'Pushups', sets: 3, reps: 20 }, { exerciseId: 'running', name: 'Running', cardio: true, minutes: 30 }] })
    expect(sanitizePost({ version: 1, items: Array.from({ length: 100 }, (_, i) => ({ exerciseId: `e${i}`, name: `E${i}` })) })!.items).toHaveLength(40)
  })
})
