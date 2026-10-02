# Turning on friends and cloud backup (Supabase)

Until this is done the app runs social and backup in **preview mode**: friends are simulated (Alex, Sam, Maya), the sign-in code is always `123456`, and "backups" stay in the browser. Setting up a free [Supabase](https://supabase.com) project makes both real. It takes about 20–30 minutes; a computer is easier than a phone.

## 1. Create the project
1. Sign up at supabase.com (signing in with GitHub is fine) and create a **New project** on the Free plan.
2. Name it (e.g. `ez-workout`), set a strong database password (save it in a password manager; the app never needs it) and pick the region closest to your users.
3. Wait a couple of minutes for it to finish setting up.

## 2. Create the database tables and rules
Run each file in `supabase/migrations/` **once, in order**, in the **SQL Editor** (New query → paste → Run):
1. `20260930000000_social.sql` (friends, sharing, challenges, emoji)
2. `20261001000000_sync.sql` (cloud backup)
3. `20261002000000_reports_ping.sql` (reporting people, and the keep-alive ping)

To copy a file: open it on GitHub, click **Raw**, select all, copy. Each should end with "Success. No rows returned". Running a file a second time fails with "already exists"; that's harmless if the first run succeeded.

## 3. Sign-in settings (Authentication)
- **Sign In / Providers → Email**: enabled (default). Keep "Confirm email" on. Email OTP length 6 (the app accepts 6–8 digits).
- **Allow anonymous sign-ins**: turn **on**. This is what lets people use friends and backup **without an email**.
- **Allow new users to sign up**: on (default).
- **Don't turn on CAPTCHA** yet: the app doesn't send CAPTCHA tokens, so every sign-in would fail. Supabase's built-in rate limits still apply.

## 4. Make emails contain a code, not a link
The app signs people in by typing a 6-digit code. Under **Authentication → Emails → Templates**, change these three templates so they show `{{ .Token }}` and **don't** include `{{ .ConfirmationURL }}`:
- **Magic Link** (returning users)
- **Confirm signup** (first-time users get this one)
- **Change Email Address** (adding an email later)

Example body:
```html
<h2>Your Durata code</h2>
<p>Type this code in the app:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>It expires in an hour. If you didn't ask for it, you can ignore this email.</p>
```

## 5. Email sending (needed before other people can use email)
Supabase's built-in email is for testing: it only delivers to members of your Supabase team and a handful per hour. That's enough to try it yourself. For everyone else, set up **custom SMTP** under **Authentication → Emails → SMTP Settings**:
- **With a domain you own:** [Resend](https://resend.com) (free tier ~3,000 emails/month) has a Supabase integration.
- **Without a domain:** a dedicated Gmail account (e.g. a new `...app@gmail.com`) with 2-Step Verification and an **App Password**: host `smtp.gmail.com`, port `587`, username = that Gmail address, password = the app password, sender = the same address. Gmail allows a few hundred emails a day.

People who choose **Continue without email** don't need any of this.

## 6. URL configuration
**Authentication → URL Configuration → Site URL**: `https://sonnydivita3-png.github.io/Workout-App/`

## 7. Connect the app
1. In Supabase, find the **Project URL** (`https://<something>.supabase.co`) and the **publishable key** (`sb_publishable_…`; the legacy `anon` key also works). They're under **Project Settings → API Keys** / **Data API**, or the **Connect** button. **Never** use the secret / `service_role` key.
2. In GitHub: repo **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_ANON_KEY` = the publishable key
   (Adding them as secrets instead also works.)
3. Re-run the deploy: **Actions → Deploy to GitHub Pages → Run workflow**, or push to `main`.

For local development, put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.

## 8. Optional extras (all free)
- **Feedback email:** add a repository **variable** `FEEDBACK_EMAIL` (e.g. the app's Gmail). "Send feedback", "Report a bug" and account-deletion requests then open an email to it; without it they open a GitHub issue. The address is visible in the app's code, so use a dedicated inbox.
- **Keep-alive:** nothing to set up once step 7 is done. `.github/workflows/keepalive.yml` pings the database every 3 days so the free project doesn't pause. GitHub turns off scheduled workflows after 60 days with no commits to the repo and emails you first; re-enable it under **Actions** if that happens.
- **Database backups:** add three repository **secrets** (Settings → Secrets and variables → Actions → Secrets):
  - `SUPABASE_DB_URL`: in Supabase, **Connect** → **Session pooler** connection string, pasted exactly as shown (leave `[YOUR-PASSWORD]` in it). The "Direct connection" doesn't work from GitHub.
  - `SUPABASE_DB_PASSWORD`: the database password on its own (Project Settings → Database; reset it there if you don't know it).
  - `BACKUP_PASSPHRASE`: a long random passphrase. Store it in your password manager; without it the backups can't be opened.

  `.github/workflows/db-backup.yml` then runs every Sunday (or on demand from **Actions**), saving an encrypted file for 90 days under the run's **Artifacts**. To restore: download it, `gpg -d db-backup-DATE.sql.gpg > dump.sql`, then load it into a project that has the migrations applied with `psql "<connection string>" -f dump.sql`.

## 9. Moderation
- **Reports:** Table Editor → `reports`. Each row has who reported (`from_id`), who was reported (`target_id`), a reason and an optional note. Look the person up in `profiles` by `id`.
- **Removing someone:** Authentication → Users → find the user by id → **Delete user**. Everything they had is deleted with them.
- Handles and display names go through a basic word filter in the app; reports and blocking cover the rest.

## 10. Check it
Open the app and close/reopen it once or twice so it picks up the new version. **Settings → Social** should no longer say "Preview mode". People who tried the preview get a note that friends and backup are live and are asked to set them up again; their workouts stay on the phone.

## Things to know
- **Free projects pause after about a week with no activity.** The keep-alive workflow (step 8) prevents that. If it happens anyway, the app can't reach the server until you press Restore in the Supabase dashboard.
- The anon/publishable key is public by design; all protection comes from the row-level security in the migrations (tested against a real Postgres in `npm test`).

## Privacy model (enforced in the database, not the UI)
- People are found by **exact handle only**. There is no list of users and email addresses are never in the public schema.
- Being friends shares **nothing**. Each person grants five permissions per friend, all off by default: see my progress (recent exercises, weekly count, streak, new personal bests), send me workouts, ask me for workouts, challenge me, send me emoji. The grant is chosen by the person accepting the request and can be changed any time.
- Messages are one of 12 emoji. There is no free text except a short optional note on a workout request and titles of things you share.
- Body weight, measurements, photos and goals are never shared. Avatars are an emoji, a letter, or a photo shrunk to about 96px (the database rejects anything larger or any non-image data).
- Friend-sent workouts are validated and clamped on the receiving device before anything touches the calendar, and a friend's custom exercises are imported under new ids so they can't overwrite your own.
- Cloud backup is one row per account that only its owner can read or write.
- People can report anyone from a friend request or a friend's page (optionally blocking them too). Reports can only be written, never read, through the API.
- Sending is rate limited, blocking removes the friendship, and deleting the account (**Settings → Friends & account**, shown to anyone signed in, even with social off) removes everything server-side, including the backup.
- Invite links (`…/Workout-App/?add=handle`) only carry a handle. Opening one offers to send that person a friend request, after sign-up if needed; nothing is shared until each side sets permissions.

## Limits
- There are no push notifications yet: new requests appear when the app is open (it checks about every 45 seconds).
- Challenge progress is computed on the accepter's device from their own logs, so a determined person could report false progress.
