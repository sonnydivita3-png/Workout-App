import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { iso, openSettings, seed, state } from './helpers'

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'
const plannedBench = {
  overrides: { [iso(0)]: [{ exerciseId: BENCH, sets: 2, reps: 8 }] },
  // Two over the target on every set last time: the suggestion adds weight.
  logs: [{ date: iso(-3), exerciseId: BENCH, sets: [{ weight: 135, reps: 10 }, { weight: 135, reps: 10 }] }],
}

/** Is the element actually on top (clickable) at its centre? */
async function onTop(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return false
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return !!hit && (el === hit || el.contains(hit))
  }, selector)
}

test('notifications show on top of the workout', async ({ page }) => {
  await seed(page, { ...plannedBench, notifPrefs: { system: false, goals: false, pbs: true, daily: false, reminderTime: '23:59' } })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start workout' }).click()
  // ✓ logs the suggested target (heavier than ever): no cheer mid-workout, it comes with Finish workout.
  await page.getByRole('button', { name: 'Set 1 done' }).click()
  await page.getByRole('button', { name: 'Set 2 done' }).click()
  await page.waitForTimeout(1500)
  await expect(page.getByRole('status').filter({ hasText: /personal best|PR/ })).toHaveCount(0)
  await page.getByRole('button', { name: '✓ Finish workout' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'New personal best 🏆' })).toBeVisible()
  expect(await onTop(page, '[role=status] button')).toBe(true)
})

test('with the rest timer turned on, ticking a set starts it and Finish workout stays reachable', async ({ page }) => {
  await seed(page, { ...plannedBench, restSeconds: 60 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: 'Set 1 done' }).click()
  await expect(page.getByRole('timer')).toContainText('Rest')
  await page.getByRole('button', { name: '✓ Finish workout' }).click()
  await expect(page.getByRole('dialog', { name: 'Finish workout?' })).toBeVisible()
})

test('the rest timer is off unless turned on, and there is no workout clock', async ({ page }) => {
  await seed(page, { ...plannedBench, restSeconds: undefined, session: { date: iso(0), startedAt: Date.now() - 3600 * 1000 } })
  await page.goto('/')
  await expect(page.getByText('Goals')).toBeVisible() // an old saved workout-mode session doesn't take over
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: 'Set 1 done' }).click()
  await expect(page.getByRole('timer')).toHaveCount(0)
  expect((await state(page)).restSeconds).toBe(0)
})

test('cloud backup that is on but signed out offers a way to sign in', async ({ page }) => {
  await seed(page, { cloud: { enabled: true, lastSyncedAt: null, lastHash: null, conflict: false, error: null, checkedAt: null } })
  await page.goto('/')
  await openSettings(page, 'Backup & data')
  await expect(page.getByRole('button', { name: 'Sign in to back up' })).toBeVisible()
})

test('a backup file restores programs too, and a damaged file cannot break the app', async ({ page }) => {
  await seed(page, { programs: [{ id: 'p1', kind: 'cardio', title: '10K plan', sport: 'run', createdAt: '', entries: [{ date: iso(3), exerciseId: 'running' }] }], overrides: { [iso(3)]: [{ exerciseId: 'running', sets: 1 }] } })
  await page.goto('/')
  await openSettings(page, 'Backup & data')
  await page.getByRole('button', { name: /Backup file/ }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export/ }).first().click()])
  const file = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString()))
  expect(file.programs).toHaveLength(1)
  file.logs.push({ exerciseId: 7 }, null)
  await page.locator('input[type=file][accept="application/json"]').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) })
  await expect(page.getByText('Backup restored.')).toBeVisible()
  const s = await state(page)
  expect(s.programs).toHaveLength(1)
  expect(s.logs.every((l: unknown) => l && typeof (l as { exerciseId: unknown }).exerciseId === 'string')).toBe(true)
})

test('the hold timer opens from the workout', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: 'Plank', sets: 2, seconds: 30 }] } })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: 'Time set 1' }).click()
  await expect(page.getByText('Target 0:30')).toBeVisible()
})

test('a plateau suggests a deload', async ({ page }) => {
  const B = 'Barbell_Bench_Press_-_Medium_Grip'
  const at = (d: number) => ({ date: iso(d), exerciseId: B, sets: [{ weight: 185, reps: 8 }, { weight: 185, reps: 6 }] })
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: B, sets: 2, reps: 8 }] }, logs: [at(-3), at(-6), at(-9)] })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await expect(page.getByText('🎯 Try 165 lb × 8')).toBeVisible()
  await expect(page.getByText(/No progress in your last 3 sessions/)).toBeVisible()
})
