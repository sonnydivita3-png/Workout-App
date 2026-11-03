import { expect, test } from './fixtures'
import { iso, seed } from './helpers'

const amrap = { kind: 'amrap', minutes: 10 }
const block = (exerciseId: string, reps: number) => ({ exerciseId, sets: 1, reps, block: 'wod-1', blockLabel: 'AMRAP 10 min', wod: amrap, est: 5 })

test('a stray tap outside a running workout clock asks before stopping it', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [block('Pushups', 10), block('Bodyweight_Squat', 15)] } })
  // Answer the question ourselves: first "no, keep it", then "yes".
  page.removeAllListeners('dialog')
  const asked: string[] = []
  let answer = false
  page.on('dialog', (d) => { asked.push(d.message()); void (answer ? d.accept() : d.dismiss()) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: '⏱ Start timer' }).click()
  const clock = page.getByRole('dialog', { name: 'AMRAP 10 min' })
  await clock.getByRole('button', { name: 'Start' }).click()
  // Running: under 10:00 (any second of the first minute, however busy the machine is).
  await expect(clock.getByText(/^9:[0-5]\d$/)).toBeVisible()

  // Tapping the dimmed page above the sheet: asked, kept, still running.
  await page.mouse.click(200, 40)
  expect(asked).toHaveLength(1)
  await expect(clock.getByRole('button', { name: 'Pause' })).toBeVisible()
  // Closing it on purpose, once confirmed.
  answer = true
  await clock.getByRole('button', { name: 'Close' }).click()
  await expect(clock).toHaveCount(0)
  expect(asked).toHaveLength(2)
})
