import { useState } from 'react'
import { bodyweightOn } from '../lib/calories'
import { showWeight, storeWeight } from '../lib/units'
import { useToday } from '../lib/useToday'
import { useStore } from '../store'
import type { AboutMe } from '../types'
import { NumberInput } from './NumberInput'

const SEXES: [NonNullable<AboutMe['sex']>, string][] = [['male', 'Male'], ['female', 'Female'], ['unspecified', 'Prefer not to say']]
const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? 'bg-accent text-on-accent' : 'bg-neutral-100 text-neutral-600'}`

/**
 * Sex, birth year, height and weight: what calorie estimates need (resting burn, Mifflin-St Jeor, from the first
 * three; the burn itself from weight). Saved as they're typed; weight as today's weigh-in.
 */
export function AboutYouForm() {
  const { aboutMe, setAboutMe, units, bodyweight, logBodyweight } = useStore()
  const today = useToday()
  const metric = units.weight === 'kg'
  const lb = bodyweightOn(bodyweight, today)
  // What they've typed, kept while it's partway there ("1" on the way to 180); saved once it's a believable weight.
  const [weightIn, setWeightIn] = useState<number | null>(showWeight(lb, units))
  const setWeight = (v: number | null) => {
    setWeightIn(v)
    const w = storeWeight(v, units)
    if (w && w >= 50 && w <= 700) logBodyweight(today, w)
  }
  const ft = aboutMe.heightIn == null ? null : Math.floor(aboutMe.heightIn / 12)
  const inch = aboutMe.heightIn == null ? null : Math.round(aboutMe.heightIn - (ft ?? 0) * 12)
  const setFeet = (f: number | null) => setAboutMe({ heightIn: f == null ? null : f * 12 + (inch ?? 0) })
  const setInches = (i: number | null) => setAboutMe({ heightIn: ft == null && i == null ? null : (ft ?? 0) * 12 + (i ?? 0) })
  const year = Number(today.slice(0, 4))
  const badYear = aboutMe.birthYear != null && (aboutMe.birthYear < 1900 || aboutMe.birthYear > year - 10)
  const badHeight = aboutMe.heightIn != null && (aboutMe.heightIn < 36 || aboutMe.heightIn > 96)

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">Sex</p>
        <div role="group" aria-label="Sex" className="flex flex-wrap gap-2">
          {SEXES.map(([v, l]) => <button key={v} onClick={() => setAboutMe({ sex: v })} aria-pressed={aboutMe.sex === v} className={chip(aboutMe.sex === v)}>{l}</button>)}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Birth year</p>
        <div className="w-32"><NumberInput label="Birth year" value={aboutMe.birthYear} placeholder="e.g. 1988" onChange={(v) => setAboutMe({ birthYear: v && v > 0 ? Math.round(v) : null })} /></div>
        {badYear && <p className="mt-1 text-xs text-amber-700">A year between 1900 and {year - 10}.</p>}
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Height</p>
        {metric ? (
          <div className="flex items-center gap-2">
            <div className="w-28"><NumberInput label="Height (cm)" value={aboutMe.heightIn == null ? null : Math.round(aboutMe.heightIn * 2.54)} placeholder="e.g. 178" onChange={(v) => setAboutMe({ heightIn: v && v > 0 ? Math.round((v / 2.54) * 10) / 10 : null })} /></div>
            <span className="text-sm text-neutral-500">cm</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-20"><NumberInput label="Height (feet)" value={ft} placeholder="5" onChange={(v) => setFeet(v && v > 0 ? Math.round(v) : null)} /></div>
            <span className="text-sm text-neutral-500">ft</span>
            <div className="w-20"><NumberInput label="Height (inches)" value={inch} placeholder="10" onChange={(v) => setInches(v != null && v >= 0 ? Math.min(11, Math.round(v)) : null)} /></div>
            <span className="text-sm text-neutral-500">in</span>
          </div>
        )}
        {badHeight && <p className="mt-1 text-xs text-amber-700">That height looks off: {metric ? '90 to 245 cm' : "3' to 8'"}.</p>}
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Weight</p>
        <div className="flex items-center gap-2">
          <div className="w-28"><NumberInput label={`Weight (${units.weight})`} value={weightIn} placeholder={units.weight} step={0.1} onChange={setWeight} /></div>
          <span className="text-sm text-neutral-500">{units.weight}</span>
        </div>
        <p className="mt-1 text-xs text-neutral-400">Saved as today’s weigh-in; update it any time in Progress → Body.</p>
      </div>
    </div>
  )
}
