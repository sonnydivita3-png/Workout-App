"""
Writes src/plans/ice-age-50k.json from the printed Ice Age 50K calendar, transcribed below week by week.
Run: python3 scripts/make-ice-age-plan.py src/plans/ice-age-50k.json
"""
import json, datetime as dt, sys
D = lambda s: dt.date.fromisoformat(s)
iso = lambda d: d.isoformat()

# ---- daily targets (from the calendar fronts) ----
T = {
 'p1-rest':  dict(label='Rest day', kcal=2300, protein=200, carbs=195, fat=80),
 'p1-train': dict(label='Training day', kcal=2700, protein=200, carbs=295, fat=80),
 'p1-long':  dict(label='Long-run day', kcal=3100, protein=200, carbs=385, fat=85),
 'p2-rest':  dict(label='Rest day', kcal=2700, protein=200, carbs=285, fat=85),
 'p2-train': dict(label='Training day', kcal=3000, protein=200, carbs=350, fat=90),
 'p2-long':  dict(label='Long-run day', kcal=3500, protein=200, carbs=460, fat=95),
 'p3-rest':  dict(label='Rest day', kcal=3000, protein=190, carbs=345, fat=95),
 'p3-train': dict(label='Training day', kcal=3300, protein=190, carbs=420, fat=95),
 'p3-long':  dict(label='Long-run day', kcal=3700, protein=190, carbs=510, fat=100),
 'pk-rest':  dict(label='Rest day', kcal=3200, protein=190, carbs=385, fat=100),
 'pk-train': dict(label='Training day', kcal=3550, protein=190, carbs=470, fat=100),
 'pk-long':  dict(label='Long-run day', kcal=4000, protein=180, carbs=595, fat=100),
 'tp-rest':  dict(label='Rest day', kcal=3000, protein=190, carbs=345, fat=95),
 'tp-train': dict(label='Training day', kcal=3300, protein=190, carbs=420, fat=95),
 'carb-load': dict(label='Carb load', protein=150, carbs='720–810', fat=60),
 'race':     dict(label='Race fuel', note='50 g carbs / hr'),
}

def period(d):
    if d <= D('2027-01-10'): return 'p1'
    if d <= D('2027-03-07'): return 'p2'
    if d <= D('2027-03-28'): return 'p3'
    if d <= D('2027-04-18'): return 'pk'
    return 'tp'

# ---- items ----
def A(m=None, light=False): return dict(type='strength', title='Strength A', workout='A', **({'minutes': m} if m else {}), **({'detail': 'light, 80% of usual weights'} if light else {}))
def B(m): return dict(type='strength', title='Strength B', workout='B', minutes=m)
def C(m): return dict(type='strength', title='Strength C', workout='C', minutes=m)
def easy(mi, strides=False): return dict(type='run', title='Easy run', miles=mi, **({'detail': '+ strides'} if strides else {}))
def run(mi, strides=False): return dict(type='run', title='Run', miles=mi, **({'detail': '+ strides'} if strides else {}))
def hills(mi, reps): return dict(type='run', title='Hills', miles=mi, detail=reps)
def steady(mi, reps): return dict(type='run', title='Steady run', miles=mi, detail=reps)
def long(mi, hm, fuel=None):
    h, m = hm.split(':')
    return dict(type='run', title='Long run', miles=mi, minutes=int(h)*60+int(m), **({'fuel': f'{fuel} g carbs/hr'} if fuel else {}))
def bike(m): return dict(type='bike', title='Bike/incline', minutes=m)
def hike(m): return dict(type='hike', title='Hike', minutes=m)

