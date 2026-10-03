import { Sheet } from './Sheet'
import { feedbackLink } from '../lib/feedback'

import { LEGAL_TITLES, type LegalDoc } from '../lib/legal'

const UPDATED = 'October 1, 2026'
const REPO = 'https://github.com/sonnydivita3-png/Workout-App'

/** Plain-language privacy policy, terms of use and health notice, in a sheet inside the app. */
export function LegalSheet({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  return (
    <Sheet title={LEGAL_TITLES[doc]} onClose={onClose}>
      <LegalBody doc={doc} />
    </Sheet>
  )
}

/** The same documents as public pages (…/#privacy, #terms, #health, #delete-account) for app store listings. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-surface px-5 py-8">
      <p className="mb-1 text-sm text-neutral-400">Durata</p>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">{LEGAL_TITLES[doc]}</h1>
      <LegalBody doc={doc} />
      <a href="./" className="mt-8 inline-block rounded-full bg-accent px-5 py-2 text-sm font-medium text-on-accent">Open the app</a>
    </main>
  )
}

function LegalBody({ doc }: { doc: LegalDoc }) {
  return (
      <div className="space-y-3 pb-2 text-sm leading-relaxed text-neutral-700 [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-neutral-900">
        {doc === 'privacy' && (
          <>
            <p className="text-xs text-neutral-400">Last updated {UPDATED}</p>
            <p>Durata is built to keep your data on your phone unless you choose otherwise.</p>
            <h3>What stays on your phone</h3>
            <p>Your plans, workouts, goals, body weight, measurements and settings are stored in your browser on this device. Progress photos are stored only on this device and are never uploaded.</p>
            <h3>What’s sent to our server, and only if you turn it on</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li><b>Cloud backup:</b> a copy of your workout data (not photos) linked to your account, so you can restore it.</li>
              <li><b>Social features:</b> your handle, display name and avatar; friend connections and the permissions you choose; workouts, challenges, requests and emoji you send or receive; workouts you post for friends to cheer (the exercises and their top sets, distances and times, and any new personal bests); and, if you allow a friend to see it, a progress summary (recent exercises, weekly count, streak, recent personal bests). Body weight, measurements and goals are never shared.</li>
              <li><b>Email:</b> optional. Used only to sign you in with a code and to recover your account. It is never shown to other people.</li>
              <li><b>Reports:</b> if you report someone, the reason and any note you add, so the app’s owner can review it. The person you report isn’t told who reported them.</li>
            </ul>
            <h3>Bug reports and feedback</h3>
            <p>The app keeps a short list of recent errors on your phone. It only leaves your phone if you choose to send a bug report, which opens your own email app (or a GitHub issue) so you can see exactly what’s sent.</p>
            <h3>What we don’t do</h3>
            <p>No ads, no selling or renting data, no third-party analytics or trackers. Data is stored with our database provider (Supabase) only to run these features. Encrypted copies of the database are kept for up to 90 days to recover from mistakes.</p>
            <h3>Your choices</h3>
            <p>You can turn off backup or social features at any time in Settings, export your data to a file, erase everything on this device, and delete your account under Settings → Friends &amp; account (which deletes your backup and all social data on the server). See <a className="underline" href="#delete-account">Deleting your account</a>.</p>
            <h3>Children</h3>
            <p>Social features and accounts are only for people 13 and older.</p>
            <h3>Questions</h3>
            <p><a className="underline" href={feedbackLink('feedback')} target="_blank" rel="noreferrer">Contact us</a>, or open an issue at <a className="underline" href={REPO} target="_blank" rel="noreferrer">the project’s page</a>.</p>
          </>
        )}
        {doc === 'terms' && (
          <>
            <p className="text-xs text-neutral-400">Last updated {UPDATED}</p>
            <p>By using Durata you agree to these terms.</p>
            <h3>The app</h3>
            <p>The app is provided free and “as is”, without warranties. Features may change. Keep your own backups; we aren’t responsible for lost data.</p>
            <h3>Your account</h3>
            <p>You must be 13 or older to create an account or use social features. Keep your sign-in email secure. You’re responsible for what you send from your account.</p>
            <h3>Be decent</h3>
            <p>Don’t use the app to harass anyone, impersonate others, use offensive names or pictures, spam, or try to break or misuse the service. You can block or report anyone from their profile or friend request. Reports are reviewed, and we may remove accounts that break these rules.</p>
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
        {doc === 'delete' && (
          <>
            <p className="text-xs text-neutral-400">Last updated {UPDATED}</p>
            <h3>In the app</h3>
            <p>Open <b>Settings (the gear on Home) → Friends &amp; account → Delete my account</b> and confirm. It takes effect immediately.</p>
            <h3>Without the app</h3>
            <p>If you can’t open the app (for example, you lost your phone), <a className="underline" href={feedbackLink('feedback', 'Account deletion request')} target="_blank" rel="noreferrer">send a deletion request</a> with your handle and, if you added one, the email on the account. We’ll confirm and delete it within 30 days.</p>
            <h3>What’s deleted</h3>
            <p>Your handle, display name, avatar, email, friends and permissions, workouts and challenges you sent or received, workouts you posted, emoji, reports you made, progress summaries and your cloud backup. Encrypted database backups that already contain your data expire within 90 days.</p>
            <h3>What isn’t</h3>
            <p>Workouts saved on your phone stay there until you delete them (<b>Settings → Backup &amp; data → Erase all data</b>) or remove the app.</p>
          </>
        )}
      </div>
  )
}
