import { expect, test } from './fixtures'
import { iso, openSettings, seed, state } from './helpers'

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
  // The Hyrox run counts toward calories too (estimated from their profile).
  await expect(page.getByText(/Estimates use your bodyweight/)).toBeVisible()
  const track = page.getByRole('button', { name: /Hyrox · 2 × \(500 m run \+ station\)/ })
  await expect(track).toContainText('Best 15:20')
  await track.click()
  await expect(page.getByText('Lower is better (finish time).')).toBeVisible()
})

test('cardio calories: an estimate from their profile, labelled as one, and a watch number replaces it', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: 'running', sets: 1, minutes: 30 }] }, bodyweight: [{ date: '2026-01-01', lb: 185 }] })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByLabel('Running minutes').fill('30')
  await page.getByLabel('Running distance').fill('3')
  // 3 miles in 30 minutes (6 mph, MET 9.8) at 185 lb, less a 36-year-old 5'10" man's resting burn: about 374.
  await expect(page.getByText('≈374 cal, estimated')).toBeVisible()
  await expect(page.getByText(/from your bodyweight \(185 lb\), sex, age, height, the activity and its time and pace/)).toBeVisible()
  await page.locator('nav').getByText('Progress').click()
  await expect(page.getByText('≈374 cal')).toBeVisible()
  await expect(page.getByText(/\(estimated\)/)).toBeVisible()
  await expect(page.getByText(/Estimates use your bodyweight/)).toBeVisible()
  // …and on Home, next to workouts this week.
  await page.locator('nav').getByText('Home').click()
  const week = page.getByRole('region', { name: 'This week' })
  await expect(week).toContainText('≈374cal burned in cardioestimated from bodyweight')

  // Their watch's number replaces the estimate.
  await page.locator('nav').getByText('Workouts').click()
  await page.getByLabel('Running calories').fill('380')
  await expect(page.getByText('Your number (e.g. from your watch).')).toBeVisible()
  expect((await state(page)).logs[0].cardio.calories).toBe(380)
  await page.locator('nav').getByText('Progress').click()
  await expect(page.getByText('380 cal', { exact: true })).toBeVisible()
  await expect(page.getByText(/Estimates use your bodyweight/)).toHaveCount(0)
  await page.locator('nav').getByText('Home').click()
  await expect(page.getByRole('region', { name: 'This week' })).toContainText('380cal burned in cardio')
})

test('sex, age and height set the resting burn, change in Settings, and Help explains how calories are worked out', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: 'running', sets: 1 }] }, bodyweight: [{ date: '2026-01-01', lb: 185 }], logs: [{ date: iso(0), exerciseId: 'running', cardio: { distance: 3, minutes: 30 } }] })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await expect(page.getByText('≈374 cal, estimated')).toBeVisible()
  await openSettings(page, 'Profile, units & equipment')
  // A woman of the same age and size burns less at rest, so a little more of the run is on top of it.
  await page.getByRole('group', { name: 'Sex' }).getByRole('button', { name: 'Female' }).click()
  await page.getByLabel('Birth year').fill('1980')
  expect((await state(page)).aboutMe).toEqual({ sex: 'female', birthYear: 1980, heightIn: 70 })
  await page.getByRole('button', { name: 'How calories are estimated' }).click()
  await page.getByText('What information does it need?').click()
  await expect(page.getByText(/Your bodyweight \(log it in Progress → Body\)/)).toBeVisible()
  await page.locator('nav').getByText('Workouts').click()
  await expect(page.getByText(/≈3(7[5-9]|8\d) cal, estimated/)).toBeVisible()
})


