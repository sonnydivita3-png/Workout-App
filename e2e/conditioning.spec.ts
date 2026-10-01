import { expect, test } from './fixtures'
import { iso, seed, state } from './helpers'

const AMRAP = { kind: 'amrap', minutes: 12 }
const amrapItems = [
  { exerciseId: 'Pushups', sets: 1, reps: 10, block: 'wod', blockLabel: 'AMRAP 12 min', wod: AMRAP },
  { exerciseId: 'x-burpee', sets: 1, reps: 10, block: 'wod', blockLabel: 'AMRAP 12 min', wod: AMRAP },
]

test('save a timed workout as a benchmark, repeat it, and see the results on Progress', async ({ page }) => {
  await seed(page, {
    overrides: { [iso(0)]: amrapItems },
    timedLogs: [{ id: 't1', date: iso(-14), block: 'wod', wod: AMRAP, title: 'AMRAP 12 min', movements: ['Pushups', 'x-burpee'], rounds: 5, reps: 4 }],
  })
  page.removeAllListeners('dialog')
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Push & burpee 12' : undefined))
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await expect(page.getByText('Last time: 5 rounds + 4 reps')).toBeVisible()
  await page.getByRole('button', { name: '☆ Save as benchmark' }).click()
  await expect(page.getByText('★ Benchmark · Push & burpee 12')).toBeVisible()
  await page.getByLabel('Full rounds').fill('6')
  await page.getByRole('button', { name: 'Save result' }).click()

  // Add it to another day from + Add.
  await page.getByRole('button', { name: 'Next week' }).click()
  await page.getByRole('button', { name: '+ Add' }).click()
  await page.getByRole('button', { name: /Benchmark workout/ }).click()
  await expect(page.getByText(/last: 6 rounds/)).toBeVisible()
  await page.getByRole('button', { name: /★ Push & burpee 12/ }).click()
  await expect(page.getByText('★ Benchmark · Push & burpee 12')).toBeVisible()

  await page.locator('nav').getByText('Progress').click()
  await expect(page.getByText('Conditioning · this week vs last')).toBeVisible()
  const bench = page.getByRole('button', { name: /★ Push & burpee 12/ })
  await expect(bench).toContainText('2 results')
  await expect(bench).toContainText('Best 6 rounds')
  await bench.click()
  await expect(page.getByText('Higher is better.')).toBeVisible()
  expect((await state(page)).benchmarks).toHaveLength(1)
})

test('Hyrox: log a finish time, compare with last time, and see run pace and cardio minutes', async ({ page }) => {
  const label = 'Hyrox-style · 2 × (500 m run + station)'
  const hyrox = [
    { exerciseId: 'running', sets: 1, minutes: 5, block: 'hyrox', blockLabel: label, est: 5 },
    { exerciseId: 'x-burpee-broad-jump', sets: 1, note: '40 m', block: 'hyrox', blockLabel: label, est: 3 },
    { exerciseId: 'x-row-erg', sets: 1, note: '500 m', block: 'hyrox', blockLabel: label, est: 2.5 },
  ]
  await seed(page, {
    overrides: { [iso(0)]: hyrox },
    timedLogs: [{ id: 'h0', date: iso(-7), block: 'hyrox', wod: { kind: 'fortime', minutes: 15, rounds: 2 }, title: label, movements: hyrox.map((p) => p.exerciseId), seconds: 16 * 60 + 5, hyrox: true }],
    logs: [{ date: iso(0), exerciseId: 'running', cardio: { distance: 0.62, minutes: 5.58 } }, { date: iso(-1), exerciseId: 'Bicycling_Stationary', cardio: { distance: null, minutes: 30 } }],
  })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await expect(page.getByText('Finish time')).toBeVisible()
  await expect(page.getByText('Last time: 16:05')).toBeVisible()
  await page.getByLabel('Hyrox minutes').fill('15')
  await page.getByLabel('Hyrox seconds').fill('20')
  await page.getByRole('button', { name: 'Save time' }).click()
  await expect(page.getByText('15:20')).toBeVisible()
  await expect(page.getByText(/runs 9:0\d \/mi/)).toBeVisible()
  // The run's own log is kept (a finish time doesn't replace station logs).
  expect((await state(page)).logs.some((l: { exerciseId: string; date: string }) => l.exerciseId === 'running' && l.date === iso(0))).toBe(true)

  await page.locator('nav').getByText('Progress').click()
  // The bike ride counts as cardio; the Hyrox run counts as conditioning, not both.
  await expect(page.getByText(/^(30 of 150 min|0 of 150 min)/)).toBeVisible()
  await expect(page.getByText(/^(30 of 150 min|.*last week 30 min)/).first()).toBeVisible()
  const track = page.getByRole('button', { name: /Hyrox · 2 × \(500 m run \+ station\)/ })
  await expect(track).toContainText('Best 15:20')
  await track.click()
  await expect(page.getByText('Lower is better (finish time).')).toBeVisible()
})

test('cardio calories: asks for bodyweight, then shows an estimate labelled as one, and takes a watch number', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: 'running', sets: 1, minutes: 30 }] } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByLabel('Running minutes').fill('30')
  await page.getByLabel('Running distance').fill('3')
  await expect(page.getByText(/Estimated calories need your bodyweight/)).toBeVisible()

  // Add a bodyweight and the estimate appears, marked as estimated.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('workout-app-v1')!)
    raw.state.bodyweight = [{ date: '2026-01-01', lb: 185 }]
    localStorage.setItem('workout-app-v1', JSON.stringify(raw))
  })
  await page.reload()
  await page.locator('nav').getByText('Workouts').click()
  await expect(page.getByText('≈411 cal, estimated')).toBeVisible()
  await expect(page.getByText(/from your bodyweight \(185 lb\), the activity and its time and pace/)).toBeVisible()
  await page.locator('nav').getByText('Progress').click()
  await expect(page.getByText('≈411 cal')).toBeVisible()
  await expect(page.getByText(/\(estimated\)/)).toBeVisible()
  await expect(page.getByText(/Estimates use your bodyweight/)).toBeVisible()

  // Their watch's number replaces the estimate.
  await page.locator('nav').getByText('Workouts').click()
  await page.getByLabel('Running calories').fill('380')
  await expect(page.getByText('Your number (e.g. from your watch).')).toBeVisible()
  expect((await state(page)).logs[0].cardio.calories).toBe(380)
  await page.locator('nav').getByText('Progress').click()
  await expect(page.getByText('380 cal', { exact: true })).toBeVisible()
  await expect(page.getByText(/Estimates use your bodyweight/)).toHaveCount(0)
})
