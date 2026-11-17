# Security

Durata is a personal training tracker. Everything it stores (the plan, the log, weigh-ins) stays in the browser's
storage on the device; it has no accounts, server or analytics, and a Content Security Policy (set in
`vite.config.ts`) lets it load only its own files and talk to nothing else. Plan and backup files are fully checked
before anything is loaded from them (`src/lib/plan.ts`, `src/lib/backup.ts`).

To report a problem, use GitHub's **Report a vulnerability** button on the repository's **Security** tab.