test('rowing in meters with minutes and seconds, pace per 500 m', async ({ page }) => {
  await seed(page, {
    overrides: { [iso(0)]: [{ exerciseId: 'x-row-erg', sets: 1, distance: 2000 / 1609.344 }, { exerciseId: 'running', sets: 1 }] },
    logs: [{ date: iso(-7), exerciseId: 'x-row-erg', cardio: { distance: 2000 / 1609.344, minutes: 7 + 45 / 60 } }],
  })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await expect(page.getByText('Cardio · target 2,000 m')).toBeVisible()
  await expect(page.getByText('Last time: 2,000 m · 7:45 · 1:56 /500m')).toBeVisible()
  await page.getByLabel('Rower distance').fill('2000')
  await page.getByLabel('Rower minutes').fill('7')
  await page.getByLabel('Rower seconds').fill('32')
  await expect(page.getByText('1:53 /500m')).toBeVisible()
  // A faster 2,000 m than ever, but the cheer waits for Finish workout.
  await expect(page.getByText(/🏆/)).toHaveCount(0)
  const log = (await state(page)).logs.find((l: { exerciseId: string; date: string }) => l.exerciseId === 'x-row-erg' && l.date === iso(0))
  expect(log.cardio.distance * 1609.344).toBeCloseTo(2000, 5)
  expect(log.cardio.minutes).toBeCloseTo(7 + 32 / 60, 5)
  // Runs still follow the miles setting.
  await expect(page.locator('label', { hasText: 'Miles' })).toHaveCount(1)
  await expect(page.locator('label', { hasText: 'Meters' })).toHaveCount(1)
})

