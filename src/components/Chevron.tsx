/** A chevron that's drawn, not a "‹" glyph (which renders tiny and thin in some fonts). */
export function Chevron({ left = false, className = 'h-5 w-5' }: { left?: boolean; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d={left ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}
