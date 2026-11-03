import { expect, test } from './fixtures'
import { iso, openSettings, seed, state } from './helpers'

const fmtLong = (date: string) => new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

test('two runs on one day: deleting one from its history keeps the other', async ({ page }) => {
  const twoRuns = iso(-9)
  await seed(page, {
    logs: [
      { date: twoRuns, exerciseId: 'running', cardio: { distance: 5.1, minutes: 48, parts: [{ distance: 3, minutes: 27 }, { distance: 2.1, minutes: 21 }] } },
      { date: iso(-2), exerciseId: 'running', cardio: { distance: 4, minutes: 36 } },
    ],
  })
  await page.goto('/')
  await page.locator('nav').getByText('Progress').click()
  await page.getByRole('button', { name: 'Exercises', exact: true }).click()
  await page.getByRole('button', { name: /^Running/ }).click()
  await expect(page.getByRole('button', { name: new RegExp(`^Delete ${fmtLong(twoRuns)}`) })).toHaveCount(2)

  await page.getByRole('button', { name: `Delete ${fmtLong(twoRuns)}, run 2` }).click()
  await expect(page.getByRole('button', { name: new RegExp(`^Delete ${fmtLong(twoRuns)}`) })).toHaveCount(1)
  await expect(page.getByText('3 mi · 27 min · 9:00 /mi')).toBeVisible()
  await expect(page.getByText(/^2\.1 mi/)).toHaveCount(0)
  const logs = (await state(page)).logs
  expect(logs.find((l: { date: string }) => l.date === twoRuns).cardio).toEqual({ distance: 3, minutes: 27 })
  expect(logs).toHaveLength(2)
})

test('a minus sign typed by mistake is dropped: no negative weights, reps or distances', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: 'Barbell_Squat', sets: 1, reps: 5 }, { exerciseId: 'running', sets: 1, minutes: 30 }] } })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('spinbutton', { name: 'Set 1 lb', exact: true }).fill('-135')
  await page.getByRole('spinbutton', { name: 'Set 1 reps', exact: true }).fill('-5')
  await page.getByRole('spinbutton', { name: 'Running distance' }).fill('-2')
  await page.getByRole('spinbutton', { name: 'Running minutes' }).fill('20')
  await expect(page.getByRole('spinbutton', { name: 'Set 1 lb', exact: true })).toHaveValue('135')
  await expect(page.getByText('10:00 /mi')).toBeVisible()
  const logs = (await state(page)).logs
  expect(logs.find((l: { exerciseId: string }) => l.exerciseId === 'Barbell_Squat').sets[0]).toMatchObject({ weight: 135, reps: 5 })
  expect(logs.find((l: { exerciseId: string }) => l.exerciseId === 'running').cardio).toMatchObject({ distance: 2, minutes: 20 })
})

test('a backup file can be picked again after saying no to restoring it', async ({ page }) => {
  await seed(page, { name: 'Now' })
  page.removeAllListeners('dialog')
  let restore = false
  page.on('dialog', (d) => void (restore ? d.accept() : d.dismiss()))
  await page.goto('/')
  await openSettings(page, 'Backup & data')
  await page.getByRole('button', { name: /Backup file/ }).click()
  const box = page.locator('input[type=file][accept="application/json"]')
  const backup = { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'workout', plan: Array.from({ length: 7 }, () => []), logs: [], name: 'Restored' })) }
  await box.setInputFiles(backup)
  // Said no: nothing changes, and the box is ready for the same file again (a browser skips a file already in it).
  await expect(box).toHaveValue('')
  expect((await state(page)).name).toBe('Now')
  restore = true
  await box.setInputFiles(backup)
  await expect(page.getByText('Backup restored.')).toBeVisible()
  await expect(box).toHaveValue('')
  expect((await state(page)).name).toBe('Restored')
})
