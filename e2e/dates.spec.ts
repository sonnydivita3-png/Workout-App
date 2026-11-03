import { expect, test } from './fixtures'
import { seed, state } from './helpers'

// Tuesday squats, Wednesday bench, as the usual week.
const plan = Array.from({ length: 7 }, () => [] as unknown[])
plan[1] = [{ exerciseId: 'Barbell_Squat', sets: 2, reps: 5 }]
plan[2] = [{ exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: 2, reps: 5 }]
const logs = [
  { date: '2026-10-27', exerciseId: 'Barbell_Squat', sets: [{ weight: 225, reps: 5 }, { weight: 225, reps: 5 }] },
  { date: '2026-10-28', exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: [{ weight: 185, reps: 5 }, { weight: 185, reps: 5 }] },
]
const nextMorning = async (page: import('@playwright/test').Page, at: string) => {
  await page.clock.setSystemTime(new Date(at))
  // The phone brings the app back to the front.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
}

test('the Workouts tab left open overnight moves on to the new day, unless a workout is still going', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-03T22:00:00') })
  await seed(page, { plan, logs })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await expect(page.getByRole('heading', { name: 'Tuesday · Today' })).toBeVisible()

  // Opened again the next morning: today's workout, and a set logs on today's date.
  await nextMorning(page, '2026-11-04T08:00:00')
  await expect(page.getByRole('heading', { name: 'Wednesday · Today' })).toBeVisible()
  await page.getByRole('button', { name: 'Set 1 done', exact: true }).click()
  await expect.poll(async () => (await state(page)).logs.find((l: { exerciseId: string; date: string }) => l.date === '2026-11-04')?.exerciseId).toBe('Barbell_Bench_Press_-_Medium_Grip')
})

test('a workout going past midnight stays on its day, and says which day it is', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-03T23:30:00') })
  await seed(page, { plan, logs })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: 'Set 1 done', exact: true }).click()
  await nextMorning(page, '2026-11-04T00:10:00')
  await expect(page.getByRole('heading', { name: /^Tuesday, / })).toBeVisible()
  await page.getByRole('button', { name: 'Set 2 done', exact: true }).click()
  await expect.poll(async () => (await state(page)).logs.find((l: { date: string }) => l.date === '2026-11-03')?.sets.filter((x: { done?: boolean }) => x.done).length).toBe(2)
})

test('clearing "the rest of this week" stops at Sunday', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-04T10:00:00') }) // a Wednesday
  const days = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']
  const item = { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: 3, reps: 8, plan: 'pr-1' }
  await seed(page, {
    overrides: Object.fromEntries(days.map((d) => [d, [item]])),
    programs: [{ id: 'pr-1', kind: 'program', title: 'My plan', createdAt: '2026-11-01T10:00:00.000Z', entries: days.map((date) => ({ date, exerciseIds: [item.exerciseId] })) }],
  })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: 'Clear days…' }).click()
  await page.getByRole('button', { name: 'The rest of this week' }).click()
  // Wednesday to Sunday: five days. Next week's Monday on stays planned.
  await page.getByRole('button', { name: 'Clear 5 days' }).click()
  expect(Object.keys((await state(page)).overrides).sort()).toEqual(['2026-11-09', '2026-11-10', '2026-11-11'])
})