# Each week: Mon..Sun. None = rest.
R = None
W = [
 # wk, down, [Tue, Wed, Thu, Sat (long run), Sun]   (Mon and Fri rest)
 (1, False, [[A(55), easy(3)], [C(55), bike(60)], [run(4, True), B(55)], [long(5, '1:00')], [hike(90)]]),
 (2, False, [[A(55), easy(4)], [C(55), bike(60)], [run(4, True), B(55)], [long(6, '1:12')], [hike(90)]]),
 (3, False, [[A(55), easy(4)], [C(55), bike(60)], [run(5, True), B(55)], [long(7, '1:24')], [hike(105)]]),
 (4, True,  [[A(55), easy(3)], [C(55), bike(60)], [run(4, True), B(55)], [long(5, '1:00')], [hike(90)]]),
 (5, False, [[A(55), easy(4)], [C(55), bike(60), easy(2)], [run(4, True), B(55)], [long(8, '1:36', 30)], [hike(105)]]),
 (6, False, [[A(55), easy(4)], [C(55), bike(60), easy(2)], [run(5, True), B(55)], [long(9, '1:48', 30)], [hike(120)]]),
 (7, False, [[A(55), easy(4)], [C(55), bike(60), easy(3)], [run(5, True), B(55)], [long(10, '2:00', 30)], [hike(120)]]),
 (8, True,  [[A(55), easy(4)], [C(55), bike(60), easy(2)], [run(4, True), B(55)], [long(6, '1:12')], [hike(90)]]),
 (9, False, [[hills(5, '6×60 s'), A(50)], [easy(5), C(30)], [easy(4, True), B(50)], [long(10, '2:00', 30)], [hike(90)]]),
 (10, False, [[hills(6, '7×60 s'), A(50)], [easy(5), C(30)], [easy(4, True), B(50)], [long(11, '2:12', 30)], [hike(90)]]),
 (11, False, [[hills(6, '8×75 s'), A(50)], [easy(6), C(30)], [easy(4, True), B(50)], [long(12, '2:24', 30)], [hike(90)]]),
 (12, True, [[hills(6, '6×60 s'), A(50)], [bike(45), C(30)], [easy(4, True), B(50)], [long(9, '1:48', 30)], [hike(60)]]),
 (13, False, [[hills(6, '8×90 s'), A(50)], [easy(6), C(30)], [easy(4, True), B(50)], [long(13, '2:36', 40)], [easy(3), hike(60)]]),
 (14, False, [[hills(7, '9×90 s'), A(50)], [easy(6), C(30)], [easy(4, True), B(50)], [long(14, '2:48', 40)], [easy(4), hike(60)]]),
 (15, False, [[hills(7, '10×90 s'), A(50)], [easy(6), C(30)], [easy(4, True), B(50)], [long(15, '3:00', 40)], [easy(5), hike(60)]]),
 (16, True, [[hills(6, '6×75 s'), A(50)], [bike(45), C(30)], [easy(4, True), B(50)], [long(11, '2:12', 40)], [easy(4), hike(60)]]),
 (17, False, [[steady(7, '2×10 min'), A(40)], [easy(6)], [easy(3), B(40)], [long(18, '3:36', 50)], [easy(6)]]),
 (18, False, [[hills(7, '8×90 s'), A(40)], [easy(6)], [easy(3), B(40)], [long(20, '4:00', 50)], [easy(6)]]),
 (19, False, [[steady(8, '2×15 min'), A(40)], [easy(6)], [easy(3), B(40)], [long(20, '4:00', 50)], [easy(8)]]),
 (20, True, [[hills(6, '6×60 s'), A(40)], [bike(45)], [easy(4), B(40)], [long(13, '2:36', 50)], [easy(4)]]),
 (21, False, [[steady(8, '3×12 min'), A(40)], [easy(6)], [easy(3), B(40)], [long(22, '4:24', 50)], [easy(8)]]),
 (22, False, [[hills(8, '8×90 s'), A(40)], [easy(6)], [B(40), bike(45)], [long(24, '4:48', 50)], [easy(6)]]),
 (23, False, [[easy(6, True), A(light=True)], [easy(5)], [easy(3)], [long(14, '2:48', 50)], [easy(4)]]),
 (24, False, [[easy(5, True), A(light=True)], [easy(4)], [easy(3)], [long(8, '1:36', 30)], [hike(45)]]),
]
WEEKS = [  # number, miles, long, goal lb
 (1,12,'5 mi',218.5),(2,14,'6 mi',217),(3,16,'7 mi',215.5),(4,12,'5 mi',214.5),(5,18,'8 mi',213),(6,20,'9 mi',211.5),
 (7,22,'10 mi',210),(8,16,'6 mi',208.5),(9,24,'10 mi',207.5),(10,26,'11 mi',206.5),(11,28,'12 mi',205.5),(12,19,'9 mi',204.5),
 (13,32,'13 mi',203.5),(14,35,'14 mi',202.5),(15,37,'15 mi',201.5),(16,25,'11 mi',200.5),(17,40,'18 mi',200),(18,42,'20 mi',199.5),
 (19,45,'20 mi',199),(20,27,'13 mi',199),(21,47,'22 mi',199),(22,44,'24 mi',199),(23,32,'14 mi',199),(24,20,'8 mi',199),(25,38,'Race',199),
]
DOWN = {4, 8, 12, 16, 20}
start = D('2026-11-16')
days = []
def target_for(d, items):
    p = period(d)
    if not items: return f'{p}-rest'
    if p == 'tp': return 'tp-train'
    if any(i.get('title') == 'Long run' for i in items): return f'{p}-long'
    # Sundays in the peak blocks are long days too (back-to-back weekends).
    if d.weekday() == 6 and p in ('p3', 'pk'): return f'{p}-long'
    return f'{p}-train'

