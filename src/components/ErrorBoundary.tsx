import { Component, type ReactNode } from 'react'
import { feedbackLink, logError } from '../lib/feedback'

/** If a screen crashes, show a way out instead of a blank page. Saved workouts aren't touched. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    logError(error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-surface px-6">
        <p className="mb-3 text-5xl" aria-hidden>😵‍💫</p>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mb-6 text-neutral-600">Sorry about that. Your workouts are saved and safe. Reloading usually fixes it; if it keeps happening, please send a report so it can be fixed.</p>
        <button onClick={() => window.location.reload()} className="mb-2 w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">Reload</button>
        <a href={feedbackLink('bug', error.message)} target="_blank" rel="noreferrer" className="w-full rounded-2xl bg-neutral-100 py-3 text-center text-sm font-medium text-neutral-700">Send a bug report</a>
      </div>
    )
  }
}
