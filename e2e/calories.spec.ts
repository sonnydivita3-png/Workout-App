import { expect, test } from './fixtures'
import { seed, state } from './helpers'

test('Make me a workout for a calorie target: lifting keeps its time, the cardio makes up the rest', async ({ page }) => {
  await seed(page, { trainingPrefs: { styles: [], cardio: ['running'], cardioSplit: false } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.locator('.fixed').getByText('Make me a workout').click()
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: 'Lifting', exact: true }).click()
  await sheet.getByRole('button', { name: 'Cardio', exact: true }).click()
  await sheet.getByRole('button', { name: 'Full body', exact: true }).click()
  await expect(sheet.getByRole('button', { name: /^Generate/ })).toBeEnabled()

  await sheet.getByRole('group', { name: 'Plan by' }).getByRole('button', { name: 'Calories' }).click()
  await sheet.getByRole('button', { name: '1,000 cal' }).click()
  const status = sheet.getByRole('status')
  // Their weight and details come from their profile.
  await expect(status).toContainText('(180 lb)')
  // About 1,000 (minutes round to 5): roughly 2 hours for a 180 lb runner with 30 minutes of lifting.
  await expect(status).toContainText(/About (9[5-9]\d|1,0[0-4]\d) active cal in (1h 5\d|2h \d\d)/)
  // The cardio row is worked out; lifting keeps its own +/−.
  await expect(sheet.getByText('worked out for your target')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'More Cardio time' })).toHaveCount(0)
  const cardioBefore = await sheet.locator('li', { hasText: 'worked out for your target' }).textContent()
  // 20 more minutes of lifting: less cardio needed.
  for (let i = 0; i < 4; i++) await sheet.getByRole('button', { name: 'More Standard time' }).click()
  await expect(sheet.locator('li', { hasText: 'worked out for your target' })).not.toHaveText(cardioBefore!)

  await sheet.getByRole('button', { name: '500 cal' }).click()
  await expect(status).toContainText(/About \d{3} active cal in/)
  await sheet.getByRole('button', { name: /^Generate/ }).click()
  // The workout as made comes to about the target (its cardio fitted to it).
  await expect(sheet.getByText(/≈ (4[5-9]\d|5[0-4]\d) active cal/)).toBeVisible()

  const s = await state(page)
  expect(s.bodyweight.at(-1).lb).toBe(180)
})

test('Make me a workout for a calorie target, lifting only: the time grows to reach it, with a nudge to add cardio', async ({ page }) => {
  await seed(page, { bodyweight: [{ date: '2026-01-01', lb: 200 }] })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.locator('.fixed').getByText('Make me a workout').click()
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: 'Lifting', exact: true }).click()
  await sheet.getByRole('group', { name: 'Plan by' }).getByRole('button', { name: 'Calories' }).click()
  await sheet.getByRole('button', { name: '1,000 cal' }).click()
  const status = sheet.getByRole('status')
  await expect(status).toContainText(/\(200 lb\)/)
  await expect(status).toContainText('Adding cardio gets there in much less time')
})

