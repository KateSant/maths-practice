import { levelProgress } from '../lib/format'

/**
 * The Minecraft-style experience bar: a level number next to a green bar filling towards the
 * next level. Only rendered in the themed look, so the default theme is untouched.
 *
 * Uses the points a student has already earned, so nothing new is stored for it. The level
 * curve is a placeholder (see POINTS_PER_LEVEL).
 */
export function XpBar({ points }: { points: number }) {
  const { level, intoLevel, needed, percent } = levelProgress(points)

  return (
    <div
      className="flex items-center gap-2"
      title={`${points} points · level ${level} · ${intoLevel} of ${needed} towards level ${level + 1}`}
    >
      <span
        className="font-display grid h-7 min-w-7 place-items-center rounded-xl bg-indigo-600 px-1 text-xs font-bold text-white"
        aria-hidden="true"
      >
        {level}
      </span>
      <div className="hidden h-3 w-24 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-300 sm:block">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="sr-only">
        Level {level}, {intoLevel} of {needed} points towards the next level
      </span>
    </div>
  )
}
