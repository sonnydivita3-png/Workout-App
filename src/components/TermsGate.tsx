import { useState } from 'react'
import { HEALTH_FLAGS, OPERATOR, STOP_SIGNS, type LegalDoc } from '../lib/legal'
import { useStore } from '../store'
import { LegalSheet } from './LegalSheet'

const primary = 'w-full rounded-2xl bg-accent py-3.5 text-base font-semibold text-on-accent disabled:opacity-30'
const box = 'flex items-start gap-3 rounded-2xl bg-surface px-4 py-3 text-sm ring-1 ring-neutral-200'

/**
 * Before anything else (and again when the terms change): the health check, the assumption of risk and release, and
 * the terms, each agreed to on its own so none of it is buried.
 */
export function TermsGate() {
  const acceptLegal = useStore((s) => s.acceptLegal)
  const [health, setHealth] = useState(false)
  const [risk, setRisk] = useState(false)
  const [terms, setTerms] = useState(false)
  const [legal, setLegal] = useState<LegalDoc | null>(null)
  const link = (d: LegalDoc, text: string) => <button type="button" onClick={() => setLegal(d)} className="font-medium underline">{text}</button>

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Before you start</h1>
        <p className="mb-5 text-neutral-600">Durata gives you workouts and training plans. It doesn’t know your health, so please read this and agree before using it.</p>

        <h2 className="mb-2 font-semibold">Is exercise safe for you right now?</h2>
        <p className="mb-2 text-sm text-neutral-600">Talk to a doctor before using Durata if any of these apply:</p>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-neutral-600">
          {HEALTH_FLAGS.map((f) => <li key={f}>{f}</li>)}
        </ul>
        <p className="mb-5 text-sm text-neutral-600">{STOP_SIGNS}</p>

        <div className="space-y-2">
          <label className={box}>
            <input type="checkbox" checked={health} onChange={(e) => setHealth(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>None of these apply to me, or a doctor has said I can exercise. I’ll stop and get help if I notice any warning signs.</span>
          </label>
          <label className={box}>
            <input type="checkbox" checked={risk} onChange={(e) => setRisk(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>Assumption of risk and release.</b> I understand that exercise can cause injury, illness and, rarely, death, and I accept those
              risks. I release {OPERATOR} and the people and company behind it from claims for injury, illness or death from my exercise,
              <b> including claims based on their negligence</b>, as explained in sections 5 and 6 of the {link('terms', 'terms of use')}.
            </span>
          </label>
          <label className={box}>
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              I’m 18 or older, or I’m 13 to 17 and my parent or guardian agrees to these terms for me. I agree to the {link('terms', 'terms of use')} (including
              individual arbitration and no class actions, section 13), the {link('health', 'health notice')} and the {link('privacy', 'privacy policy')}.
            </span>
          </label>
        </div>

        <div className="mt-auto pt-6">
          <button disabled={!health || !risk || !terms} onClick={acceptLegal} className={primary}>Agree and continue</button>
          <p className="mt-3 text-center text-xs text-neutral-400">If you don’t agree, please don’t use the app.</p>
        </div>
      </main>
      {legal && <LegalSheet doc={legal} onClose={() => setLegal(null)} />}
    </div>
  )
}
