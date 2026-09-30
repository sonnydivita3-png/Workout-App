# EZ Workout Tracker

Minimal weekly workout tracker, installable as a phone app (PWA). Plan exercises per weekday from a 750+ exercise library, log sets (weight × reps) or cardio (distance, time, auto pace), see what you did last time inline, and track progress over time.

**Stack:** Vite · React 19 · TypeScript · Tailwind v4 · Zustand (localStorage) · vite-plugin-pwa

```
npm install
npm run dev      # local dev
npm run build    # production build (outputs dist/)
npm test         # unit tests, including database privacy rules run against a real Postgres (PGlite)
```

## Features
- Home dashboard: greeting, today's upcoming exercises, last workout, body weight log + chart, weekly stats, goals
- Workout randomizer with eight styles: standard, strength, supersets, HIIT circuit, PHA, Hyrox-style, CrossFit-style, bodyweight. Pick body parts and/or cardio plus a time; swap, choose, or remove exercises, step Back/Forward through versions, add to the day or save as a routine
- Week or month planner: pick a goal, training days and session length; builds dated workouts with rest days, never trains the same major muscle group two days in a row, varies exercises, and adds a set in week 3 and a deload in week 4 of a month plan
- Three ways to log lifting: weight × reps, bodyweight reps only, and timed holds (planks) in seconds; goals, history, and personal bests follow the same measure
- Randomizer: Back/Forward through every version you've generated, random swap per exercise, or pick any exercise yourself
- Randomizer: pick several styles at once (e.g. Strength + HIIT circuit) plus body parts and Cardio; set minutes for each part (e.g. Strength 45 min + Cardio 30 min) or split a total evenly; lifting first, cardio at the end
- Clocks: countdown/interval timers for AMRAP, EMOM, Tabata, for time and HIIT circuits, plus a stopwatch for timed holds (plank etc.)
- Timed workouts: AMRAP, EMOM (E2MOM, E3MOM), Tabata (20s on / 10s off × 8, or your own timing) and for-time, from the randomizer (optionally by body part) or a builder (+ Add → Build a timed workout). Each has a built-in clock, a place to log rounds / intervals / finish time, and shows last time's result. Results also count toward each exercise's history, streaks and daily progress
- Weekly plan by weekday, per-set logging, "last time" reminders
- Duplicate a day to other days; save a day as a named routine and load it onto any day; mark any day as a rest day
- "Last workout" on Home only shows real, logged workouts from today or earlier, never a future date or a rest day
- Body weight chart with 30D/90D/1Y/All ranges, goal line, backdated entries
- Notifications: goal progress/completion, new personal bests, daily workout reminder — in-app feed, banners, optional system alerts (checked while the app is open)
- Goals: workouts per week, body weight target, lift target, and cardio goals (weekly/monthly distance or time, target pace or speed, and events like a half marathon or century)
- Training plans (Plan → + Add → Start a training plan, separate from the randomizer): Couch to 5K, 5K, 10K, half marathon, marathon or a mileage build for running; 25 / 50 mile, metric century, century, 200K or a fitness build for cycling. Progressive weekly plans with a long run/ride, quality sessions, cutback weeks, a taper, and an optional event date; personal training paces from a goal time. Adding a race goal (Goals → Cardio → event) builds and fills in its plan automatically
- Stop or replace a running program from the Plan tab, or clear a stretch of days (logged days are always kept)
- Exercise library from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain) + custom exercises
- History: delete a single session or all history for an exercise; est. 1RM / top weight / volume charts (lifting), pace / distance / time (cardio), PR badges
- lb/kg and mi/km (stored as lb/mi, converted for display)
- JSON backup export/import, and an Erase all data option (with confirmation) to start over
- Social (optional, opt-in at first launch or later in Settings): friends by exact handle, share a day/week/4 weeks that a friend adds to their calendar, ask a friend to make you a workout, push-up/pull-up/plank/run/ride challenges (or "beat the workout I did"), and a fixed set of 12 emoji instead of chat. Everyone chooses per friend what that friend may see or send, and nothing is shared by default. See [docs/social-setup.md](docs/social-setup.md)
- First-run walkthrough of every feature (skippable, replay from Settings → Help)
- Avatars: pick an emoji, a letter, or upload a photo (shrunk on your device to a tiny square before it is stored)
- Look: dark-first neon theme (or light, or follow your phone) with five accent "vibes", chunky rounded UI, confetti on PRs, goals and finished challenges
- Offline-capable, installable

## Deploy (GitHub Pages)
`.github/workflows/deploy.yml` builds and publishes on every push to `main`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**. Then open the Pages URL on your phone and use *Add to Home Screen* (Safari) or *Install app* (Chrome).

## How the cardio plans are built
The generator follows widely published training principles rather than reproducing any one plan:
- **Running:** weekly volume and the long run grow at a capped rate (about 10% a week), with a lighter cutback week every fourth week, then a taper (marathon 3 weeks, half 2, 10K/5K 1). The marathon long run peaks near 20 miles three weeks out, like the classic novice programs. Hard sessions are kept apart from the long run and from each other.
- **Couch to 5K:** modelled on the NHS 9-week run/walk progression (three sessions a week, building to 30 minutes of running). Check the official NHS plan if you want the exact intervals.
- **Paces:** estimated from a goal time with Jack Daniels' VDOT equations (easy, marathon, tempo, interval).
- **Cycling:** the longest training ride reaches roughly 70-80% of the event distance at least two weeks out, with a 1-2 week taper; intensity is described by effort and, if you enter an FTP, by Coggan power zones (endurance 55-75%, tempo 76-87%, sweet spot 88-94%, threshold 95-105%, VO2 106-120%).

These are general guidelines, not medical advice; adjust for how you feel and check with a professional if you have health concerns.
