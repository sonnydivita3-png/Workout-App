import { profileComplete } from '../lib/calories'
import { primaryBtn } from './Sheet'
import { useStore } from '../store'
import { AboutYouForm } from './AboutYouForm'

/**
 * For anyone using the app without sex, age, height or a weigh-in (they set up before it asked, or cleared one):
 * filled in once before carrying on, since calorie estimates need them.
 */
export function ProfileSetup({ onDone }: { onDone: () => void }) {
  const done = useStore((s) => profileComplete(s.aboutMe, s.bodyweight))
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Finish your profile</h1>
        <p className="mb-5 text-neutral-600">
          Calorie estimates (cardio, calorie-target workouts, your weekly burn) now use your sex, age, height and weight, so they fit
          you. It takes a few seconds, stays in the app (and your backup, if you have one), and you can change it in Settings.
        </p>
        <AboutYouForm />
        <div className="mt-auto pt-6">
          {!done && <p role="status" className="mb-2 text-center text-xs text-neutral-400">Fill in all four to carry on.</p>}
          <button disabled={!done} onClick={onDone} className={primaryBtn}>Done</button>
        </div>
      </div>
    </div>
  )
}
