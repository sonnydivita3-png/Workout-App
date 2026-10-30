import { demoFrames } from '../lib/moveDemos'

/**
 * A move's start and end positions, fading from one to the other on a loop like a GIF. With reduced motion it holds
 * the start position.
 */
export function MoveDemo({ id, name, className = '' }: { id: string; name: string; className?: string }) {
  const [start, end] = demoFrames(id)
  return (
    <div role="img" aria-label={`How to do ${name}`} className={`relative aspect-[3/2] overflow-hidden bg-neutral-100 ${className}`}>
      <img src={start} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <img src={end} alt="" draggable={false} className="move-demo-end absolute inset-0 h-full w-full object-cover" />
    </div>
  )
}
