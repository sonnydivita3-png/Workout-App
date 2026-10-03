import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { TOUR_VERSION, useStore } from '../store'
import type { Tab } from './TabBar'

/**
 * The app tour: the real screens, dimmed, with a spotlight on one thing at a time, an arrow to it and a short note.
 * "Show me" demonstrates a stop for real: a tap lands on the actual button, it does what it does (switches tab, opens
 * a sheet…), and the spotlight moves to what it opened. Next skips the demonstration. Anything a demonstration opened
 * is closed again on the way out. Targets are data-tour="…" names (or a selector starting with "["); a stop whose
 * target isn't on screen shows its note in the middle.
 */

type Shape = 'circle' | 'pill' | 'rect'

interface Step {
  id: string
  title: string
  body: React.ReactNode
  target?: string
  /** Tab to show for this stop. */
  tab?: Tab
  /** A circle for small buttons, a pill for tabs, a rounded box for cards. */
  shape?: Shape
  /** A practice set to tick (nothing is saved). */
  practice?: boolean
  show?: {
    /** What gets tapped, for real. */
    tap: string
    /** Then: where to point, and what to say. */
    then: { target?: string; shape?: Shape; body: React.ReactNode }
    /** Tapped on the way out, to close what the demonstration opened. */
    close?: string
  }
}

const find = (t: string) => document.querySelector<HTMLElement>(t.startsWith('[') ? t : `[data-tour="${t}"]`)
/** On a fixed layer (the tab bar, a sheet): no point scrolling the page to it. */
const onFixed = (el: HTMLElement) => { for (let e: HTMLElement | null = el; e; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false }

interface Box { top: number; left: number; width: number; height: number }
const same = (a: Box | null, b: Box | null) => !!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect()
  return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) }
}

/** Where the target and the note (`card`) are on screen, kept up to date while things move or scroll. */
function useBoxes(target: string | undefined, card: React.RefObject<HTMLDivElement | null>) {
  const [box, setBox] = useState<Box | null>(null)
  const [cardBox, setCardBox] = useState<Box | null>(null)
  useEffect(() => {
    let raf = 0
    let scrolled = false
    const tick = () => {
      const el = target ? find(target) : null
      if (el && !scrolled) {
        scrolled = true
        // Bring it into view once, near the top so the note fits below it.
        if (!onFixed(el)) window.scrollTo({ top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - 96) })
      }
      const b = el ? boxOf(el) : null
      setBox((cur) => (same(cur, b) || (!cur && !b) ? cur : b))
      const c = card.current ? boxOf(card.current) : null
      setCardBox((cur) => (same(cur, c) || (!cur && !c) ? cur : c))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, card])
  return { box, cardBox }
}

