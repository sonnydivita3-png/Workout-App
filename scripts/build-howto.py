"""Regenerate src/data/howto.json from free-exercise-db (public domain).
Usage: curl -sL https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json -o /tmp/fedb.json && python3 scripts/build-howto.py /tmp/fedb.json
"""
import json, re, sys
src = json.load(open(sys.argv[1]))
ids = {row[0] for row in json.load(open('src/data/exercises.json'))}
# Plus the extra moves defined in code (warm-up moves etc.) whose ids exist in the source.
import re
ids |= set(re.findall(r"^\s*\['([^']+)',", open('src/data/exercises.ts').read(), re.M))
out = {}
for x in src:
    if x['id'] not in ids:
        continue
    out[x['id']] = {'i': x.get('instructions', []), 'p': x.get('primaryMuscles', []), 's': x.get('secondaryMuscles', []), 'n': len(x.get('images', [])), 'l': x.get('level', '')}
json.dump(out, open('src/data/howto.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(out), 'exercises')
