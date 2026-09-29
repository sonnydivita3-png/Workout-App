# Workout

Minimal weekly workout tracker, installable as a phone app (PWA). Plan exercises per weekday from a 750+ exercise library, log sets (weight × reps) or cardio (distance, time, auto pace), see what you did last time inline, and track progress over time.

**Stack:** Vite · React 19 · TypeScript · Tailwind v4 · Zustand (localStorage) · vite-plugin-pwa

```
npm install
npm run dev      # local dev
npm run build    # production build (outputs dist/)
```

## Features
- Weekly plan by weekday, per-set logging, "last time" reminders
- Exercise library from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain) + custom exercises
- History: est. 1RM / top weight / volume charts (lifting), pace / distance / time (cardio), PR badges
- lb/kg and mi/km (stored as lb/mi, converted for display)
- JSON backup export/import
- Offline-capable, installable

## Deploy (GitHub Pages)
`.github/workflows/deploy.yml` builds and publishes on every push to `main`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**. Then open the Pages URL on your phone and use *Add to Home Screen* (Safari) or *Install app* (Chrome).