/** A practice set to tick. Nothing is saved. */
function PracticeSet({ done, onTick }: { done: boolean; onTick: () => void }) {
  const kg = useStore((s) => s.units.weight === 'kg')
  return (
    <div className="mt-3 rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm"><b className="font-semibold">Set 1</b> · {kg ? '60 kg' : '135 lb'} × 8</span>
        <button
          onClick={onTick}
          aria-pressed={done}
          aria-label="Practice set done"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${done ? 'bg-green-500 text-white' : 'bg-surface text-neutral-500 ring-2 ring-accent'}`}
        >
          ✓
        </button>
      </div>
      <p className={`mt-2 text-xs ${done ? 'font-medium text-green-600' : 'text-neutral-400'}`}>
        {done ? 'Logged! That’s a set.' : 'A practice set: nothing is saved.'}
      </p>
    </div>
  )
}

export function Tour({ tab, navigate }: { tab: Tab; navigate: (t: Tab) => void }) {
  const social = useStore((s) => s.socialChoice === 'enabled')
  const returning = useStore((s) => s.tourDone && s.tourVersion < TOUR_VERSION)
  const setTourDone = useStore((s) => s.setTourDone)
  const seeTip = useStore((s) => s.seeTip)

  const steps: Step[] = useMemo(() => [
    {
      id: 'welcome',
      title: returning ? 'Take the new tour 👋' : 'Welcome to Durata 👋',
      body: 'A quick look around. Tap Show me to see something in action, or Next to keep going.',
    },
    {
      id: 'today', tab: 'home', target: 'today', shape: 'rect', title: 'Today',
      body: 'Today’s workout and one Start button. Nothing planned? Have one made, repeat your last, or pick exercises yourself.',
    },
    {
      id: 'goals', tab: 'home', target: 'goals', shape: 'rect', title: 'Goals',
      body: 'A lift, a race, workouts a week: set a target and the bar fills as you go.',
      show: { tap: 'goal-add', then: { target: 'sheet', body: 'Pick what to aim for, then set the target. Just a look for now: nothing is saved.' }, close: 'sheet-close' },
    },
    {
      id: 'settings', tab: 'home', target: 'settings', shape: 'circle', title: 'Settings',
      body: 'The gear, at the top of every tab: your profile, equipment, units, backup and more.',
      show: { tap: 'settings', then: { target: 'settings-list', shape: 'rect', body: 'Everything you can set up: profile and equipment, workouts, notifications, look, backup and more.' } },
    },
    {
      id: 'workouts', tab: 'home', target: 'tab-plan', shape: 'pill', title: 'Workouts',
      body: 'Your week, and each day’s workout ready to log.',
      show: { tap: 'tab-plan', then: { target: 'week', shape: 'rect', body: 'Your week up top: tap a day to see its workout. Today’s is open below it.' } },
    },
    {
      id: 'log', tab: 'plan', target: 'day', shape: 'rect', title: 'Logging a set',
      body: 'Each set comes ready with a target from last time, so most sets are one tap: ✓ when it’s done.',
      practice: true,
      show: { tap: '[aria-label="Practice set done"]', then: { body: 'One tap and it’s logged. Lifted something different? Type it in first: ✓ saves what’s in the boxes.' } },
    },
    {
      id: 'add', tab: 'plan', target: 'add', shape: 'rect', title: '+ Add',
      body: 'Add an exercise, have a workout made for you, or plan a week or month.',
      show: { tap: 'add', then: { target: 'sheet', body: 'All the ways to add to a day: one exercise, a workout made for you, a week or month plan, a timed workout, or a run or ride plan.' }, close: 'sheet-close' },
    },
    {
      id: 'progress', tab: 'plan', target: 'tab-history', shape: 'pill', title: 'Progress',
      body: 'Everything you’ve done, and how it’s going.',
      show: { tap: 'tab-history', then: { target: 'progress-tabs', shape: 'rect', body: 'History: every workout you’ve logged. Exercises: charts and personal bests. Body: weight, measurements and photos.' } },
    },
    ...(social ? [{
      id: 'social', target: 'tab-social', shape: 'pill' as const, title: 'Social',
      body: 'Share workouts, send challenges, cheer each other on.',
      show: { tap: 'tab-social', then: { target: 'page', shape: 'rect' as const, body: 'Friends, shared workouts and challenges. Each friend sees only what you allow.' } },
    }] : []),
    {
      id: 'done',
      title: 'You’re all set 💪',
      body: <>Replay this tour any time from Settings → Help &amp; feedback.{social ? '' : ' Friends are optional: turn them on in Settings → Friends & account.'}</>,
    },
  ], [returning, social])

  const [i, setI] = useState(0)
  const step = steps[Math.min(i, steps.length - 1)]
  const first = i === 0
  const last = i === steps.length - 1
  // The stop whose "Show me" has run, and the tap landing while it runs.
  const [shown, setShown] = useState<string | null>(null)
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null)
  const demo = shown === step.id && step.show ? step.show.then : null
  const view = { target: demo ? demo.target ?? step.target : step.target, shape: demo?.shape ?? step.shape, body: demo ? demo.body : step.body }
  const card = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const { box, cardBox } = useBoxes(view.target, card)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Leaving a stop closes whatever its demonstration opened (a sheet).
  const leave = () => {
    if (shown === step.id && step.show?.close) find(step.show.close)?.click()
    setShown(null)
  }
  const goTo = (n: number) => { leave(); setI(n) }
  const finish = () => {
    leave()
    // The tour covers the one-time tips on these screens.
    seeTip('plan')
    seeTip('progress')
    setTourDone(true)
  }
  const next = () => (last ? (navigate('home'), finish()) : goTo(i + 1))
  const showMe = () => {
    const s = step.show
    if (!s || tap) return
    const el = find(s.tap)
    const id = step.id
    if (!el) { setShown(id); return }
    const r = el.getBoundingClientRect()
    setTap({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    // The tap lands, then the button does what it does.
    timers.current.push(window.setTimeout(() => { el.click(); setShown(id) }, 650))
    timers.current.push(window.setTimeout(() => setTap(null), 1000))
  }

  // Each stop shows its tab (once, on arriving).
  const arrivedAt = useRef<string | null>(null)
  useEffect(() => {
    if (arrivedAt.current === step.id) return
    arrivedAt.current = step.id
    if (step.tab && step.tab !== tab) navigate(step.tab)
  }, [step, tab, navigate])
  useLayoutEffect(() => { primary.current?.focus({ preventScroll: true }) }, [step.id, shown])
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') finish() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const vh = window.innerHeight
  // The spotlight: a circle for buttons, a pill for tabs, a rounded box for cards. A tall target (a whole workout, a
  // sheet) gets its top part lit, leaving room for the note.
  const pad = view.shape === 'circle' ? 10 : view.shape === 'pill' ? 2 : 8
  const tall = Math.min(box?.height ?? 0, Math.round(vh * 0.3))
  const hole = box && (view.shape === 'circle'
    ? (() => { const d = Math.max(box.width, box.height) + pad * 2; return { top: box.top + box.height / 2 - d / 2, left: box.left + box.width / 2 - d / 2, width: d, height: d, radius: d / 2 } })()
    : { top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: tall + pad * 2, radius: view.shape === 'pill' ? (tall + pad * 2) / 2 : 20 })
  // The note goes on whichever side of the target has more room, with space for the arrow.
  const above = !!hole && hole.top > vh - (hole.top + hole.height)
  const GAP = 56
  const cardStyle: React.CSSProperties = !hole
    ? { top: Math.max(16, (vh - (cardBox?.height ?? 260)) / 2) }
    : above
      ? { bottom: Math.max(12, vh - hole.top + GAP), maxHeight: Math.max(160, hole.top - GAP - 12) }
      : { top: Math.min(vh - 160, hole.top + hole.height + GAP), maxHeight: Math.max(160, vh - (hole.top + hole.height + GAP) - 12) }
  // The arrow: from the note's edge to the spotlight, gently curved.
  let arrow: string | null = null
  if (hole && cardBox) {
    const tx = hole.left + hole.width / 2
    const sx = Math.min(cardBox.left + cardBox.width - 32, Math.max(cardBox.left + 32, tx))
    const sy = above ? cardBox.top + cardBox.height + 4 : cardBox.top - 4
    const ty = above ? hole.top - 8 : hole.top + hole.height + 8
    if (Math.abs(ty - sy) > 16) {
      const my = (sy + ty) / 2
      arrow = `M ${sx} ${sy} C ${sx} ${my}, ${tx + (sx - tx) * 0.35} ${my}, ${tx} ${ty}`
    }
  }
  const stops = steps.length - 2
  const count = !first && !last ? `${i} of ${stops}` : ''
  const busy = !!tap
  const back = !first && !last && <button onClick={() => goTo(i - 1)} disabled={busy} className="rounded-2xl bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-700">Back</button>

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" data-testid="tour">
      {/* Everything but the tour is held still while it's up. */}
      <div aria-hidden className="pointer-events-auto fixed inset-0" />
      {/* The dimmed screen, with the spotlight cut out of it. */}
      {hole ? (
        <div
          aria-hidden
          className="pointer-events-none fixed transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height, borderRadius: hole.radius, boxShadow: '0 0 0 9999px rgba(8, 6, 16, 0.72)' }}
        >
          <div className="tour-ring absolute inset-0 ring-2 ring-accent" style={{ borderRadius: hole.radius }} />
        </div>
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 bg-[rgba(8,6,16,0.72)]" />
      )}
      {arrow && (
        <svg aria-hidden className="pointer-events-none fixed inset-0 h-full w-full text-accent">
          <defs>
            <marker id="tour-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          <path d={arrow} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" markerEnd="url(#tour-head)" />
        </svg>
      )}
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label="App tour"
        className="pop-in pointer-events-auto fixed inset-x-4 mx-auto max-w-sm overflow-y-auto rounded-3xl bg-surface p-5 shadow-2xl ring-1 ring-neutral-200"
        style={cardStyle}
        key={step.id}
      >
        <div className="mb-1 flex items-center justify-between text-xs text-neutral-400">
          <span>{count}</span>
          {!last && <button onClick={finish} className="text-neutral-500">{first ? 'Not now' : 'Skip tour'}</button>}
        </div>
        <h2 className="mb-1 text-xl font-semibold tracking-tight">{step.title}</h2>
        <p className="text-sm text-neutral-600" aria-live="polite">{view.body}</p>
        {/* Ticking it by hand counts as Show me. */}
        {step.practice && <PracticeSet done={!!demo} onTick={() => setShown(demo ? null : step.id)} />}
        {step.show && !demo ? (
          <div className="mt-4 flex gap-2">
            {back}
            <button ref={primary} onClick={showMe} disabled={busy} className="flex-1 rounded-2xl bg-accent py-2.5 text-sm font-medium text-on-accent">Show me</button>
            <button onClick={next} disabled={busy} className="rounded-2xl bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-700">Next</button>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            {back}
            <button ref={primary} onClick={next} className="flex-1 rounded-2xl bg-accent py-2.5 text-sm font-medium text-on-accent">
              {first ? 'Show me around' : last ? 'Let’s go' : 'Next'}
            </button>
          </div>
        )}
        {!last && !first && (
          <div className="mt-3 flex justify-center gap-1" aria-hidden>
            {steps.slice(1, -1).map((s, n) => <span key={s.id} className={`h-1.5 rounded-full transition-all ${n + 1 === i ? 'w-4 bg-accent' : 'w-1.5 bg-neutral-300'}`} />)}
          </div>
        )}
      </div>
      {/* The demonstration's tap. */}
      {tap && (
        <span aria-hidden className="tour-tap pointer-events-none fixed h-14 w-14 rounded-full border-4 border-white bg-accent/50 shadow-lg" style={{ left: tap.x - 28, top: tap.y - 28 }} />
      )}
    </div>
  )
}
