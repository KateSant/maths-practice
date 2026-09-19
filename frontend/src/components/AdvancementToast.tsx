import { useEffect } from 'react'

/**
 * The reward popup from the game: a dark panel sliding in with "Advancement Made!" and the
 * name of what was earned.
 *
 * Shown only in the themed look. It is presentational and non-blocking - pointer-events are
 * off and it sits above the content - so it cannot get in the way of answering the next
 * question, and it announces itself with role="status" for screen readers rather than
 * stealing focus.
 */
export function AdvancementToast({
  name,
  detail,
  onDismiss,
  durationMs = 3200,
}: {
  name: string
  detail: string
  onDismiss: () => void
  durationMs?: number
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(timer)
  }, [name, onDismiss, durationMs])

  return (
    <div
      role="status"
      className="animate-rise pointer-events-none fixed right-4 top-20 z-50 max-w-xs"
    >
      <div className="rounded-2xl bg-slate-800 px-4 py-3 text-white shadow-lg ring-2 ring-slate-900">
        <p className="font-display text-[10px] font-bold uppercase tracking-wide text-amber-300">
          Advancement Made!
        </p>
        <p className="mt-1 text-sm font-semibold">{name}</p>
        <p className="mt-0.5 text-xs opacity-80">{detail}</p>
      </div>
    </div>
  )
}
