import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { TOUR_VERSION, useStore } from '../store'
import type { Tab } from './TabBar'

/**
 * The app tour: the real screens, dimmed, with a spotlight on one thing at a time, an arrow to it and a short note.
 * A couple of stops ask you to try it (tap the tab yourself, tick a practice set) so it's felt rather than read.
 * Targets are elements marked data-tour="…"; a stop whose target isn't on screen shows its note in the middle.
 */

interface Step {
  id: string
  title: string
  body: React.ReactNode
  /** data-tour value of the element to point at. */
  target?: string
  /** Tab to show for this stop. */
  tab?: Tab
  /** A circle for small buttons, a pill for tabs, a rounded box for cards. */
  shape?: 'circle' | 'pill' | 'rect'
  /** Do it yourself: tap the tab; the tour moves on once it's showing. "Show me" switches for you. */
  tryIt?: { hint: string; tab: Tab }
  /** A practice set to tick (nothing is saved). */
  practice?: boolean
}

interface Box { top: number; left: number; width: number; height: number }
const same = (a: Box | null, b: Box | null) => !!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect()
  return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) }
}

/** Where `el` (the target) and `card` (the note) are on screen, kept up to date while things move or scroll. */
function useBoxes(target: string | undefined, card: React.RefObject<HTMLDivElement | null>) {
  const [box, setBox] = useState<Box | null>(null)
  const [cardBox, setCardBox] = useState<Box | null>(null)
  useEffect(() => {
    let raf = 0
    let scrolled = false
    const tick = () => {
      const el = target ? document.querySelector(`[data-tour="${target}"]`) : null
      if (el && !scrolled) {
        scrolled = true
        // Bring it into view once, near the top so the note fits below it (the tab bar is always on screen).
        if (!el.closest('nav')) window.scrollTo({ top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - 96) })
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

/** A practice set: tick it to feel how logging works. Nothing is saved. */
function PracticeSet() {
  const kg = useStore((s) => s.units.weight === 'kg')
  const [done, setDone] = useState(false)
  return (
    <div className="mt-3 rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm"><b className="font-semibold">Set 1</b> · {kg ? '60 kg' : '135 lb'} × 8</span>
        <button
          onClick={() => setDone((d) => !d)}
          aria-pressed={done}
          aria-label="Practice set done"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${done ? 'bg-green-500 text-white' : 'tour-ring bg-surface text-neutral-500 ring-2 ring-accent'}`}
        >
          ✓
        </button>
      </div>
      <p className={`mt-2 text-xs ${done ? 'font-medium text-green-600' : 'text-neutral-400'}`}>
        {done ? 'Logged! That’s a set. Lifted something different? Type it before you tap.' : 'Try it: tap ✓. Just practice, nothing is saved.'}
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
      body: 'A quick look around: the main things, where they are, and a couple to try. About a minute.',
    },
    {
      id: 'today', tab: 'home', target: 'today', shape: 'rect', title: 'Today',
      body: 'Today’s workout and one Start button. Nothing planned? Have one made, repeat your last, or pick exercises yourself.',
    },
    {
      id: 'goals', tab: 'home', target: 'goals', shape: 'rect', title: 'Goals',
      body: 'A lift, a race, workouts a week: set a target and the bar fills as you go.',
    },
    {
      id: 'settings', tab: 'home', target: 'settings', shape: 'circle', title: 'Settings',
      body: 'Profile, goals, equipment, units and cloud backup. The gear is at the top of every tab.',
    },
    {
      id: 'workouts', tab: 'home', target: 'tab-plan', shape: 'pill', title: 'Workouts',
      body: 'Your week, and each day’s workout ready to log.',
      tryIt: { hint: 'Try it: tap Workouts', tab: 'plan' },
    },
    {
      id: 'week', tab: 'plan', target: 'week', shape: 'rect', title: 'Your week',
      body: 'Each day shows what’s planned. Tap a day to see its workout, or to change it.',
    },
    {
      id: 'log', tab: 'plan', target: 'day', shape: 'rect', title: 'Logging a set',
      body: 'Each set comes ready with a target from last time, so most sets are one tap: ✓ when it’s done.',
      practice: true,
    },
    {
      id: 'add', tab: 'plan', target: 'add', shape: 'rect', title: '+ Add',
      body: 'Add an exercise, have a workout made for you, or plan a week or month. Timed workouts and run plans are here too.',
    },
    {
      id: 'progress', tab: 'plan', target: 'tab-history', shape: 'pill', title: 'Progress',
      body: 'Everything you’ve done, and how it’s going.',
      tryIt: { hint: 'Try it: tap Progress', tab: 'history' },
    },
    {
      id: 'progress-tabs', tab: 'history', target: 'progress-tabs', shape: 'rect', title: 'History, Exercises, Body',
      body: 'Every workout you’ve logged, charts and personal bests for each exercise, and your weight, measurements and photos.',
    },
    ...(social ? [{
      id: 'social', target: 'tab-social', shape: 'pill' as const, title: 'Social',
      body: 'Share workouts, send challenges, cheer each other on. Each friend sees only what you allow.',
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
  const card = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const { box, cardBox } = useBoxes(step.target, card)

  const finish = () => {
    // The tour covers the one-time tips on these screens.
    seeTip('plan')
    seeTip('progress')
    setTourDone(true)
  }
  const next = () => (last ? (navigate('home'), finish()) : setI((n) => n + 1))

  // Each stop shows its tab (once, on arriving).
  const arrivedAt = useRef<string | null>(null)
  useEffect(() => {
    if (arrivedAt.current === step.id) return
    arrivedAt.current = step.id
    if (step.tab && step.tab !== tab) navigate(step.tab)
  }, [step, tab, navigate])
  // Try it: a try-it stop moves on when its tab gets tapped, i.e. a switch from the stop's own tab to that one (stepping
  // Back onto "tap Workouts" while Workouts is showing doesn't count).
  const [prevTab, setPrevTab] = useState(tab)
  if (prevTab !== tab) {
    setPrevTab(tab)
    if (step.tryIt && tab === step.tryIt.tab && prevTab === step.tab) setI((n) => n + 1)
  }
  useLayoutEffect(() => { primary.current?.focus({ preventScroll: true }) }, [step.id])
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') finish() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const vw = window.innerWidth
  const vh = window.innerHeight
  // The spotlight: a circle for buttons, a rounded box for cards.
  const pad = step.shape === 'circle' ? 10 : step.shape === 'pill' ? 2 : 8
  // A tall target (a whole workout) gets its top part lit, leaving room for the note.
  const tall = Math.min(box?.height ?? 0, Math.round(vh * 0.3))
  const hole = box && (step.shape === 'circle'
    ? (() => { const d = Math.max(box.width, box.height) + pad * 2; return { top: box.top + box.height / 2 - d / 2, left: box.left + box.width / 2 - d / 2, width: d, height: d, radius: d / 2 } })()
    : { top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: tall + pad * 2, radius: step.shape === 'pill' ? (tall + pad * 2) / 2 : 20 })
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
  const tryIt = step.tryIt
  // Taps go through only to the thing being tried; everything else is held still while the tour is up.
  const blockers = tryIt && hole
    ? [
        { top: 0, left: 0, width: vw, height: Math.max(0, hole.top) },
        { top: hole.top + hole.height, left: 0, width: vw, height: Math.max(0, vh - hole.top - hole.height) },
        { top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height },
        { top: hole.top, left: hole.left + hole.width, width: Math.max(0, vw - hole.left - hole.width), height: hole.height },
      ]
    : [{ top: 0, left: 0, width: vw, height: vh }]
  const stops = steps.length - 2
  const count = !first && !last ? `${i} of ${stops}` : ''

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" data-testid="tour">
      {blockers.map((b, n) => <div key={n} aria-hidden className="pointer-events-auto fixed" style={b} />)}
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
        <p className="text-sm text-neutral-600">{step.body}</p>
        {step.practice && <PracticeSet />}
        {tryIt ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="rounded-full bg-accent/20 px-3 py-1.5 text-sm font-semibold text-neutral-900">👉 {tryIt.hint}</p>
            <button ref={primary} onClick={() => navigate(tryIt.tab)} className="shrink-0 rounded-full bg-neutral-100 px-3 py-1.5 text-sm text-neutral-600">Show me</button>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            {!first && !last && <button onClick={() => setI((n) => n - 1)} className="rounded-2xl bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-700">Back</button>}
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
    </div>
  )
}