for wk, down, (tue, wed, thu, sat, sun) in W:
    mon = start + dt.timedelta(weeks=wk - 1)
    plan = {0: [], 1: tue, 2: wed, 3: thu, 4: [], 5: sat, 6: sun}
    for i in range(7):
        d = mon + dt.timedelta(days=i)
        items = plan[i]
        day = dict(date=iso(d), target=target_for(d, items), items=items)
        days.append(day)

# Week 25: race week (May 3–9)
race = [
 ('2027-05-03', [], 'tp-rest', 'Race week'),
 ('2027-05-04', [easy(4, True)], 'tp-rest', None),
 ('2027-05-05', [], 'tp-rest', None),
 ('2027-05-06', [easy(3)], 'carb-load', None),
 ('2027-05-07', [], 'carb-load', None),
 ('2027-05-08', [dict(type='race', title='Ice Age Trail 50K', miles=31, detail='La Grange', fuel='50 g carbs/hr')], 'race', 'Race day'),
 ('2027-05-09', [], None, 'Recover: walk, eat and sleep. No running this week.'),
]
for date, items, tgt, label in race:
    day = dict(date=date, items=items)
    if tgt: day['target'] = tgt
    if label: day['label'] = label
    days.append(day)

# ---- strength workouts (from the backs) ----
def ex(name, rx, sets): return dict(name=name, prescription=rx, sets=sets)
A_p1 = [ex('Trap-bar deadlift, high handles', '4 × 5', 4), ex('Rear-foot-elevated split squat', '3 × 8 / leg', 3), ex('Step-up, 12–16 in box', '3 × 8 / leg', 3),
        ex('Hip thrust', '3 × 8', 3), ex('Single-leg calf raise', '3 × 12 / leg', 3), ex('Suitcase carry, 40 yd', '3 / hand', 3), ex('Side plank, 30–45 s', '2 / side', 2)]
A_p2 = [ex('Trap-bar deadlift, high handles', '4 × 4–5', 4), ex('Rear-foot-elevated split squat', '3 × 6 / leg', 3), ex('Step-up, 12–16 in box', '3 × 8 / leg', 3),
        ex('Hip thrust', '3 × 8', 3), ex('Single-leg calf raise', '3 × 12 / leg', 3), ex('Suitcase carry, 40 yd', '3 / hand', 3), ex('Side plank, 30–45 s', '2 / side', 2),
        ex('Pogo hops', '3 × 20', 3), ex('Low box jump', '3 × 5', 3)]
