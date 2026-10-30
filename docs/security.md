# Security and privacy

How Durata protects people's data, what was checked in the pre-release audit (October 2026), and the settings only
the project owner can change.

## How the data is protected

**On the phone**
- Workouts, plans, body weight, measurements and profile details (sex, birth year, height) are stored in the app's
  own storage on the device. Progress photos never leave the device.
- A strict Content Security Policy (built into `index.html` at build time, see `vite.config.ts`) lets the app run only
  its own scripts, and talk only to itself and its Supabase project. No inline scripts, no third-party scripts,
  trackers, ads or analytics. Every end-to-end test fails if the policy blocks anything, so it can't silently break.
- No `eval`, `innerHTML` or `dangerouslySetInnerHTML`: everything people type, and everything friends send, is shown
  as text.
- Restoring a backup file checks every field (numbers, dates, types) and never copies `__proto__`/`constructor` keys.
  Workouts friends send are checked the same way (sizes, ranges, counts), and their custom exercises get fresh ids so
  they can never overwrite yours.

**On the server (Supabase, only if someone turns on friends or cloud backup)**
- Sign-in is a one-time email code (no passwords to leak), or anonymous with no email at all.
- The app contains only Supabase's public "anon" key. The secret service-role key is never in the app, the repo or
  the build.
- Row-level security on every table, tested against a real Postgres in `src/social/sql.test.ts`:
  - Cloud backups: only their owner can read or write them.
  - People can be found only by their exact handle; there's no browsing or searching.
  - Being friends shares nothing until the person asked grants each permission (progress, workouts, requests,
    challenges, emoji).
  - Anonymous visitors can read nothing and call nothing (except a keep-alive ping that reads nothing).
  - Reports can be made but never read through the app; the owner reviews them in the dashboard. A report stays
    after the reported account is deleted.
- Rate limits on friend requests, shares, requests, challenges, emoji and reports.
- Deleting an account deletes its backup and all its social data. Encrypted database backups are kept up to 90 days
  (see the privacy policy).
- Data is encrypted in transit (HTTPS) and at rest (Supabase).

**In the repo**
- CI and deploy never use secrets beyond the public anon key. Weekly database backups are encrypted (AES-256) before
  they're uploaded, because the repo is public.
- Dependabot opens PRs for dependency updates (`.github/dependabot.yml`). The shipped app has no known vulnerable
  dependencies (`npm audit --omit=dev`); a few low-severity findings remain in build-only tools.

## Audit, October 2026: what changed
- Content Security Policy and referrer policy added; the one inline script moved to `public/theme.js`.
- Backup restore hardened (number checks, prototype-pollution guard, weigh-ins kept in date order).
- Reports are no longer deleted when the reported account is (`20261030000000_keep_reports.sql`).
- Build-time dependencies updated (`npm audit fix`).
- Privacy policy names the profile details used for calorie estimates; the health notice no longer mentions the
  removed weight suggestions.

## Owner checklist (things only you can do)
These matter before a public release, roughly in order.

1. **Give the app its own domain** (e.g. `durata.app`), on GitHub Pages or any static host. Right now it lives on
   `sonnydivita3-png.github.io`, which every GitHub Pages site on your account shares: another repo you publish there
   could read this app's stored data and sign-in session. A custom domain gives the app an origin of its own. Then
   update the privacy/delete-account URLs in `docs/app-stores.md` and Supabase's **Site URL**.
2. **Turn on two-factor sign-in** for your GitHub and Supabase accounts. Whoever controls those controls the app and
   everyone's data.
3. **Run the new migration** (`20261030000000_keep_reports.sql`) in the Supabase SQL Editor.
4. **Supabase → Authentication:**
   - Keep the email code expiry short (Settings → Email OTP expiration: 600–3600 seconds).
   - Review **Rate Limits** (sign-ins and sign-ups per hour) so they suit your expected users.
   - Turn on **CAPTCHA** once the app supports it (it doesn't send CAPTCHA tokens yet; until then, leave it off or
     every sign-in fails). Worth adding if anonymous sign-ups get abused.
   - Use a custom SMTP sender on your own domain (social-setup.md, step 5).
5. **GitHub → Settings:**
   - Branches: protect `main` (require the CI check, no force pushes).
   - Code security: turn on **secret scanning** and **push protection**, and **Dependabot alerts**.
6. **Keep the database password, `BACKUP_PASSPHRASE` and service-role key** in a password manager, never in the repo,
   chat or the app. Rotate the database password if it was ever shared.
7. **Check reports** in the Supabase dashboard (Table Editor → reports) at least weekly; Apple expects reports to be
   acted on (guideline 1.2).

## Reporting a vulnerability
See `SECURITY.md` at the root of the repo.
