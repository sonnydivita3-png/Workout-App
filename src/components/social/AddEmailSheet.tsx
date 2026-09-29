import { useState } from 'react'
import { describeError, useSocial } from '../../social/store'
import { Sheet } from '../Sheet'
import { input, label, primary } from './styles'
import { ErrorNote } from './ui'

/** Attach an email to an account made without one, so it can be recovered on another phone. */
export function AddEmailSheet({ onClose }: { onClose: () => void }) {
  const { backend, init } = useSocial()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError(describeError(e)) } finally { setBusy(false) }
  }

  return (
    <Sheet title="Add an email" onClose={onClose} closeLabel={step === 'done' ? 'Done' : 'Cancel'}>
      {step === 'email' && (
        <>
          <p className="mb-4 text-sm text-neutral-600">Your account is only on this phone right now. Add an email so you can sign back in if you get a new phone or clear the app. Friends never see it.{backend.kind === 'demo' && ' (Preview mode: the code is 123456.)'}</p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <label className={`${label} block`}>Email</label>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={`${input} mb-4`} />
          <button disabled={busy || !email.includes('@')} onClick={() => run(async () => { await backend.addEmail(email); setStep('code') })} className={primary}>{busy ? 'Sending…' : 'Send code'}</button>
        </>
      )}
      {step === 'code' && (
        <>
          <p className="mb-4 text-sm text-neutral-600">We sent a code to {email}.</p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="123456" className={`${input} mb-4 text-center text-2xl tracking-widest`} />
          <button disabled={busy || code.length < 6} onClick={() => run(async () => { await backend.confirmEmail(email, code); await init(); setStep('done') })} className={primary}>{busy ? 'Checking…' : 'Confirm'}</button>
        </>
      )}
      {step === 'done' && <p className="py-6 text-center text-neutral-600">✅ Email added. You can now sign in with it on any phone.</p>}
    </Sheet>
  )
}
