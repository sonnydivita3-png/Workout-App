# Publishing to the App Store and Google Play

The app is a web app (PWA). To list it in the stores it gets wrapped in a native shell with
[Capacitor](https://capacitorjs.com), which loads the same built files inside a native app. This is the checklist for
when you're ready; nothing here has to happen before then.

## Already in place
- **Account deletion inside the app** (Settings → Friends & account), required by both stores.
- **Public web pages** the store listings ask for (replace the domain if you move off GitHub Pages):
  - Privacy policy: `https://sonnydivita3-png.github.io/Workout-App/#privacy`
  - Account deletion (Google Play's "delete account URL"): `https://sonnydivita3-png.github.io/Workout-App/#delete-account`
  - Terms: `…/#terms`
- **User-generated content rules** (Apple guideline 1.2): a filter for offensive names, report and block from a
  friend request or a friend's page, a published way to contact you, and a way for you to act on reports (Supabase
  dashboard, see social-setup.md → Moderation).
- **Age gate:** accounts and social features are 13+.
- **No tracking or ads**, which keeps Apple's privacy label and Google's data safety form short.
- **Health check, assumption of risk, release and terms** agreed to before first use (see legal-review.md: have a
  lawyer review them before release).

## Release plan, in order
Each step is small enough to do (and check) on its own.

1. **Security checklist** in [security.md](security.md): two-factor sign-in on GitHub and Supabase, run the latest
   migration, Supabase auth settings, protect `main`.
2. **Own domain** (e.g. `durata.app`, about $15/year): the app moves off the shared `github.io` origin, and the
   privacy, terms and delete-account links below become permanent. Store listings can't easily change these later.
3. **Email from that domain** (custom SMTP, social-setup.md step 5), so sign-in codes don't come from Gmail.
4. **Developer accounts:** Apple ($99/year) and Google Play ($25 once). Both verify your identity, which can take a
   few days. A new *personal* Play account must run a closed test with at least 12 testers for 14 days in a row
   before it can publish, so line up testers early.
5. **Wrap with Capacitor** (Steps 1–3 below) and test on real phones.
6. **Store paperwork** (Steps 4–6 below), then submit: Play closed test first, then TestFlight, then both stores.

## Costs
- Apple Developer Program: **$99/year**. Google Play Console: **$25 once**.
- A Mac with Xcode is needed to build and upload the iOS app (a cloud Mac service works too).

## Steps (roughly a weekend of work, most of it store paperwork)
1. **Wrap the app:** add Capacitor to the project (`@capacitor/core`, `@capacitor/ios`, `@capacitor/android`), build with
   `BASE_PATH=./`, and point Capacitor at `dist/`. The service worker isn't needed inside the native app.
2. **Things that change inside a native shell** (worth a test pass on each platform):
   - Sharing and the invite link: use `@capacitor/share`; invite links should open the store listing or the web
     app. Universal links / app links can come later.
   - Rest-timer and reminder notifications: switch to `@capacitor/local-notifications` so they fire when the app is
     in the background.
   - Progress photos: `@capacitor/camera` gives a better picker than the web file input.
   - Workouts are still stored on the phone; native apps don't have Safari's 7-day clean-up, which is a plus. iOS can
     still clear a web view's storage when the phone is very low on space, so move the saved data (and the sign-in
     session) to `@capacitor/preferences` or secure storage, and keep reminding people about cloud backup.
3. **Icons and splash screens:** generate from `public/pwa-512.png` with `@capacitor/assets`.
4. **Store listings:** name, subtitle, description, keywords, category (Health & Fitness), support URL, privacy URL,
   screenshots (6.7" and 5.5" iPhone; phone and 7" tablet for Play), and an age rating questionnaire.
5. **Privacy forms** (only data that leaves the phone counts as "collected"; everything is optional, linked to the
   account, and never used for tracking or ads):
   - Apple privacy label: Contact info → email (sign-in); Health & Fitness → fitness (workouts, body weight and
     profile in cloud backup); User content → other (shared workouts, handle, display name); Identifiers → user id.
     Progress photos never leave the device, so they aren't listed.
   - Google data safety: the same data (personal info → email, name; health and fitness → fitness info; app
     activity → other user-generated content); encrypted in transit; users can delete their data (link above).
   - Google Play also asks for the **Health apps declaration** (App content page): a fitness tracker, not a medical
     app, and no Health Connect access.
6. **Review notes for Apple:** give a test account (a handle with an email you control) and explain that social
   features are optional and friends are found by exact handle only.
7. **Before submitting:** move sign-in emails to a sender on your own domain (e.g. Resend) instead of Gmail, and have
   the privacy policy and terms reviewed by a lawyer (questions in legal-review.md). Apple: under App Information →
   License Agreement, keep Apple's standard EULA; the app's own terms (§15) add Apple's required terms.

## Worth knowing
- Apple sometimes rejects apps that are "just a website". This app works offline, stores data on the device and has
  native-feeling features, which is usually enough, especially once notifications are native.
- Updates to the web code still need a new store build to reach store users (or a live-update service).
