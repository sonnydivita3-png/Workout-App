# Durata

A personal training tracker, installable as a phone app (PWA). It follows one training plan, day by day, and tracks
what got done: currently the 25-week Ice Age Trail 50K plan (Nov 16, 2026 to the race on May 8, 2027).

- **Today:** the day's activities from the plan, each checked off or skipped. Runs log actual miles and time (with
  pace); strength workouts show that phase's exercises, each ticked off, with optional weight × reps per set. Plus the
  day's calorie and macro target, a check-off for the spine routine, and a note.
- **Calendar:** every week like the printed calendar, with what's done, miles run against the plan and the weight
  goal. Tap a day to open it.
- **Weight:** morning weigh-ins and each week's average against the plan's goal.
- **Plan:** the strength workouts by phase, the spine routine, the effort guide and this month's notes.
- **Settings:** import a new plan file, copy the plan format for Claude, export and restore a backup, light/dark.

Everything is saved on the device only. Export a backup now and then.

## Plans

A plan is a JSON file in the format described in [docs/plan-format.md](docs/plan-format.md). The bundled plan is
`src/plans/ice-age-50k.json`. To start a new plan, give Claude the format guide (Settings → Copy the plan format for
Claude) with the plan, then import the file it writes (Settings → Import a plan file). Each plan keeps its own log.

## Development

**Stack:** Vite · React 19 · TypeScript · Tailwind v4 · Zustand (localStorage) · vite-plugin-pwa

```
npm install
npm run dev      # local dev
npm run build    # production build (dist/)
npm test         # unit tests, including the plan file against the printed plan
npm run e2e      # browser tests (Playwright); set PW_CHROMIUM to a Chromium path if you don't run `npx playwright install`
```

Pushes to `main` deploy to GitHub Pages.
