/**
 * No tracking service: the last few errors are kept on the phone and only leave it if the person chooses to send a
 * bug report, which opens their own email app with the details filled in.
 */
const KEY = 'ez-error-log'
const MAX = 8

export interface LoggedError { at: string; message: string; stack?: string }

export function recentErrors(): LoggedError[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LoggedError[] } catch { return [] }
}

export function logError(e: unknown) {
  const err = e instanceof Error ? e : new Error(String(e))
  const entry: LoggedError = { at: new Date().toISOString(), message: err.message.slice(0, 300), stack: err.stack?.split('\n').slice(0, 6).join('\n').slice(0, 800) }
  try { localStorage.setItem(KEY, JSON.stringify([...recentErrors(), entry].slice(-MAX))) } catch { /* storage full or blocked */ }
}

export function installErrorLog() {
  window.addEventListener('error', (e) => logError(e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => logError(e.reason))
}

export const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined)?.slice(0, 7) || 'dev'
const FEEDBACK_EMAIL = import.meta.env.VITE_FEEDBACK_EMAIL as string | undefined
const ISSUES_URL = 'https://github.com/sonnydivita3-png/Workout-App/issues/new'

/** A link that opens a pre-filled email (or, without a feedback address, a GitHub issue). */
export function feedbackLink(kind: 'feedback' | 'bug', extra?: string): string {
  const errors = kind === 'bug' ? recentErrors().slice(-3) : []
  const lines = [
    kind === 'bug' ? 'What were you doing when it went wrong?\n\n\n' : 'Your feedback:\n\n\n',
    '---',
    `App version: ${APP_VERSION}`,
    `Device: ${navigator.userAgent}`,
    ...(extra ? [`Error: ${extra}`] : []),
    ...errors.map((e) => `${e.at} ${e.message}${e.stack ? `\n${e.stack}` : ''}`),
  ]
  const subject = kind === 'bug' ? 'EZ Workout Tracker bug report' : 'EZ Workout Tracker feedback'
  const body = lines.join('\n').slice(0, 1800)
  return FEEDBACK_EMAIL
    ? `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : `${ISSUES_URL}?title=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
