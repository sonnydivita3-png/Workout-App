import { Sheet } from './Sheet'
import { feedbackLink } from '../lib/feedback'

import { HEALTH_FLAGS, HOME_COUNTY, HOME_STATE, LEGAL_TITLES, OPERATOR, STOP_SIGNS, TERMS_UPDATED as UPDATED, type LegalDoc } from '../lib/legal'

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
            <p>Your plans, workouts, goals, body weight, measurements and settings are stored in your browser on this device, along with the profile details used to estimate calories (sex, birth year and height). Progress photos are stored only on this device and are never uploaded.</p>
            <h3>What’s sent to our server, and only if you turn it on</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li><b>Cloud backup:</b> a copy of your workout data and profile details (not photos) linked to your account, so you can restore it.</li>
              <li><b>Social features:</b> your handle, display name and avatar; friend connections and the permissions you choose; workouts, challenges, requests and emoji you send or receive; and, if you allow a friend to see it, a progress summary (recent exercises, weekly count, streak, recent personal bests). Body weight, measurements and goals are never shared.</li>
              <li><b>Email:</b> optional. Used only to sign you in with a code and to recover your account. It is never shown to other people.</li>
              <li><b>Reports:</b> if you report someone, the reason and any note you add, so the app’s owner can review it. The person you report isn’t told who reported them. A report is kept for review even if the reported account is deleted (without a link to it); reports you made are deleted with your account.</li>
            </ul>
            <h3>Bug reports and feedback</h3>
            <p>The app keeps a short list of recent errors on your phone. It only leaves your phone if you choose to send a bug report, which opens your own email app (or a GitHub issue) so you can see exactly what’s sent.</p>
            <h3>What we don’t do</h3>
            <p>No ads, no selling or renting data, no third-party analytics or trackers. Data is stored with our database provider (Supabase) only to run these features. Encrypted copies of the database are kept for up to 90 days to recover from mistakes.</p>
            <h3>Your choices</h3>
            <p>You can turn off backup or social features at any time in Settings, export your data to a file, erase everything on this device, and delete your account under Settings → Friends &amp; account (which deletes your backup and all social data on the server). See <a className="underline" href="#delete-account">Deleting your account</a>.</p>
            <h3>Your agreement</h3>
            <p>The app keeps the date you agreed to the terms and which version you agreed to, on this device and in your backup.</p>
            <h3>Children</h3>
            <p>Social features and accounts are only for people 13 and older.</p>
            <h3>Questions</h3>
            <p><a className="underline" href={feedbackLink('feedback')} target="_blank" rel="noreferrer">Contact us</a>, or open an issue at <a className="underline" href={REPO} target="_blank" rel="noreferrer">the project’s page</a>.</p>
          </>
        )}
        {doc === 'terms' && <Terms />}
        {doc === 'health' && (
          <>
            <p className="text-xs text-neutral-400">Last updated {UPDATED}</p>
            <p>Exercise carries risk. The workouts, training plans, paces and calorie estimates in this app are general guidance based on common training principles. They don’t know your health, injuries or limits, and the app never picks your working weights: choose a weight you can lift with good form.</p>
            <h3>Talk to a doctor first if</h3>
            <ul className="list-disc space-y-1 pl-5">{HEALTH_FLAGS.map((f) => <li key={f}>{f}</li>)}</ul>
            <p>Check again with your doctor if your health changes, and before a big step up (like a first marathon) if you haven’t trained that hard before.</p>
            <h3>While you exercise</h3>
            <p>{STOP_SIGNS}</p>
            <p>Warm up, use good form, and adjust weights, distances and speeds to how you feel on the day. Use a spotter or safety bars for heavy lifts. Outdoors, watch for traffic, terrain and weather, and don’t look at the app while running, cycling or driving.</p>
            <p>Calorie numbers are estimates and can be off by a lot. Don’t use them for medical or diet decisions without a professional.</p>
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
            <p>Your handle, display name, avatar, email, friends and permissions, workouts and challenges you sent or received, emoji, reports you made, progress summaries and your cloud backup. Encrypted database backups that already contain your data expire within 90 days.</p>
            <h3>What isn’t</h3>
            <p>Workouts saved on your phone stay there until you delete them (<b>Settings → Backup &amp; data → Erase all data</b>) or remove the app.</p>
          </>
        )}
      </div>
  )
}

