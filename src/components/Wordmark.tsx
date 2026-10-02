/**
 * DURATA with the dotted D from the app icon standing in for the first letter. It's drawn in currentColor, so
 * it follows the accent colour and theme. Small sizes use the bolder four-dot D (as in the favicon, a bit heavier still) so the dots stay apart.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <p role="img" aria-label="Durata" className={`flex items-center font-bold uppercase tracking-[0.3em] ${className}`}>
      <svg viewBox="110 92 298 328" className="mr-[0.3em] h-[0.76em] w-auto shrink-0" aria-hidden="true">
        <path d="M196 130H244A126 126 0 0 1 244 382H196" fill="none" stroke="currentColor" strokeWidth="72" strokeLinecap="round" />
        <g fill="currentColor">
          <circle cx="144" cy="130" r="32" />
          <circle cx="144" cy="214" r="32" />
          <circle cx="144" cy="298" r="32" />
          <circle cx="144" cy="382" r="32" />
        </g>
      </svg>
      <span aria-hidden="true">urata</span>
    </p>
  )
}
