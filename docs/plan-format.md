# Durata plan file format

Durata tracks one training plan at a time. A plan is a single JSON file. To make a new one, give this whole
document to Claude along with the plan (a PDF, a table, or a description) and ask for "a Durata plan file". Then
open Durata → Settings → Import a plan file.

Rules for writing the file:

- Output valid JSON only: no comments, no trailing commas.
- Dates are `YYYY-MM-DD`. Weeks start on Monday.
- List **every day** from `start` to `end`, rest days included (a rest day has `"items": []`).
- Copy numbers exactly from the source plan. Don't invent workouts, targets or notes it doesn't have; leave optional
  fields out instead.
- Give the plan a new `id` (lowercase, dashes) unless it replaces an earlier version of the same plan. The log is
  kept per `id`: the same `id` keeps what was already logged, a new one starts clean.

## Top level

| Field | Required | What it is |
|---|---|---|
| `format` | yes | Always `"durata-plan"` |
| `version` | yes | Always `1` |
| `id` | yes | e.g. `"ice-age-50k-2027"` |
| `name` | yes | e.g. `"Ice Age Trail 50K"` |
| `description` | no | One line about the plan |
| `start`, `end` | yes | First and last day |
| `race` | no | `{ "date", "name", "detail" }`; the app counts down to it |
| `phases` | yes | List of `{ "name", "start", "end", "summary" }` (can be `[]`) |
| `weeks` | yes | List of `{ "number", "start" (Monday), "miles", "long", "goalLb", "down" }`; only `number` and `start` are required (can be `[]`) |
| `targets` | yes | Daily food targets by key (can be `{}`), see below |
| `workouts` | yes | Strength or other structured workouts by key (can be `{}`), see below |
| `routine` | no | A routine done before every session: `{ "name", "minutes", "when", "steps": [text] }` |
| `effort` | no | Effort guide: list of `{ "term", "meaning" }` |
| `notes` | no | List of `{ "title", "bullets": [text], "start", "end" }`. Without dates a note always shows; with dates it shows on those days |
| `days` | yes | One entry per day, see below |

## Days

```json
{ "date": "2026-11-17", "target": "p1-train", "items": [
  { "type": "strength", "title": "Strength A", "workout": "A", "minutes": 55 },
  { "type": "run", "title": "Easy run", "miles": 3 }
] }
```

- `label` (optional): a word for the day, like `"Race week"` or `"Recover: no running"`.
- `target` (optional): a key of `targets`.
- `items`: what to do that day, in order. Each item:

| Field | Required | What it is |
|---|---|---|
| `type` | yes | `run`, `strength`, `bike`, `hike`, `mobility`, `race` or `other` |
| `title` | yes | e.g. `"Long run"`, `"Hills"`, `"Bike/incline"` |
| `miles` | no | Planned distance |
| `minutes` | no | Planned time in minutes (1:12 is `72`) |
| `detail` | no | e.g. `"+ strides"`, `"6×60 s"`, `"2×10 min"` |
| `fuel` | no | e.g. `"30 g carbs/hr"` |
| `workout` | no | For strength: the key of a workout in `workouts` |

## Targets

```json
"targets": {
  "p1-train": { "label": "Training day", "kcal": 2700, "protein": 200, "carbs": 295, "fat": 80 },
  "carb-load": { "label": "Carb load", "protein": 150, "carbs": "720–810", "fat": 60 },
  "race": { "label": "Race fuel", "note": "50 g carbs / hr" }
}
```

All fields are optional; grams for protein, carbs and fat. `carbs` can be text for a range.

## Workouts

A workout has one or more dated versions, so the same "Strength A" can change sets by phase. The version whose
`start`–`end` covers a day is the one shown that day.

```json
"workouts": {
  "A": { "name": "Strength A", "focus": "Legs", "notes": ["Stop every set with 2–3 reps in reserve."],
    "versions": [
      { "label": "Phase 1", "start": "2026-11-16", "end": "2027-01-10", "exercises": [
        { "name": "Trap-bar deadlift, high handles", "prescription": "4 × 5", "sets": 4 },
        { "name": "Side plank, 30–45 s", "prescription": "2 / side", "sets": 2 }
      ] },
      { "label": "Taper", "start": "2027-04-19", "end": "2027-05-09", "note": "80% of usual weights.", "exercises": [
        { "name": "Trap-bar deadlift, high handles", "prescription": "2 × 5", "sets": 2 }
      ] }
    ] }
}
```

`prescription` is shown as written. `sets` is how many sets to log: a whole number, the top of a range (`2–3 × 10` is
`3`), and `3 / hand` or `2 / side` is `3` or `2`. Every version needs at least one exercise.
