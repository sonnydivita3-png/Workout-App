import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { useSocial, describeError } from '../../social/store'
import { AVATARS, HANDLE_RE, normalizeHandle } from '../../social/types'
import { AvatarPicker } from './AvatarPicker'
import { input, label, primary, secondary } from './styles'
import { ErrorNote } from './ui'

type Step = 'intro' | 'email' | 'code' | 'profile'

interface Props {
  /** 'gate' is the first-run page; 'sheet' is the same flow opened from Settings or the Social tab. */
  variant: 'gate' | 'sheet'
  onDone: () => void
  onCancel?: () => void
}

export function SocialSetup({ variant, onDone, onCancel }: Props) {
  const { backend, init } = useSocial()
  const { name, setSocialChoice } = useStore()
  const [step, setStep] = useState<Step>(variant === 'gate' ? 'intro' : 'email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState(name)
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const demo = backend.kind === 'demo'

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError(describeError(e)) } finally { setBusy(false) }
  }

  // Already signed in on this device (e.g. after turning social off and on again): pick up where we left off.
  useEffect(() => {
    if (variant !== 'sheet') return
    void (async () => {
      const u = await backend.currentUser().catch(() => null)
      if (!u) return
      if (await backend.myProfile().catch(() => null)) { setSocialChoice('enabled'); await init(); onDone() } else setStep('profile')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const skip = () => { setSocialChoice('declined'); onDone() }

  const cleanHandle = normalizeHandle(handle)
  const handleOk = HANDLE_RE.test(cleanHandle)

  const body = (
    <div className="mx-auto w-full max-w-md px-6 py-8">
      {step === 'intro' && (
        <>
          <p className="mb-1 text-sm text-neutral-400">Welcome to</p>
          <h1 className="mb-4 text-3xl font-semibold tracking-tight">EZ Workout Tracker</h1>
          <p className="mb-5 text-neutral-600">Want to train with friends? Add a handle and you can share workouts, send challenges, and cheer each other on.</p>
          <ul className="mb-6 space-y-2 text-sm text-neutral-600">
            <li>🔒 <b className="font-medium">You’re in control.</b> Being friends shares nothing. You choose, friend by friend, what each one can do, and you can change it any time.</li>
            <li>🔎 <b className="font-medium">Friends find you by exact handle only.</b> There’s no public list of people, and your email is never shown.</li>
            <li>💬 <b className="font-medium">Emoji, not chat.</b> Just a few reactions, no messages from strangers.</li>
            <li>🙈 <b className="font-medium">Body weight and goals stay private.</b> Only a friend you allow can see a simple progress summary.</li>
          </ul>
          {demo && <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Preview mode: friends are simulated on this device until the app is connected to a server.</p>}
          <button onClick={() => setStep('email')} className={primary}>Set up social features</button>
          <button onClick={skip} className="mt-3 w-full py-2 text-sm text-neutral-500">Skip for now</button>
          <p className="mt-2 text-center text-xs text-neutral-400">You can turn this on later in Settings. The app works fully without it.</p>
        </>
      )}

      {step === 'email' && (
        <>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Add your email <span className="text-base font-normal text-neutral-400">(optional)</span></h1>
          <p className="mb-5 text-sm text-neutral-500">We’ll send a 6-digit code. No password. Your email is only used to sign in and recover your account, and is never shown to other people.</p>
          {demo && <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Preview mode: no email is sent. Use the code <b>123456</b>.</p>}
          {error && <ErrorNote>{error}</ErrorNote>}
          <label className={`${label} block`}>Email</label>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={`${input} mb-4`} />
          <button disabled={busy || !email.includes('@')} onClick={() => run(async () => { await backend.sendCode(email); setStep('code') })} className={primary}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
          <button disabled={busy} onClick={() => run(async () => { await backend.signInAnonymously(); setStep('profile') })} className={`${secondary} mt-2`}>
            Continue without email
          </button>
          <p className="mt-2 text-xs text-neutral-400">Without an email your account stays on this phone. If you delete the app or clear its data you’ll lose it (and your friends). You can add an email later in Settings.</p>
        </>
      )}

      {step === 'code' && (
        <>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Enter your code</h1>
          <p className="mb-5 text-sm text-neutral-500">We sent a code to {email}.{demo && ' (Preview mode: it’s 123456.)'}</p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="123456" className={`${input} mb-4 text-center text-2xl tracking-widest`} />
          <button
            disabled={busy || code.length < 6}
            onClick={() => run(async () => {
              await backend.verifyCode(email, code)
              if (await backend.myProfile()) { setSocialChoice('enabled'); await init(); onDone() } else setStep('profile')
            })}
            className={primary}
          >
            {busy ? 'Checking…' : 'Continue'}
          </button>
          <button onClick={() => { setStep('email'); setCode(''); setError(null) }} className="mt-3 w-full py-2 text-sm text-neutral-500">Use a different email</button>
        </>
      )}

      {step === 'profile' && (
        <>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Pick your handle</h1>
          <p className="mb-5 text-sm text-neutral-500">Friends add you by this exact handle. You can’t change it later.</p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <label className={`${label} block`}>Handle</label>
          <div className="mb-1 flex items-center rounded-xl bg-neutral-100 px-4">
            <span className="text-neutral-400">@</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="yourname" className="w-full bg-transparent py-2.5 pl-1 outline-none" />
          </div>
          <p className={`mb-4 text-xs ${handle && !handleOk ? 'text-red-600' : 'text-neutral-400'}`}>3–20 letters, numbers or underscores.</p>
          <label className={`${label} block`}>Display name</label>
          <input value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} placeholder="What friends see" className={`${input} mb-4`} />
          <p className={label}>Avatar</p>
          <div className="mb-5"><AvatarPicker value={avatar} onChange={setAvatar} name={displayName} /></div>
          <label className="mb-5 flex items-start gap-3 text-sm text-neutral-600">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>I agree that my handle and display name are visible to people who look up my exact handle. I decide what each friend can see or send me, and I can turn social features off any time.</span>
          </label>
          <button
            disabled={busy || !handleOk || !displayName.trim() || !agree}
            onClick={() => run(async () => {
              await backend.createProfile({ handle: cleanHandle, displayName: displayName.trim(), avatar })
              setSocialChoice('enabled'); await init(); onDone()
            })}
            className={primary}
          >
            {busy ? 'Creating…' : 'Create my account'}
          </button>
        </>
      )}
    </div>
  )

  if (variant === 'gate') return <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-50">{body}</div>
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-neutral-50">
      <div className="mx-auto max-w-md px-6 pt-4"><button onClick={onCancel} className="text-sm text-neutral-500">‹ Cancel</button></div>
      {body}
      <div className="mx-auto max-w-md px-6 pb-8"><button onClick={onCancel} className={secondary}>Not now</button></div>
    </div>
  )
}