test('switch a cardio card between meters, km and miles; swimming in meters or yards', async ({ page }) => {
  await seed(page, {
    overrides: { [iso(0)]: [{ exerciseId: 'x-row-erg', sets: 1 }, { exerciseId: 'swimming', sets: 1 }] },
  })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByLabel('Rower distance').fill('2000')
  await page.getByLabel('Rower minutes').fill('8')
  await expect(page.getByText('2:00 /500m')).toBeVisible()
  const rower = page.getByRole('group', { name: 'Rower units' })
  await rower.getByRole('button', { name: 'km', exact: true }).click()
  await expect(page.getByLabel('Rower distance')).toHaveValue('2')
  await expect(page.getByText('4:00 /km')).toBeVisible()
  await rower.getByRole('button', { name: 'm', exact: true }).click()
  await expect(page.getByLabel('Rower distance')).toHaveValue('2000')

  const swim = page.getByRole('group', { name: 'Swimming units' })
  await expect(swim.getByRole('button', { name: 'm', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Swimming distance').fill('1500')
  await page.getByLabel('Swimming minutes').fill('30')
  await expect(page.getByText('2:00 /100m')).toBeVisible()
  await swim.getByRole('button', { name: 'yd', exact: true }).click()
  await expect(page.getByLabel('Swimming distance')).toHaveValue('1640')
  await expect(page.locator('label', { hasText: 'Yards' })).toHaveCount(1)
  expect((await state(page)).units.byExercise).toEqual({ 'x-row-erg': 'm', swimming: 'yd' })
})

test('weekly cardio target from your goals, plus an optional distance', async ({ page }) => {
  await seed(page, { logs: [{ date: iso(0), exerciseId: 'running', cardio: { distance: 3, minutes: 30 } }] })
  await page.goto('/')
  await page.locator('nav').getByText('Progress').click()
  await expect(page.getByText('30 of 150 min')).toBeVisible()
  await expect(page.getByLabel('Running: 30 min this week, 0 last week')).toBeVisible()
  await openSettings(page, 'Profile, units & equipment')
  await page.getByRole('group', { name: 'Your goals' }).getByRole('button', { name: 'Lose fat' }).click()
  await page.getByLabel('Weekly cardio distance').fill('10')
  await page.locator('nav').getByText('Progress').click()
  await expect(page.getByText('30 of 225 min')).toBeVisible()
  await expect(page.getByText('3 of 10 mi')).toBeVisible()
  await openSettings(page, 'Profile, units & equipment')
  await page.getByLabel('Weekly cardio minutes').fill('30')
  await page.locator('nav').getByText('Progress').click()
  await expect(page.getByText('30 of 30 min ✓')).toBeVisible()
  expect((await state(page)).trainingPrefs).toMatchObject({ goals: ['fatloss'], cardioMinutes: 30, cardioMiles: 10 })
})

test('cardio has no "beat last time" target: an easy run is just a run, and only a real personal best gets a cheer', async ({ page }) => {
  await seed(page, {
    overrides: { [iso(0)]: [{ exerciseId: 'running', sets: 1, minutes: 30 }] },
    logs: [
      { date: iso(-7), exerciseId: 'running', cardio: { distance: 6, minutes: 54 } },
      { date: iso(-3), exerciseId: 'running', cardio: { distance: 3.1, minutes: 27 } },
    ],
  })
  await page.goto('/')
  // Home doesn't tell you to beat last time's run.
  await expect(page.getByText('30 min', { exact: true })).toBeVisible()
  await expect(page.getByText(/beat last/)).toHaveCount(0)
  await page.locator('nav').getByText('Workouts').click()
  await expect(page.getByText('Last time: 3.1 mi · 27 min · 8:43 /mi')).toBeVisible()
  await expect(page.getByText(/Beat it/)).toHaveCount(0)
  // The plan's 30 minutes is the target, not last time's 27; the boxes stay empty until you log.
  await expect(page.getByText('Cardio · target 30 min')).toBeVisible()
  await expect(page.getByLabel('Running minutes')).toHaveAttribute('placeholder', '–')
  // A short, quick run: a faster pace than ever, but no mile or 5K, so no record and no "faster than last time".
  await page.getByLabel('Running distance').fill('2')
  await page.getByLabel('Running minutes').fill('15')
  await expect(page.getByText('7:30 /mi')).toBeVisible()
  await expect(page.getByText(/🏆|than last time/)).toHaveCount(0)
  // A 5K faster than the last one: that's a personal best.
  await page.getByLabel('Running distance').fill('3.1')
  await page.getByLabel('Running minutes').fill('25')
  // A 5K faster than the last one is a personal best, told when the workout is finished.
  await expect(page.getByText(/🏆/)).toHaveCount(0)
  await page.getByRole('button', { name: '✓ Finish workout' }).click()
  await expect(page.getByRole('region', { name: 'New personal bests' })).toContainText('Running: fastest 5K yet, 25:03 (was 27:04)')
  await expect(page.getByText('A new personal best 🏆')).toBeVisible()
  await expect(page.getByText('🏆 Fastest 5K yet: 25:03', { exact: true })).toBeVisible()
  // A cardio-only day shows what you did, not "0 improved".
  await expect(page.getByText('improved', { exact: true })).toHaveCount(0)
  await expect(page.getByText('25 min', { exact: true })).toBeVisible()
  await expect(page.getByText('active cal', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Done', exact: true }).last().click()
  // Progress lists the records, not a "best pace" a short run could win.
  await page.locator('nav').getByText('Progress').click()
  await page.getByRole('button', { name: 'Exercises', exact: true }).click()
  await page.getByRole('button', { name: /Running/ }).first().click()
  await expect(page.getByText('Personal bests')).toBeVisible()
  await expect(page.getByText('Fastest 5K', { exact: true })).toBeVisible()
  await expect(page.getByText('Longest', { exact: true })).toBeVisible()
  await expect(page.getByText('6 mi', { exact: true })).toBeVisible()
})

test('cardio: once the time and distance are in, ✓ Done folds the card to one line; tap it to open it again', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: 'running', sets: 1, minutes: 30 }, { exerciseId: 'Plank', sets: 3, seconds: 45 }] } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  const done = page.getByRole('button', { name: /✓ Done/ })
  await expect(done).toBeDisabled()
  await page.getByLabel('Running minutes').fill('30')
  await page.getByLabel('Running distance').fill('3')
  await done.click()
  // Folded: the name with a tick and what was done, no boxes.
  await expect(page.getByLabel('Running distance')).toHaveCount(0)
  const folded = page.getByRole('button', { name: /✓ Running.*3 mi · 30 min · 10:00 \/mi · ≈\d+ cal/ })
  await expect(folded).toBeVisible()
  expect((await state(page)).logs.find((l: { exerciseId: string }) => l.exerciseId === 'running').cardio).toMatchObject({ distance: 3, minutes: 30, done: true })
  // Open it again to fix a number; it stays done until undone.
  await folded.click()
  await expect(page.getByLabel('Running distance')).toHaveValue('3')
  await page.getByRole('button', { name: 'Done ✓ · tap to undo' }).click()
  expect((await state(page)).logs.find((l: { exerciseId: string }) => l.exerciseId === 'running').cardio.done).toBe(false)
  await expect(page.getByLabel('Running distance')).toBeVisible()
})

test('a core finisher on any day: the minutes set how many moves, with a circuit timer', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: 'Barbell_Squat', sets: 3, reps: 5 }, { exerciseId: 'Plank', sets: 3, seconds: 45 }] } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: '+ Core finisher' }).click()
  const sheet = page.locator('.fixed')
  const howLong = sheet.getByRole('group', { name: 'How long' })
  await expect(howLong.getByRole('button', { name: /10 min\s*6 moves/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(sheet.getByRole('list', { name: 'Core moves' }).getByRole('listitem')).toHaveCount(6)
  await howLong.getByRole('button', { name: /15 min\s*8 moves/ }).click()
  const moves = sheet.getByRole('list', { name: 'Core moves' }).getByRole('listitem')
  await expect(moves).toHaveCount(8)
  // Not the plank that's already in the workout.
  await expect(moves.filter({ hasText: /^\d+\. Plank$/ })).toHaveCount(0)
  const first = await moves.first().textContent()
  await sheet.getByRole('button', { name: '↻ Different moves' }).click()
  await expect(moves.first()).not.toHaveText(first!)
  await sheet.getByRole('button', { name: /^Add to/ }).click()
  await expect(page.getByText(/^Core finisher · 2 rounds · 45s on \/ 10s off · 30s rest between rounds$/)).toBeVisible()
  await expect(page.getByRole('button', { name: '⏱ Start circuit timer' })).toBeVisible()
  const day = (await state(page)).overrides[iso(0)] as { block?: string }[]
  expect(day.filter((p) => p.block === 'core-finisher')).toHaveLength(8)
  // It's also in + Add.
  await page.getByRole('button', { name: '+ Add', exact: true }).click()
  await expect(page.locator('.fixed').getByText('A few core moves to end with: pick 5 to 20 minutes')).toBeVisible()
})

test('Tabata as a cardio session: 20/10 or 30 s / 90 s, rounds picked, with the warm-up and cool-down on top', async ({ page }) => {
  await seed(page)
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: 'Make me a workout' }).click()
  const sheet = page.locator('.fixed')
  await sheet.getByRole('group', { name: 'Kind of workout' }).getByRole('button', { name: 'Cardio' }).click()
  await sheet.getByRole('group', { name: 'Cardio' }).getByRole('button', { name: 'Running' }).click()
  const kinds = sheet.getByRole('radiogroup', { name: 'Kind of cardio session' })
  await kinds.getByRole('radio', { name: 'Tabata' }).click()
  // Not on a treadmill: the belt can't change speed that fast. What shows is Steady, and that's what it makes (the
  // Tabata picked outside doesn't carry over: no fixed length, the time chips are back, a steady run).
  await sheet.getByRole('radiogroup', { name: 'Where' }).getByRole('radio', { name: 'Treadmill' }).click()
  await expect(kinds.getByRole('radio', { name: 'Tabata' })).toHaveCount(0)
  await expect(kinds.getByRole('radio', { name: 'Steady' })).toHaveAttribute('aria-checked', 'true')
  await expect(sheet.getByRole('status').filter({ hasText: /About \d+ min: 5 min easy/ })).toHaveCount(0)
  await expect(sheet.getByRole('group', { name: 'Plan by' }).getByRole('button', { name: 'Calories' })).toBeVisible()
  await sheet.getByRole('button', { name: '30 min', exact: true }).click()
  await sheet.getByRole('button', { name: /^Generate/ }).click()
  await expect(sheet.getByText(/Steady · 30 min at an easy, conversational effort/).first()).toBeVisible()
  await expect(sheet.getByText(/Tabata/)).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Change style, focus or time' }).click()
  await sheet.getByRole('radiogroup', { name: 'Where' }).getByRole('radio', { name: 'Outside' }).click()
  // Back outside, their Tabata is still picked.
  await expect(kinds.getByRole('radio', { name: 'Tabata' })).toHaveAttribute('aria-checked', 'true')

  // The classic by default: its own length, so no time or calorie choice.
  const format = sheet.getByRole('radiogroup', { name: 'Tabata format' })
  const rounds = sheet.getByRole('group', { name: 'Rounds' })
  await expect(format.getByRole('radio', { name: '20 s / 10 s' })).toHaveAttribute('aria-checked', 'true')
  await expect(rounds).toContainText('8 rounds')
  await expect(rounds.getByRole('button', { name: 'More rounds' })).toBeDisabled()
  await expect(sheet.getByRole('status').filter({ hasText: 'About 14 min: 5 min easy, the Tabata, then 5 min easy.' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: '30 min', exact: true })).toHaveCount(0)
  await expect(sheet.getByRole('group', { name: 'Plan by' })).toHaveCount(0)
  await expect(sheet.getByText('To aim for calories, pick another session or add lifting')).toBeVisible()
  await sheet.getByRole('button', { name: /^Generate/ }).click()
  await expect(sheet.getByText('Tabata · 5 min easy, building up · 8 × 20s all-out / 10s easy jog (4 min) · 5 min easy')).toBeVisible()

  // Fewer rounds, or sprints of 30 s with 90 s easy (from their usual 4).
  await sheet.getByRole('button', { name: 'Change style, focus or time' }).click()
  for (let i = 0; i < 4; i++) await rounds.getByRole('button', { name: 'Fewer rounds' }).click()
  await expect(rounds).toContainText('4 rounds')
  await expect(sheet.getByRole('status').filter({ hasText: 'About 12 min' })).toBeVisible()
  await format.getByRole('radio', { name: '30 s / 90 s' }).click()
  await expect(rounds).toContainText('4 rounds')
  await rounds.getByRole('button', { name: 'More rounds' }).click()
  await rounds.getByRole('button', { name: 'More rounds' }).click()
  await expect(sheet.getByRole('status').filter({ hasText: 'About 21 min: 5 min easy, the sprints, then 5 min easy' })).toBeVisible()
  await expect(sheet.getByText('30 s all-out, then 90 seconds easy. About 21 min with 5 min easy before and after.')).toBeVisible()
  await sheet.getByRole('button', { name: /^Generate/ }).click()
  await expect(sheet.getByText('Sprint intervals · 5 min easy, building up · 6 × 30s all-out / 90s easy jog · 5 min easy')).toBeVisible()
})

