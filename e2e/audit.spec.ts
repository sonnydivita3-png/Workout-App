import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { iso, openSettings, seed, state } from './helpers'

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'
const plannedBench = {
  overrides: { [iso(0)]: [{ exerciseId: BENCH, sets: 2, reps: 8 }] },
  logs: [{ date: iso(-3), exerciseId: BENCH, sets: [{ weight: 135, reps: 8 }, { weight: 135, reps: 8 }] }],
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

test('notifications show on top of workout mode', async ({ page }) => {
  await seed(page, { ...plannedBench, notifPrefs: { system: false, goals: false, pbs: true, daily: false, reminderTime: '23:59' } })
  await page.goto('/')
  await page.getByRole('button', { name: '▶ Start workout' }).click()
  await page.getByRole('button', { name: 'Fill' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'New PR' })).toBeVisible()
  expect(await onTop(page, '[role=status] button')).toBe(true)
})

test('the "Back to your workout" button does not cover + Add', async ({ page }) => {
  await seed(page, plannedBench)
  await page.goto('/')
  await page.getByRole('button', { name: '▶ Start workout' }).click()
  await page.getByRole('button', { name: 'Minimize workout' }).click()
  await page.locator('nav').getByText('Plan').click()
  await expect(page.getByRole('button', { name: '▶ Back to your workout' })).toBeVisible()
  expect(await onTop(page, 'button.fixed.left-1\\/2')).toBe(true) // + Add
})

test('a workout left running for hours does not take over the app', async ({ page }) => {
  await seed(page, { ...plannedBench, session: { date: iso(-1), startedAt: Date.now() - 20 * 3600 * 1000 } })
  await page.goto('/')
  await expect(page.getByText('Goals')).toBeVisible()
  expect((await state(page)).session).toBeNull()
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

test('how-to and the hold timer open on top of workout mode', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: 'Plank', sets: 2, seconds: 30 }] } })
  await page.goto('/')
  await page.getByRole('button', { name: '▶ Start workout' }).click()
  await page.getByRole('button', { name: 'Plank', exact: true }).click()
  await expect(page.getByText(/Get into a prone position/i)).toBeVisible()
  await page.locator('.fixed').getByRole('button', { name: 'Close' }).last().click()
  await page.getByRole('button', { name: 'Time set 1' }).click()
  await expect(page.getByText('Target 0:30')).toBeVisible()
})

test('a plateau suggests a deload', async ({ page }) => {
  const B = 'Barbell_Bench_Press_-_Medium_Grip'
  const at = (d: number) => ({ date: iso(d), exerciseId: B, sets: [{ weight: 185, reps: 8 }, { weight: 185, reps: 6 }] })
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: B, sets: 2, reps: 8 }] }, logs: [at(-3), at(-6), at(-9)] })
  await page.goto('/')
  await page.locator('nav').getByText('Plan').click()
  await expect(page.getByText('🎯 Try 165 lb × 8')).toBeVisible()
  await expect(page.getByText(/No progress in your last 3 sessions/)).toBeVisible()
})