A_p3 = [ex('Trap-bar deadlift, high handles', '2 × 4–5', 2), ex('Rear-foot-elevated split squat', '2 × 6 / leg', 2), ex('Step-up, 12–16 in box', '2 × 8 / leg', 2),
        ex('Hip thrust', '2 × 8', 2), ex('Single-leg calf raise', '2 × 12 / leg', 2), ex('Suitcase carry, 40 yd', '2 / hand', 2), ex('Side plank, 30–45 s', '2 / side', 2),
        ex('Pogo hops', '2 × 20', 2), ex('Low box jump', '2 × 5', 2)]
A_tp = [ex('Trap-bar deadlift, high handles', '2 × 5', 2), ex('Rear-foot-elevated split squat', '2 × 6 / leg', 2), ex('Step-up, 12–16 in box', '2 × 8 / leg', 2),
        ex('Hip thrust', '2 × 8', 2), ex('Single-leg calf raise', '2 × 12 / leg', 2), ex('Suitcase carry, 40 yd', '2 / hand', 2), ex('Side plank, 30–45 s', '2 / side', 2)]
def B_list(n, nordic):
    curl = '6–8, Nordic' if nordic else '6–8, slider'
    return [ex('Single-leg Romanian deadlift', f'{n} × 8 / leg', n), ex('Goblet squat to box, or belt squat', f'{n} × 8–10', n), ex('Lateral step-down, 6–8 in', f'{n} × 10 / leg', n),
            ex('Hamstring curl', f'{n} × {curl}', n), ex('Seated calf raise', f'{n} × 15', n), ex('Pallof press', f'{n} × 10 / side', n), ex('Copenhagen plank, 20 s', '2 / side', 2), ex('Tibialis raise', '2 × 20', 2)]
C_p1 = [ex('Chest-supported row', '4 × 10', 4), ex('Half-kneeling one-arm cable row', '3 × 10 / arm', 3), ex('Half-kneeling landmine press', '3 × 8 / arm', 3),
        ex('Neutral-grip lat pulldown', '3 × 10', 3), ex('Push-up, stop 2 short of failure', '3 sets', 3), ex('Face pull', '3 × 15', 3), ex('Dead bug', '3 × 8 / side', 3), ex('Farmer carry, 40 yd', '3', 3)]
C_p2 = [ex('Chest-supported row', '2–3 × 10', 3), ex('Half-kneeling landmine press', '2–3 × 8 / arm', 3), ex('Face pull', '2–3 × 15', 3), ex('Dead bug', '2–3 × 8 / side', 3)]
SET_NOTE = 'Stop every set with 2–3 reps in reserve. Start single-side work on your weaker side and match the reps. End the set when your form changes.'
workouts = {
 'A': dict(name='Strength A', focus='Legs', notes=[SET_NOTE, 'Add pogo hops and low box jumps (Phase 2 on) only if your back allows.'], versions=[
    dict(label='Phase 1', start='2026-11-16', end='2027-01-10', exercises=A_p1),
    dict(label='Phase 2', start='2027-01-11', end='2027-03-07', exercises=A_p2),
    dict(label='Phase 3', start='2027-03-08', end='2027-04-18', exercises=A_p3),
    dict(label='Taper', start='2027-04-19', end='2027-05-09', note='Light: 80% of your usual weights.', exercises=A_tp)]),
 'B': dict(name='Strength B', focus='Single-leg, trunk', notes=[SET_NOTE], versions=[
    dict(label='Phase 1', start='2026-11-16', end='2027-01-10', exercises=B_list(3, False)),
    dict(label='Phase 2', start='2027-01-11', end='2027-03-07', exercises=B_list(3, True)),
    dict(label='Phase 3', start='2027-03-08', end='2027-05-09', exercises=B_list(2, True))]),
 'C': dict(name='Strength C', focus='Upper body, trunk', notes=[SET_NOTE], versions=[
    dict(label='Phase 1', start='2026-11-16', end='2027-01-10', exercises=C_p1),
    dict(label='Phase 2', start='2027-01-11', end='2027-05-09', exercises=C_p2)]),
}

weeks = []
for n, miles, lng, goal in WEEKS:
    w = dict(number=n, start=iso(start + dt.timedelta(weeks=n - 1)), miles=miles, long=lng, goalLb=goal)
    if n in DOWN: w['down'] = True
    weeks.append(w)