test('lifting with cardio: start or finish with it, in Make me a workout and on the day', async ({ page }) => {
  await seed(page, { trainingPrefs: { styles: [], cardio: ['running'], cardioSplit: false } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: 'Make me a workout' }).click()
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: 'Lifting', exact: true }).click()
  await sheet.getByRole('button', { name: 'Cardio', exact: true }).click()
  await sheet.getByRole('button', { name: 'Full body', exact: true }).click()
  const when = sheet.getByRole('radiogroup', { name: 'Cardio first or last' })
  await expect(when.getByRole('radio', { name: 'Finish with it' })).toHaveAttribute('aria-checked', 'true')
  await when.getByRole('radio', { name: 'Start with it' }).click()
  await sheet.getByRole('button', { name: /^Generate/ }).click()
  await sheet.getByRole('button', { name: /^Add to/ }).click()
  type Item = { exerciseId: string; minutes?: number; warmup?: boolean; block?: string }
  const made = (await state(page)).overrides[iso(0)] as Item[]
  // The cardio (the one with minutes) right after the warm-up, then the lifting.
  const main = made.filter((p) => !p.warmup)
  expect(main[0].minutes).toBeGreaterThan(0)
  expect(main.slice(1).every((p) => p.minutes == null)).toBe(true)
  // Remembered for next time.
  expect((await state(page)).genPrefs.cardioSetup.first).toBe(true)

  // On the day: switch it to the end, and back.
  const day = page.getByRole('radiogroup', { name: 'Cardio first or last' })
  await expect(day.getByRole('radio', { name: 'Start with it' })).toHaveAttribute('aria-checked', 'true')
  await day.getByRole('radio', { name: 'Finish with it' }).click()
  const after = ((await state(page)).overrides[iso(0)] as Item[]).filter((p) => !p.warmup)
  expect(after.at(-1)!.exerciseId).toBe(main[0].exerciseId)
  await expect(day.getByRole('radio', { name: 'Finish with it' })).toHaveAttribute('aria-checked', 'true')
})

