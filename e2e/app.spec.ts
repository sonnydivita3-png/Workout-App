import { expect, test, type Page } from '@playwright/test'

/** The app as it opens on a given morning of the plan, with any security-policy or script error failing the test. */
async function open(page: Page, when = '2026-12-01T08:00:00') {
  await page.clock.install({ time: new Date(when) })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('dialog', (d) => void d.accept())
  await page.goto('/')
  return errors
}
const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name })
const saved = async (page: Page) => JSON.parse((await page.evaluate(() => localStorage.getItem('durata-v2')))!).state

test('today: check off a strength workout and a run, and it’s all still there after a reload', async ({ page }) => {
  const errors = await open(page)
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByText('Week 1 of 23')).toBeVisible()
  await expect(page.getByText('2,700 kcal · P200 C295 F80')).toBeVisible()

  // Strength A, Phase 1: tick an exercise and log a set.
  const a = page.getByRole('region', { name: 'Strength A' })
  await expect(a.getByText('Legs · Phase 1 · 0 of 7 exercises')).toBeVisible()
  await a.getByRole('checkbox', { name: 'Trap-bar deadlift, high handles done' }).click()
  await a.getByRole('button', { name: /Trap-bar deadlift/ }).click()
  await a.getByLabel('Trap-bar deadlift, high handles set 1 weight').fill('185')
  await a.getByLabel('Trap-bar deadlift, high handles set 1 reps').fill('5')
  await expect(a.getByText('1 of 7 exercises')).toBeVisible()

  // Every exercise ticked marks the workout done.
  for (const name of ['Rear-foot-elevated split squat', 'Step-up, 12–16 in box', 'Hip thrust', 'Single-leg calf raise', 'Suitcase carry, 40 yd', 'Side plank, 30–45 s']) {
    await a.getByRole('checkbox', { name: `${name} done` }).click()
  }
  await expect(a.getByRole('checkbox', { name: 'Strength A done' })).toHaveAttribute('aria-checked', 'true')

  // The easy run: done, with what it came to.
  const run = page.getByRole('region', { name: 'Easy run' })
  await run.getByRole('checkbox', { name: 'Easy run done' }).click()
  await run.getByLabel('Easy run miles').fill('3.2')
  await run.getByLabel('Easy run time').fill('0:38')
  await expect(run.getByText('11:53 /mi')).toBeVisible()

  // The spine routine and a note.
  await page.getByRole('checkbox', { name: 'Spine routine done' }).click()
  await page.getByLabel('Note').fill('Back 1/10')

  await page.reload()
  await expect(page.getByRole('region', { name: 'Strength A' }).getByText('7 of 7 exercises')).toBeVisible()
  await expect(page.getByLabel('Easy run miles')).toHaveValue('3.2')
  await expect(page.getByLabel('Note')).toHaveValue('Back 1/10')
  const s = await saved(page)
  expect(s.logs['ice-age-50k-2027|2026-12-01']).toMatchObject({ spine: true, note: 'Back 1/10', items: { 0: { status: 'done', ex: { 0: { done: true, sets: [{ lb: 185, reps: 5 }] } } }, 1: { status: 'done', miles: 3.2, minutes: 38 } } })

  // The calendar shows the day done and the week's miles.
  await tab(page, 'Calendar').click()
  const week1 = page.getByRole('region', { name: 'Week 1' })
  await expect(week1.getByText('3.2/13 mi')).toBeVisible()
  await expect(week1.getByRole('button', { name: /Dec 1: Strength A, Easy run, done/ })).toBeVisible()
  await expect(week1.getByRole('button', { name: /Nov 30: rest, rest day/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('skipping, rest days, other days and phases', async ({ page }) => {
  await open(page)
  await page.getByRole('region', { name: 'Easy run' }).getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('region', { name: 'Easy run' }).getByRole('button', { name: 'Skipped' })).toBeVisible()

  // Monday is a rest day with the week's run total.
  await page.getByRole('button', { name: 'Previous day' }).click()
  await expect(page.locator('p').getByText('Rest day', { exact: true })).toBeVisible()
  await expect(page.getByText('Run total this week: 13 mi')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Spine routine done' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to today' }).click()

  // A Phase 2 day from the calendar: hills first, then Strength A with pogo hops.
  await tab(page, 'Calendar').click()
  await page.getByRole('region', { name: 'Week 7' }).getByRole('button', { name: /^Jan 12:/ }).click()
  await expect(page.getByRole('heading', { name: 'Tue, Jan 12' })).toBeVisible()
  await expect(page.getByText('Hills 5 mi · 6×60 s')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Strength A' }).getByText('Pogo hops')).toBeVisible()
  await expect(page.getByText('Phase 2 · Build')).toBeVisible()

  // Race day.
  await tab(page, 'Calendar').click()
  await page.getByRole('region', { name: 'Week 23' }).getByRole('button', { name: /^May 8:/ }).click()
  await expect(page.getByText('Ice Age Trail 50K', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('31 miles · La Grange')).toBeVisible()
})

test('Workout done marks the rest done and folds the day; Edit opens it again', async ({ page }) => {
  await open(page)
  await page.getByRole('region', { name: 'Easy run' }).getByRole('checkbox', { name: 'Easy run done' }).click()
  await page.getByLabel('Easy run miles').fill('3.1')
  await page.getByLabel('Easy run time').fill('0:36')
  await page.getByLabel('Note').fill('Felt easy')
  await page.getByRole('button', { name: 'Workout done' }).click()
  const summary = page.getByRole('region', { name: 'Workout summary' })
  await expect(summary.getByText('✓ Strength A · 55 min')).toBeVisible()
  await expect(summary.getByText('3.1 mi · 36 min · 11:37 /mi')).toBeVisible()
  await expect(summary.getByText('Felt easy')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Strength A' })).toHaveCount(0)
  // Strength A wasn't ticked, so Workout done counted it as done; the day is done on the week strip.
  await expect(page.getByRole('navigation', { name: 'This week' }).getByRole('button', { name: /Tue, Dec 1, done/ })).toBeVisible()
  await page.reload()
  await expect(summary).toBeVisible()
  await summary.getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByRole('region', { name: 'Strength A' }).getByRole('checkbox', { name: 'Strength A done' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: 'Workout done' })).toBeVisible()
})

test('Missed workout skips what wasn’t done and folds the day as missed', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Missed workout' }).click()
  const summary = page.getByRole('region', { name: 'Workout summary' })
  await expect(summary.getByText('Workout missed')).toBeVisible()
  expect((await saved(page)).logs['ice-age-50k-2027|2026-12-01']).toMatchObject({ finished: true, items: { 0: { status: 'skipped' }, 1: { status: 'skipped' } } })
  await expect(page.getByRole('navigation', { name: 'This week' }).getByRole('button', { name: /Tue, Dec 1, skipped/ })).toBeVisible()
  // Something already done stays done.
  await summary.getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('region', { name: 'Easy run' }).getByRole('button', { name: 'Skipped' }).click()
  await page.getByRole('region', { name: 'Easy run' }).getByRole('checkbox', { name: 'Easy run done' }).click()
  await page.getByRole('button', { name: 'Missed workout' }).click()
  await expect(summary.getByText('Workout done')).toBeVisible()
  expect((await saved(page)).logs['ice-age-50k-2027|2026-12-01'].items).toMatchObject({ 0: { status: 'skipped' }, 1: { status: 'done' } })
})

test('weight: weigh-ins against the weekly goal', async ({ page }) => {
  await open(page)
  await tab(page, 'Weight').click()
  await page.getByLabel('Weight in lb').fill('219.4')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Week 1: average 219.4 lb · goal 215.5 lb (3.9 lb over)')).toBeVisible()
  await page.getByLabel('Date').fill('2026-11-30')
  await page.getByLabel('Weight in lb').fill('218')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText(/average 218\.7 lb/)).toBeVisible()
  await page.getByRole('button', { name: 'Delete Mon, Nov 30 weigh-in' }).click()
  expect((await saved(page)).weights).toEqual({ '2026-12-01': 219.4 })
})

test('the plan tab: workouts by phase, routine, effort guide and this month’s notes', async ({ page }) => {
  await open(page)
  await tab(page, 'Plan').click()
  const a = page.getByRole('region', { name: 'Strength A' })
  await expect(a.getByRole('tab', { name: 'Phase 1 (now)' })).toHaveAttribute('aria-selected', 'true')
  await expect(a.getByText('4 × 5')).toBeVisible()
  await a.getByRole('tab', { name: 'Taper' }).click()
  await expect(a.getByText('Light: 80% of your usual weights.', { exact: false })).toBeVisible()
  await expect(page.getByText('Side-rib breathing into your left ribs', { exact: false })).toBeVisible()
  await expect(page.getByText('Full sentences, about 120–140 bpm.', { exact: false })).toBeVisible()
  await expect(page.getByText('Lift before you run. Strength is the priority', { exact: false })).toBeVisible()
})

const tinyPlan = {
  format: 'durata-plan', version: 1, id: 'test-10k', name: 'Test 10K', start: '2026-11-30', end: '2026-12-06', phases: [], weeks: [{ number: 1, start: '2026-11-30', miles: 5 }],
  targets: {}, workouts: {}, days: ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06'].map((date, i) => ({ date, items: i === 1 ? [{ type: 'run', title: 'Tempo run', miles: 5 }] : [] })),
}

test('import a new plan, see what’s wrong with a bad one, and go back', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  const sheet = page.getByRole('dialog', { name: 'Settings' })
  await sheet.getByLabel('Import a plan file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...tinyPlan, days: [{ date: '2026-11-30', items: [{ type: 'swim' }] }] })) })
  await expect(sheet.getByRole('status')).toContainText('This plan file has problems')
  await expect(sheet.getByRole('status')).toContainText('day 2026-11-30.items[0].title: is missing')
  await sheet.getByLabel('Import a plan file').setInputFiles({ name: 'plan.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(tinyPlan)) })
  await expect(sheet.getByRole('status')).toContainText('Now following “Test 10K”: 7 days.')
  await sheet.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByText('Tempo run 5 mi')).toBeVisible()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Back to Ice Age Trail 50K' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('region', { name: 'Strength A' })).toBeVisible()
})

test('export a backup and restore it', async ({ page }) => {
  await open(page)
  await page.getByRole('region', { name: 'Easy run' }).getByRole('checkbox', { name: 'Easy run done' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export a backup/ }).click()])
  expect(download.suggestedFilename()).toBe('durata-backup-2026-12-01.json')
  const file = await download.path()
  // Clear the log, then restore it from the file.
  await page.evaluate(() => localStorage.removeItem('durata-v2'))
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Easy run done' })).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Restore a backup').setInputFiles(file)
  await expect(page.getByRole('dialog', { name: 'Settings' }).getByRole('status')).toHaveText('Backup restored.')
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('checkbox', { name: 'Easy run done' })).toHaveAttribute('aria-checked', 'true')
})

test('before the plan starts, Today says when it does', async ({ page }) => {
  await open(page, '2026-11-21T08:00:00')
  await expect(page.getByText('Ice Age Trail 50K starts Mon, Nov 30')).toBeVisible()
  await expect(page.getByText('In 9 days. Week 1 is on the Calendar tab.')).toBeVisible()
})