const caps = 'font-semibold uppercase'

/** Terms of use: plain language, with the parts that limit your rights set apart and numbered (the agreement screen points to them). */
function Terms() {
  const contact = <a className="underline" href={feedbackLink('feedback')} target="_blank" rel="noreferrer">contact us</a>
  return (
    <>
      <p className="text-xs text-neutral-400">Last updated {UPDATED}</p>
      <p>These terms are an agreement between you and {OPERATOR} (“we”, “us”) about the Durata app and website. Please read all of them, especially <b>section 5 (Assumption of risk)</b>, <b>section 6 (Release of claims)</b>, <b>section 10 (Limits on our liability)</b> and <b>section 13 (Disputes: individual arbitration, no class actions, no jury)</b>, which limit your rights.</p>

      <h3>1. Who we are</h3>
      <p>Durata is run by its owner. If a company (such as a limited liability company) is formed to run the app, it takes over these terms, and “Durata”, “we” and “us” mean that company. The “Durata parties” are Durata and its owners, members, managers, officers, employees, contractors, successors and assigns.</p>

      <h3>2. Agreeing to these terms</h3>
      <p>You agree to these terms by tapping Agree in the app, or by using the app or website. If you don’t agree, don’t use them. You must be at least 13. If you’re under 18, your parent or guardian must read and agree to these terms, for themselves and for you.</p>
      <p>We may change these terms. When a change matters, the app asks you to agree again before you keep using it; you can stop using it instead. The privacy policy and health notice are part of these terms.</p>

      <h3>3. Not medical advice</h3>
      <p>Durata gives general fitness information: workouts, training plans, paces, effort and heart-rate guides, calorie estimates and notes. It isn’t medical, nutrition or physical-therapy advice, and it doesn’t replace a doctor, dietitian, physical therapist or coach who knows you. Using the app doesn’t create a doctor–patient, trainer–client or other professional relationship. The app doesn’t know your health, fitness, injuries or surroundings, doesn’t see your form, and never chooses the weight you lift. Calorie numbers are estimates and can be far off.</p>

      <h3>4. Your health and safety are your responsibility</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Check with a doctor before starting, and when your health changes (see the health notice for when it matters most).</li>
        <li>Choose weights, distances, speeds and inclines you can handle with good form. Scale anything in the app down, or skip it, if it’s too much for you.</li>
        <li>Warm up. Use a spotter or safety bars for heavy lifts. Use equipment as its maker intends, and check it’s in good condition.</li>
        <li>Outdoors, watch for traffic, terrain, weather, heat and cold, and follow the law. Don’t look at the app while running, cycling or driving.</li>
        <li>{STOP_SIGNS}</li>
      </ul>

      <h3>5. Assumption of risk</h3>
      <p className={caps}>Exercise has inherent risks, including strength training, running, cycling, rowing, swimming, high-intensity intervals and the other activities in the app. They include muscle strains and tears, sprains, joint and back injuries, broken bones, injuries from equipment or falls, overuse injuries, heat illness, dehydration, heart attack, stroke and, rarely, death. Some can happen even when you do everything right. You choose whether, when, where and how hard to exercise, and you knowingly and voluntarily accept these risks.</p>

      <h3>6. Release of claims, including for our negligence</h3>
      <p className={caps}>To the fullest extent the law allows, you release the Durata parties from, and agree not to sue them over, any claim for injury, illness, death or property damage arising from exercise or physical activity you do while using the app or because of something in it (such as a workout, plan, pace, calorie estimate, reminder or note), including claims based on the ordinary negligence of the Durata parties, such as a mistake in a workout, plan or estimate.</p>
      <p>This release doesn’t cover gross negligence, recklessness or intentional misconduct, or anything else the law doesn’t allow to be released. It binds you and anyone claiming through you, such as your heirs or estate. You’ve had the chance to read it before agreeing, and you’re free not to use the app if you don’t accept it.</p>

      <h3>7. Your account and how you use the app</h3>
      <p>You need to be 13 or older to create an account or use social features. Keep your sign-in email secure; you’re responsible for what’s sent from your account. Don’t use the app to harass anyone, impersonate others, use offensive names or pictures, spam, or try to break, overload or misuse the service. You can block or report anyone from their profile or friend request. We review reports and may remove content or accounts that break these rules.</p>

      <h3>8. Your data and content</h3>
      <p>Your workouts stay yours. When you send something to friends or turn on cloud backup, you let us store and deliver it only to run those features, as the privacy policy describes. Keep your own backups (Settings → Backup &amp; data): we aren’t responsible for lost data.</p>

      <h3>9. No warranties</h3>
      <p className={caps}>The app is provided “as is” and “as available”, free of charge. To the fullest extent the law allows, the Durata parties disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, accuracy and non-infringement. We don’t promise the app will be error-free or always available, or that its workouts, plans or estimates are right or safe for you. Features may change or end.</p>

      <h3>10. Limits on our liability</h3>
      <p className={caps}>To the fullest extent the law allows, the Durata parties aren’t liable for indirect, incidental, special, consequential or punitive damages, or for lost data, profits or goodwill, and their total liability for all claims about the app or these terms is limited to the greater of $50 or what you paid us in the 12 months before the claim. These limits apply whatever the legal theory, and even if we knew the damage was possible. They don’t limit liability the law doesn’t allow to be limited.</p>

      <h3>11. Your responsibility to us</h3>
      <p>You’ll defend and compensate the Durata parties for claims by other people, and the costs that come with them (including reasonable lawyers’ fees), that arise from your breaking these terms, from what you send through the app, or from your misuse of it.</p>

      <h3>12. Our app</h3>
      <p>The app, its design, code and content belong to Durata and its licensors. Its source code is public so people can see how it works, not licensed for reuse. We give you a personal, non-exclusive, non-transferable license, which we can revoke, to use the app for your own fitness tracking. Don’t copy, resell or misuse it.</p>

      <h3>13. Disputes: individual arbitration, no class actions, no jury</h3>
      <p>If you have a problem, {contact} first: we’ll try to resolve it informally within 60 days, and we’ll do the same for you.</p>
      <p className={caps}>If that doesn’t work, you and we agree that any dispute about the app or these terms will be decided by binding individual arbitration, not in court, except that either of us can bring an individual claim in small-claims court. Claims may only be brought individually, not as a plaintiff or class member in any class, collective or representative proceeding, and the arbitrator can’t combine more than one person’s claims. You and we give up the right to a jury trial.</p>
      <p>The arbitration will be run by the American Arbitration Association under its Consumer Arbitration Rules, and the Federal Arbitration Act applies to this section. Hearings can be by video or phone, or in the county where you live. You can opt out of arbitration within 30 days of first agreeing to these terms by sending us a message saying so, with your handle or email if you have one. If the no-class-action part is found unenforceable for a claim, that claim goes to court instead of arbitration.</p>

      <h3>14. Governing law and time limit</h3>
      <p>{HOME_STATE} law governs these terms, without regard to conflict-of-law rules. Any case allowed in court will be heard in the state or federal courts for {HOME_COUNTY}, {HOME_STATE}, and both of us agree to those courts’ jurisdiction. To the extent the law allows, a claim must be brought within one year after it arises.</p>

      <h3>15. App stores</h3>
      <p>The app store you got the app from has its own terms, which also apply. If you got it from Apple: these terms are between you and us, not Apple; Apple isn’t responsible for the app or its content and has no duty to maintain or support it; Apple isn’t responsible for any claims about the app (including product liability, legal or regulatory compliance, consumer protection and intellectual property claims); if the app fails to meet a warranty that applies, you can tell Apple and it will refund any price you paid, and Apple has no other warranty obligation. You confirm you aren’t in a country under a U.S. government embargo or on a U.S. government list of restricted parties. Apple and its subsidiaries are third-party beneficiaries of these terms and can enforce them against you.</p>

      <h3>16. Ending</h3>
      <p>You can stop using the app and delete your account at any time. We may suspend or end your access if you break these terms. Sections 3, 5, 6 and 8 to 17 continue after that.</p>

      <h3>17. The rest</h3>
      <p>These terms, the privacy policy and the health notice are the whole agreement between us about the app. If part of them can’t be enforced, it’s limited as little as needed and the rest stays in effect. Not enforcing a part isn’t giving it up. We may transfer these terms, for example to a company formed to run the app or one that takes it over; you can’t transfer them. Headings are for convenience.</p>

      <h3>Contact</h3>
      <p>Questions about these terms: {contact}, or open an issue at <a className="underline" href={REPO} target="_blank" rel="noreferrer">the project’s page</a>.</p>
    </>
  )
}