test('1,000 calories in 1.5 hours, lifting + running: the pace it takes, and ways to make it doable', async ({ page }) => {
  await seed(page, { trainingPrefs: { styles: [], cardio: ['running'], cardioSplit: false }, bodyweight: [{ date: '2026-01-01', lb: 180 }] })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.locator('.fixed').getByText('Make me a workout').click()
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: 'Lifting', exact: true }).click()
  await sheet.getByRole('button', { name: 'Cardio', exact: true }).click()
  await sheet.getByRole('button', { name: 'Full body', exact: true }).click()
  await sheet.getByRole('button', { name: 'Running', exact: true }).click()
  await sheet.getByRole('group', { name: 'Plan by' }).getByRole('button', { name: 'Calories' }).click()
  await sheet.getByRole('button', { name: '1,000 cal' }).click()
  await sheet.getByRole('group', { name: 'Time limit' }).getByRole('button', { name: '1h 30m' }).click()
  const status = sheet.getByRole('status')
  await expect(status).toContainText(/About (9[5-9]\d|1,0[0-4]\d) active cal in 1h 30m/)
  // With a short lifting part the run is doable: about 7 mph for an hour.
  await expect(status).toContainText(/Running: 1h \d\dm at about [67](\.\d)? mph \(\d:\d\d \/mi\)/)
  await expect(status).not.toContainText('faster than most people')
  // 45 minutes of lifting leaves 45 for the run: it would have to be very fast.
  while (!/45 min/.test((await sheet.locator('li', { hasText: 'Standard' }).first().textContent())!)) await sheet.getByRole('button', { name: 'More Standard time' }).click()
  await expect(status).toContainText(/Running: 45 min at about (9|1\d)(\.\d)? mph/)
  await expect(status).toContainText('faster than most people can hold')
  // At a usual running pace it would take about 2¼ hours.
  await expect(status.getByRole('button', { name: 'Allow 2h 15m' })).toBeVisible()
  const speed = async () => Number((await status.textContent())!.match(/at about (\d+(?:\.\d)?) mph/)![1])
  const before = await speed()
  // Harder lifting burns more a minute, so the run can be slower.
  await status.getByRole('button', { name: 'Harder lifting: Supersets' }).click()
  await expect.poll(speed).toBeLessThan(before)

  await sheet.getByRole('button', { name: /^Generate/ }).click()
  await expect(sheet.getByText(/≈ (9[0-9]\d|1,0\d\d) active cal/)).toBeVisible()
  await sheet.getByRole('button', { name: /^Add to / }).click()
  const s = await state(page)
  const run = (Object.values(s.overrides).flat() as { exerciseId: string; distance?: number; minutes?: number; warmup?: boolean }[]).find((p) => p.exerciseId === 'running' && !p.warmup)!
  expect(run.distance! / (run.minutes! / 60)).toBeGreaterThan(8) // the pace it takes, as a target distance
})

test('lifting only within a time limit: the style it takes, one tap to switch', async ({ page }) => {
  await seed(page, { bodyweight: [{ date: '2026-01-01', lb: 180 }] })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.locator('.fixed').getByText('Make me a workout').click()
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: 'Lifting', exact: true }).click()
  await sheet.getByRole('button', { name: 'Full body', exact: true }).click()
  await sheet.getByRole('group', { name: 'Plan by' }).getByRole('button', { name: 'Calories' }).click()
  await sheet.getByRole('button', { name: '500 cal' }).click()
  await sheet.getByRole('group', { name: 'Time limit' }).getByRole('button', { name: '1h 00m' }).click()
  const status = sheet.getByRole('status')
  await expect(status).toContainText(/That takes .+-style work/)
  await status.getByRole('button', { name: /^Use / }).click()
  await expect(status).toContainText(/gets there\./)
  // 1,000 in an hour: no lifting style burns that much.
  await sheet.getByRole('button', { name: '1,000 cal' }).click()
  await expect(status).toContainText('No lifting style burns that much in that time')
  await expect(status.getByRole('button', { name: 'Add cardio' })).toBeVisible()
})

test('or at their own pace: their recent speed to start, a faster pace takes less time, and the run keeps it', async ({ page }) => {
  const log = (date: string, distance: number, minutes: number) => ({ date, exerciseId: 'running', cardio: { distance, minutes } })
  await seed(page, {
    trainingPrefs: { styles: [], cardio: ['running'], cardioSplit: false }, bodyweight: [{ date: '2026-01-01', lb: 180 }],
    logs: [log('2026-10-01', 3, 30), log('2026-10-05', 4, 40), log('2026-10-09', 5, 50)], // 6 mph
  })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.locator('.fixed').getByText('Make me a workout').click()
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: 'Lifting', exact: true }).click()
  await sheet.getByRole('button', { name: 'Cardio', exact: true }).click()
  await sheet.getByRole('button', { name: 'Full body', exact: true }).click()
  await sheet.getByRole('button', { name: 'Running', exact: true }).click()
  await sheet.getByRole('group', { name: 'Plan by' }).getByRole('button', { name: 'Calories' }).click()
  await sheet.getByRole('button', { name: '750 cal' }).click()
  const status = sheet.getByRole('status')
  await expect(sheet.getByText('Your recent average.')).toBeVisible()
  await expect(sheet.getByLabel('Your speed (mph)')).toHaveValue('6')
  await expect(status).toContainText(/Running: .+ at 6 mph \(10:00 \/mi\)/)
  const minutes = async () => {
    const m = (await status.textContent())!.match(/Running: (?:(\d)h )?(\d+)(?:m| min)/)!
    return Number(m[1] ?? 0) * 60 + Number(m[2])
  }
  const atSix = await minutes()
  await sheet.getByLabel('Your speed (mph)').fill('8')
  await expect(status).toContainText(/at 8 mph \(7:30 \/mi\)/)
  expect(await minutes()).toBeLessThan(atSix)
  await expect(sheet.getByText(/Lifting intensity is the style and the exercises: Standard ≈ \d active cal\/min/)).toBeVisible()

  await sheet.getByRole('button', { name: /^Generate/ }).click()
  await expect(sheet.getByText(/≈ (6[89]\d|7\d\d|8[0-2]\d) active cal/)).toBeVisible()
  await sheet.getByRole('button', { name: /^Add to / }).click()
  const s = await state(page)
  const ran = (Object.values(s.overrides).flat() as { exerciseId: string; distance?: number; minutes?: number; warmup?: boolean }[]).find((p) => p.exerciseId === 'running' && !p.warmup)!
  expect(ran.distance! / (ran.minutes! / 60)).toBeCloseTo(8, 0)
})