phases = [
 dict(name='Phase 1 · Base', start='2026-11-16', end='2027-01-10', summary='Build the habit, set your baselines, lift three times a week. The long run grows to 10 miles.'),
 dict(name='Phase 2 · Build', start='2027-01-11', end='2027-03-07', summary='Tuesday hills, Wednesday runs, more food. Long runs reach 3 hours; Sunday runs start.'),
 dict(name='Phase 3 · Peak', start='2027-03-08', end='2027-04-18', summary='Back-to-back weekends. Biggest runs Apr 10 and 17. The deficit ends Mar 28.'),
 dict(name='Taper and race', start='2027-04-19', end='2027-05-09', summary='Miles drop, keep the strides. Race Saturday, May 8.'),
]

spine = dict(name='Spine routine', minutes=15, when='Before every session', steps=[
 'Side-rib breathing into your left ribs: 10 breaths, 5 s in, 7 s out', 'Cat-camel: 10 slow reps', 'Side-lying open book: 8 each side',
 "Child's pose side reach: 3 × 30 s each way, one extra to the right", 'Dead hang: 3 × 20–30 s', 'Bird-dog: 6 each side, 5 s holds',
 'Half-kneeling hip flexor stretch: 45 s each side'])

effort = [
 dict(term='Easy', meaning='Full sentences, about 120–140 bpm. Walk hills that break the talk test.'),
 dict(term='Strides', meaning='4–6 × 20 s, fast but relaxed, full recovery.'),
 dict(term='Hills', meaning='60–90 s uphill at 7 out of 10. Walk back down.'),
 dict(term='Steady', meaning='10–15 min blocks, comfortably hard. 3 min easy between.'),
 dict(term='Long run', meaning='Easy all the way. Power-hike the climbs.'),
]

CHANGE = ['Weight over 0.5 lb a week behind for two weeks: cut 150 kcal. Losing over 2 lb a week: add 200.',
 'Back score 2 over baseline for 48 hours: cut next week’s volume 25%.',
 'Lifts down 10%, or resting heart rate up 7 beats: eat at maintenance and add a rest day.',
 'Low libido, low mood or repeated illness: stop the deficit and tell your doctor.',
 'Leg numbness or weakness, night pain, chest pain or pinpoint bone pain: stop and get seen.']
TIMING = ['Four meals a day, 45–55 g of protein each.', '30–60 g of carbs one to two hours before any run over an hour. Never run Tuesday’s session or the long run fasted.',
 'On runs over 90 minutes, take carbs every hour. They count toward the day.', 'Eat a meal with 40 g or more of protein within two hours after training.']
