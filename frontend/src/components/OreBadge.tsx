import { oreTier } from '../lib/format'

/**
 * Shows a question's difficulty as an ore, in the Minecraft-style theme only.
 *
 * The ore colour is a swatch beside the name rather than the colour of the text, so the
 * label stays legible whatever palette is in use - the same reason the quiz marks answers
 * with a tick or cross as well as a colour.
 */
export function OreBadge({ difficulty }: { difficulty: number }) {
  const { name, swatch } = oreTier(difficulty)

  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/20"
        style={{ backgroundColor: swatch }}
        aria-hidden="true"
      />
      {name}
    </span>
  )
}