test('other cardio at the effort they pick: harder takes less time', async ({ page }) => {
  await seed(page, { trainingPrefs: { styles: [], cardio: ['rower'], cardioSplit: false }, bodyweight: [{ date: '2026-01-01', lb: 180 }] })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.locator('.fixed').getByText('Make me a workout').click()
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: 'Cardio', exact: true }).click()
  await sheet.getByRole('button', { name: 'Rower', exact: true }).click()
  await sheet.getByRole('group', { name: 'Plan by' }).getByRole('button', { name: 'Calories' }).click()
  await sheet.getByRole('button', { name: '500 cal' }).click()
  const status = sheet.getByRole('status')
  const total = async () => {
    const m = (await status.textContent())!.match(/in (?:(\d)h )?(\d+)(?:m| min)/)!
    return Number(m[1] ?? 0) * 60 + Number(m[2])
  }
  await expect(status).toContainText(/at a moderate effort/)
  const moderate = await total()
  await sheet.getByRole('group', { name: 'Effort' }).getByRole('button', { name: 'Very hard' }).click()
  await expect(status).toContainText(/at a very hard effort/)
  expect(await total()).toBeLessThan(moderate)
})

test('count calories as active or total: total includes resting, so the same target takes less time', async ({ page }) => {
  await seed(page, { trainingPrefs: { styles: [], cardio: ['running'], cardioSplit: false } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await page.locator('.fixed').getByText('Make me a workout').click()
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: 'Lifting', exact: true }).click()
  await sheet.getByRole('button', { name: 'Cardio', exact: true }).click()
  await sheet.getByRole('button', { name: 'Full body', exact: true }).click()
  await sheet.getByRole('button', { name: 'Running', exact: true }).click()
  await sheet.getByRole('group', { name: 'Plan by' }).getByRole('button', { name: 'Calories' }).click()
  await sheet.getByRole('button', { name: '750 cal' }).click()
  const status = sheet.getByRole('status')
  const minutes = async () => {
    const m = (await status.textContent())!.match(/cal in (?:(\d)h )?(\d+)(?:m| min)/)!
    return Number(m[1] ?? 0) * 60 + Number(m[2])
  }
  await expect(status).toContainText(/About \d{3} active cal in/)
  await expect(status).toContainText(/That’s about \d{3} total, counting what you’d burn anyway/)
  const active = await minutes()
  await sheet.getByRole('group', { name: 'Count calories as' }).getByRole('button', { name: 'Total' }).click()
  await expect(status).toContainText(/About \d{3} total cal in/)
  await expect(status).toContainText(/That’s about \d{3} active\./)
  expect(await minutes()).toBeLessThan(active)
  expect((await state(page)).trainingPrefs.calorieCount).toBe('total')
  await sheet.getByRole('button', { name: /^Generate/ }).click()
  await expect(sheet.getByText(/≈ \d{3} total cal/)).toBeVisible()
})
