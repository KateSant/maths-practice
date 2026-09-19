import { levelProgress } from '../lib/format'

/**
 * The Minecraft-style experience bar: a level badge beside a green bar filling towards the
 * next level, with the numbers alongside so it reads as progress rather than decoration.
 *
 * Only rendered in the themed look, so the default theme is untouched. Built from the points
 * a student has already earned, so nothing new is stored for it. The level curve is a
 * placeholder - see POINTS_PER_LEVEL.
 */
export function XpBar({ points }: { points: number }) {
  const { level, intoLevel, needed, percent } = levelProgress(points)

  return (
    <div
      className="flex items-center gap-2"
      title={`${points} points · level ${level} · ${intoLevel} of ${needed} towards level ${level + 1}`}
    >
      <span
        className="font-display grid h-8 w-8 place-items-center rounded-xl bg-indigo-600 text-xs font-bold text-white"
        aria-hidden="true"
      >
        {level}
      </span>

      <div className="hidden sm:block">
        <div className="font-display flex items-baseline justify-between gap-2 text-[9px] text-slate-600">
          <span>XP</span>
          <span className="tabular-nums">
            {intoLevel}/{needed}
          </span>
        </div>
        <div className="mt-0.5 h-3.5 w-28 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-300">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <span className="sr-only">
        Level {level}, {intoLevel} of {needed} points towards the next level
      </span>
    </div>
  )
}