test('a day with lifting and a run from a plan: the run can go first or last; without it, no switch', async ({ page }) => {
  await seed(page, { overrides: { [iso(0)]: [{ exerciseId: 'Barbell_Squat', sets: 3, reps: 5 }, { exerciseId: 'running', sets: 1, minutes: 30 }], [iso(1)]: [{ exerciseId: 'Barbell_Squat', sets: 3, reps: 5 }] } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  const day = page.getByRole('radiogroup', { name: 'Cardio first or last' })
  await day.getByRole('radio', { name: 'Start with it' }).click()
  expect(((await state(page)).overrides[iso(0)] as { exerciseId: string }[]).map((p) => p.exerciseId)).toEqual(['running', 'Barbell_Squat'])
  // Without the run there's nothing to order.
  await page.getByRole('button', { name: 'Running options' }).click()
  await page.locator('.fixed').getByRole('button', { name: 'Remove exercise' }).click()
  await expect(day).toHaveCount(0)
})

test('Tabata finishing a lifting workout keeps its own length in the time split', async ({ page }) => {
  await seed(page, { trainingPrefs: { styles: [], cardio: ['running'], cardioSplit: false } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: 'Make me a workout' }).click()
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: 'Lifting', exact: true }).click()
  await sheet.getByRole('button', { name: 'Cardio', exact: true }).click()
  await sheet.getByRole('button', { name: 'Full body', exact: true }).click()
  await sheet.getByRole('group', { name: 'Cardio' }).getByRole('button', { name: 'Running' }).click()
  await sheet.getByRole('radiogroup', { name: 'Where' }).getByRole('radio', { name: 'Outside' }).click()
  await sheet.getByRole('radiogroup', { name: 'Kind of cardio session' }).getByRole('radio', { name: 'Tabata' }).click()
  for (let i = 0; i < 4; i++) await sheet.getByRole('button', { name: 'Fewer rounds' }).click()
  // The cardio row is Tabata's length (12 min), with no − or +; lifting keeps its own time.
  await expect(sheet.getByText('Tabata’s own length, with 5 min easy before and after')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Less Cardio time' })).toHaveCount(0)
  await expect(sheet.getByText('12 min', { exact: true })).toBeVisible()
  await sheet.getByRole('button', { name: /^Generate/ }).click()
  await sheet.getByRole('button', { name: /^Add to/ }).click()
  const run = ((await state(page)).overrides[iso(0)] as { exerciseId: string; minutes?: number; note?: string }[]).find((p) => p.exerciseId === 'running')!
  expect(run.minutes).toBe(12)
  expect(run.note).toBe('Tabata · 5 min easy, building up · 4 × 20s all-out / 10s easy jog (2 min) · 5 min easy')
})

test('a calorie target with Tabata: Tabata keeps its length and the lifting makes up the burn', async ({ page }) => {
  await seed(page, { trainingPrefs: { styles: [], cardio: ['running'], cardioSplit: false } })
  await page.goto('/')
  await page.locator('nav').getByText('Workouts').click()
  await page.getByRole('button', { name: 'Make me a workout' }).click()
  const sheet = page.locator('.fixed')
  await sheet.getByRole('button', { name: 'Lifting', exact: true }).click()
  await sheet.getByRole('button', { name: 'Cardio', exact: true }).click()
  await sheet.getByRole('button', { name: 'Full body', exact: true }).click()
  await sheet.getByRole('group', { name: 'Cardio' }).getByRole('button', { name: 'Running' }).click()
  await sheet.getByRole('radiogroup', { name: 'Where' }).getByRole('radio', { name: 'Outside' }).click()
  await sheet.getByRole('radiogroup', { name: 'Kind of cardio session' }).getByRole('radio', { name: 'Tabata' }).click()
  await sheet.getByRole('group', { name: 'Plan by' }).getByRole('button', { name: 'Calories' }).click()
  await sheet.getByRole('button', { name: '500 cal', exact: true }).click()
  await expect(sheet.getByRole('status').filter({ hasText: /About [\d,]+ active cal in/ })).toBeVisible()
  // No pace to set for Tabata; its row stays 14 min, the lifting is worked out for the target.
  await expect(sheet.getByText(/Your running pace/)).toHaveCount(0)
  await expect(sheet.getByText('Tabata’s own length, with 5 min easy before and after')).toBeVisible()
  await expect(sheet.getByText('14 min', { exact: true })).toBeVisible()
  await expect(sheet.getByText('worked out for your target', { exact: false }).first()).toBeVisible()
  await sheet.getByRole('button', { name: /^Generate/ }).click()
  await sheet.getByRole('button', { name: /^Add to/ }).click()
  const run = ((await state(page)).overrides[iso(0)] as { exerciseId: string; minutes?: number; note?: string }[]).find((p) => p.exerciseId === 'running')!
  expect(run.minutes).toBe(14)
  expect(run.note).toMatch(/^Tabata · 5 min easy, building up · 8 × 20s/)
})

