import { Component, type ReactNode } from 'react'

/** If a screen crashes, show a way out instead of a blank page. The log isn't touched. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mb-2 text-neutral-600">Your log is saved. Reloading usually fixes it.</p>
        <p className="mb-6 break-words text-xs text-neutral-500">{error.message}</p>
        <button onClick={() => window.location.reload()} className="w-full rounded-2xl bg-accent py-3 text-sm font-medium text-on-accent">Reload</button>
      </div>
    )
  }
}
