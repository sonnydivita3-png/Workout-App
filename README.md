# EZ Workout Tracker

Minimal weekly workout tracker, installable as a phone app (PWA). Plan exercises per weekday from a 750+ exercise library, log sets (weight × reps) or cardio (distance, time, auto pace), see what you did last time inline, and track progress over time.

**Stack:** Vite · React 19 · TypeScript · Tailwind v4 · Zustand (localStorage) · vite-plugin-pwa

```
npm install
npm run dev      # local dev
npm run build    # production build (outputs dist/)
npm test         # randomizer unit tests
```

## Features
- Home dashboard: greeting, today's upcoming exercises, last workout, body weight log + chart, weekly stats, goals
- Workout randomizer: pick body parts and/or cardio plus a time, get a balanced workout with sets, reps and cardio minutes; swap or remove exercises, reroll, add to the day or save as a routine
- Weekly plan by weekday, per-set logging, "last time" reminders
- Duplicate a day to other days; save a day as a named routine and load it onto any day
- Body weight chart with 30D/90D/1Y/All ranges, goal line, backdated entries
- Notifications: goal progress/completion, new personal bests, daily workout reminder — in-app feed, banners, optional system alerts (checked while the app is open)
- Goals: workouts per week, body weight target, lift target
- Exercise library from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain) + custom exercises
- History: est. 1RM / top weight / volume charts (lifting), pace / distance / time (cardio), PR badges
- lb/kg and mi/km (stored as lb/mi, converted for display)
- JSON backup export/import
- Offline-capable, installable

## Deploy (GitHub Pages)
`.github/workflows/deploy.yml` builds and publishes on every push to `main`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**. Then open the Pages URL on your phone and use *Add to Home Screen* (Safari) or *Install app* (Chrome).
