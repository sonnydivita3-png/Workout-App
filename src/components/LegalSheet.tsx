import { Sheet } from './Sheet'

export type LegalDoc = 'privacy' | 'terms' | 'health'

const UPDATED = 'October 1, 2026'
const REPO = 'https://github.com/sonnydivita3-png/Workout-App'

/** Plain-language privacy policy, terms of use and health notice. */
export function LegalSheet({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  const title = doc === 'privacy' ? 'Privacy' : doc === 'terms' ? 'Terms of use' : 'Health notice'
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="space-y-3 pb-2 text-sm leading-relaxed text-neutral-700 [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-neutral-900">
        {doc === 'privacy' && (
          <>
            <p className="text-xs text-neutral-400">Last updated {UPDATED}</p>
            <p>EZ Workout Tracker is built to keep your data on your phone unless you choose otherwise.</p>
            <h3>What stays on your phone</h3>
            <p>Your plans, workouts, goals, body weight, measurements and settings are stored in your browser on this device. Progress photos are stored only on this device and are never uploaded.</p>
            <h3>What’s sent to our server, and only if you turn it on</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li><b>Cloud backup:</b> a copy of your workout data (not photos) linked to your account, so you can restore it.</li>
              <li><b>Social features:</b> your handle, display name and avatar; friend connections and the permissions you choose; workouts, challenges, requests and emoji you send or receive; and, if you allow a friend to see it, a progress summary (recent exercises, weekly count, streak, recent personal bests). Body weight, measurements and goals are never shared.</li>
              <li><b>Email:</b> optional. Used only to sign you in with a code and to recover your account. It is never shown to other people.</li>
            </ul>
            <h3>What we don’t do</h3>
            <p>No ads, no selling or renting data, no third-party analytics or trackers. Data is stored with our database provider (Supabase) only to run these features.</p>
            <h3>Your choices</h3>
            <p>You can turn off backup or social features at any time in Settings, export your data to a file, erase everything on this device, and delete your account under Settings → Account (which deletes your backup and all social data on the server).</p>
            <h3>Children</h3>
            <p>Social features and accounts are only for people 13 and older.</p>
            <h3>Questions</h3>
            <p>Open an issue at <a className="underline" href={REPO} target="_blank" rel="noreferrer">the project’s page</a>.</p>
          </>
        )}
        {doc === 'terms' && (
          <>
            <p className="text-xs text-neutral-400">Last updated {UPDATED}</p>
            <p>By using EZ Workout Tracker you agree to these terms.</p>
            <h3>The app</h3>
            <p>The app is provided free and “as is”, without warranties. Features may change. Keep your own backups; we aren’t responsible for lost data.</p>
            <h3>Your account</h3>
            <p>You must be 13 or older to create an account or use social features. Keep your sign-in email secure. You’re responsible for what you send from your account.</p>
            <h3>Be decent</h3>
            <p>Don’t use the app to harass anyone, impersonate others, spam, or try to break or misuse the service. We may remove accounts that do.</p>
            <h3>Not medical advice</h3>
            <p>Workouts, plans, paces and suggestions are general fitness information, not medical advice. See the health notice.</p>
          </>
        )}
        {doc === 'health' && (
          <>
            <p>Exercise carries risk. The workouts, training plans, paces and “try this next” suggestions in this app are general guidance based on common training principles. They don’t know your health, injuries or limits.</p>
            <p>Check with a doctor before starting a new program, especially if you have a medical condition, are pregnant, or haven’t exercised in a while. Stop if you feel pain, dizziness or shortness of breath beyond normal effort.</p>
            <p>Use good form, warm up, and adjust weights and distances to how you feel on the day.</p>
          </>
        )}
      </div>
    </Sheet>
  )
}