notes = [
 dict(title='When to change the plan', bullets=CHANGE),
 dict(title='This month', start='2026-11-16', end='2026-11-30', bullets=['Lift before you run. Strength is the priority while mileage is low.',
   'Every run is easy: full sentences. Walk hills that break the talk test.', 'Two rest days a week: Monday and Friday. Friday off keeps your legs fresh for Saturday.',
   'Weigh every morning, compare weekly averages. Expect about 1.4 lb a week.', 'Weigh and log your food for the first four weeks.']),
 dict(title='This month', start='2026-12-01', end='2026-12-31', bullets=['Keep lifting before you run.', 'Wednesday adds a short easy run from Dec 16.',
   'Long runs over 90 minutes (Dec 19 on): take 30 g of carbs an hour.', 'The week of Dec 7 is a down week. Do not add miles.',
   'On snow or ice, wear traction devices and run by time, not miles.']),
 dict(title='This month', start='2027-01-01', end='2027-01-31', bullets=['Through Jan 10, keep the December pattern. From Jan 11, run before you lift.',
   'Tuesday hills: hard but controlled, 7 out of 10. Walk back down.', 'Wednesday becomes an easy run plus a short Strength C. Rest days stay Monday and Friday.',
   'Food goes up to about 3,000 kcal a day on Jan 11. Eat it.', 'Take 30 g of carbs an hour on every long run.', 'Register for the race and check its cutoff time.']),
 dict(title='This month', start='2027-02-01', end='2027-02-28', bullets=['The week of Feb 1 is a down week: Wednesday is bike and Strength C, no run.',
   'Long runs build to 3:00 on Feb 27.', 'From Feb 13: 40 g of carbs an hour, and Sunday adds an easy run.', 'Add pogo hops and low box jumps to Strength A if your back allows.',
   'Treadmill hills at 4–8% are fine. Keep treadmill long runs under 90 minutes.', 'Feb 27: first 3-hour long run. Carry two flasks and your own gels.',
   'Film yourself running from behind. Compare left and right side-plank times.', 'Confirm your race entry and the cutoff time.']),
 dict(title='This month', start='2027-03-01', end='2027-03-31', bullets=['The week of Mar 1 is a down week. Peak starts Mar 8.', 'Saturdays pass 3 hours. Sundays are easy runs on tired legs.',
   'Run every long run in the Southern Kettle Moraine. Include the Nordic loop.', 'Take 50 g of carbs an hour. Practice aid-station food. Do a sweat test.',
   'The deficit ends Mar 28. If you are above 203 lb, do not extend it.', 'Strength drops to two sets. Never lift to soreness.', 'Repeat your bloodwork this month.']),
 dict(title='This month', start='2027-04-01', end='2027-04-30', bullets=['Eat at maintenance all month. No deficit.', 'Apr 10 is 22 miles. Apr 17 is 24 miles, the longest run.',
   'Rehearse race day on Apr 17: breakfast, vest, shoes, fueling.', 'Taper starts Apr 19. Miles drop. Keep the strides.', 'One light strength session a week, on Tuesday, at 80% of your usual weights.']),
 dict(title='This month', start='2027-05-01', end='2027-05-09', bullets=['No strength work in race week.', 'Thursday and Friday: carb load. Expect the scale to jump 3–4 lb.',
   'Nothing new on race day: shoes, vest, socks and food have all done a long run.', 'After the race: two easy weeks at maintenance.', 'Then a 500 kcal deficit for about seven weeks reaches 10% around mid-July.']),
 dict(title='Food timing', bullets=TIMING),
 dict(title='Race day plan', start='2027-05-03', end='2027-05-09', bullets=['Eat 90–135 g of carbs two to three hours before the start.',
   'Every hour: about 50 g carbs, 15–25 oz fluid, 250–450 mg sodium. Start in the first 30 minutes.', 'The first hour should feel too easy. Keep your heart rate under about 140 through the hilly first section.',
   'Hike every climb from the first mile.', 'Save caffeine for the second half.', 'The race ends with two loops of the runnable Nordic Trail. Use the legs you saved.',
   'Nine aid stations are listed, seven with food. Carry your own gels anyway.', 'Confirm your 50K start time on the race website.',
   'Stop for new leg numbness or weakness, chest pain, or breathlessness out of proportion to the effort.']),
]

plan = {
 'format': 'durata-plan', 'version': 1, 'id': 'ice-age-50k-2027', 'name': 'Ice Age Trail 50K',
 'description': '25 weeks, Nov 16, 2026 to the race on May 8, 2027. Long-run times assume 12:00 a mile.',
 'start': '2026-11-16', 'end': '2027-05-09',
 'race': dict(date='2027-05-08', name='Ice Age Trail 50K', detail='31 miles · La Grange'),
 'phases': phases, 'weeks': weeks, 'targets': T, 'workouts': workouts,
 'routine': spine, 'effort': effort, 'notes': notes, 'days': days,
}
json.dump(plan, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
# Checks against the PDF's week-by-week miles.
for w in weeks:
    s = D(w['start']); tot = sum(i.get('miles', 0) for d in days if s <= D(d['date']) < s + dt.timedelta(days=7) for i in d['items'] if i['type'] in ('run', 'race'))
    if tot != w['miles']: print('MISMATCH week', w['number'], tot, w['miles'])
print(len(days), 'days', days[0]['date'], days[-1]['date'])
