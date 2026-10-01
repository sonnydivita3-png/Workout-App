"""Split the broad Legs and Arms groups in src/data/exercises.json into body parts, using each exercise's primary
muscle from src/data/howto.json (free-exercise-db): Quads, Hamstrings, Calves, Biceps, Triceps, Forearms.
Hip adductors/abductors count as Glutes, neck moves as Other. Safe to run again (rows already split are kept).
Usage: python3 scripts/split-groups.py
"""
import json, re

rows = json.load(open('src/data/exercises.json'))
howto = json.load(open('src/data/howto.json'))
PART = {
    'quadriceps': 'Quads', 'hamstrings': 'Hamstrings', 'calves': 'Calves', 'adductors': 'Glutes', 'abductors': 'Glutes',
    'biceps': 'Biceps', 'triceps': 'Triceps', 'forearms': 'Forearms',
}
# Bench press variations the source files under triceps are chest presses for everyone else.
CHEST_PRESS = re.compile(r'bench press|floor press|board press|pin press', re.I)
changed = 0
for r in rows:
    group, name = r[2], r[1]
    primary = (howto.get(r[0], {}).get('p') or [None])[0]
    new = group
    if group in ('Legs', 'Arms'):
        new = PART.get(primary, 'Quads' if group == 'Legs' else 'Biceps')
        if new == 'Triceps' and CHEST_PRESS.search(name) and not re.search(r'close|triceps|tate|jm press|lying', name, re.I):
            new = 'Chest'
    elif group == 'Shoulders' and primary == 'neck':
        new = 'Other'
    if new != group:
        r[2] = new
        changed += 1
json.dump(rows, open('src/data/exercises.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print(changed, 'exercises moved')
