import { EMOJI, type Emoji } from '../../social/types'

/** The whole vocabulary: twelve emoji, no text. */
export function EmojiBar({ onPick, disabled, selected }: { onPick: (e: Emoji) => void; disabled?: boolean; selected?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {EMOJI.map((e) => (
        <button
          key={e}
          disabled={disabled}
          onClick={() => onPick(e)}
          aria-label={`Send ${e}`}
          className={`h-10 w-10 rounded-full text-xl transition ${selected === e ? 'bg-accent' : 'bg-neutral-100 hover:bg-neutral-200'} disabled:opacity-30`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
