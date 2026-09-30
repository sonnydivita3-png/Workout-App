# Turning on social features and cloud backup

The app ships with social features in **preview mode**: friends are simulated on the device (Alex, Sam and Maya) so you can try everything. To connect real people you need a free [Supabase](https://supabase.com) project. This takes about 10 minutes.

## 1. Create the project
1. Create a new Supabase project (free tier is fine).
2. **SQL editor** → run each file in `supabase/migrations/` in order (paste the contents → Run): `20260930000000_social.sql` (friends and sharing), then `20261001000000_sync.sql` (cloud backup).
3. **Authentication → Providers → Email**: enable it. Turn **Confirm email** on and make sure the email template contains the `{{ .Token }}` (6-digit code) rather than only a link. The app signs people in with the code; there are no passwords.
4. **Authentication → Sign In / Providers → Allow anonymous sign-ins**: turn this on. It lets people use social **without an email** (their account then lives on their phone). Also set the "Change email" template to include `{{ .Token }}` so people can add an email later. Consider enabling CAPTCHA (Authentication → Attack Protection), since anonymous sign-ups are easier to abuse.
5. **Authentication → URL configuration**: set the Site URL to your app URL.

## 2. Point the app at it
In the GitHub repo: **Settings → Secrets and variables → Actions → Variables**, add:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Project URL (Settings → API) |
| `SUPABASE_ANON_KEY` | the `anon` public key (Settings → API) |

Push to `main` (or re-run the deploy workflow). The anon key is meant to be public; all protection comes from row-level security in the migration. **Never** put the `service_role` key in the app or in these variables.

For local development, put the same two values in `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Email is optional
At sign-up people can continue without an email. Their account is then tied to that phone's browser storage: clearing the app or changing phones loses it, and the app warns about this. In Settings they can add an email at any time (a code is sent to confirm), after which they can sign in anywhere. Turning social off keeps them signed in; signing out of an email-less account asks for confirmation.

## Privacy model (enforced in the database, not the UI)
- People are found by **exact handle only**. There is no list of users and email addresses are never in the public schema.
- Being friends shares **nothing**. Each person grants five permissions per friend, all off by default: see my progress, send me workouts, ask me for workouts, challenge me, send me emoji. The grant is chosen by the person accepting the request and can be changed any time.
- Messages are one of 12 emoji. There is no free text except a short optional note on a workout request and titles of things you share.
- Body weight and goals are never shared. Avatars are an emoji, a letter, or a photo shrunk to about 96px (the database rejects anything larger or any non-image data).
- Friend-sent workouts are validated and clamped on the receiving device before anything touches the calendar, and a friend's custom exercises are imported under new ids so they can't overwrite your own.
- Sending is rate limited, blocking removes the friendship, and "Delete my social account" removes everything server-side.

## Limits
- There are no push notifications: new requests appear when the app is open (it checks about every 45 seconds).
- Challenge progress is computed on the accepter's device from their own logs and reported to the server, so a determined person could report false progress. It's a friendly-competition feature, not a verified one.
- The database rules are tested against a real Postgres (`npm test`), but the app's Supabase client has not been exercised against a live project in this repo's CI.
