/** A donut showing accuracy. Pure SVG so there is no charting dependency. */
export function AccuracyRing({
  accuracy,
  size = 132,
  stroke = 12,
  caption = 'accuracy',
}: {
  accuracy: number
  size?: number
  stroke?: number
  caption?: string
}) {
  const clamped = Math.min(Math.max(accuracy, 0), 100)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (clamped / 100) * circumference

  const colour = clamped >= 80 ? 'stroke-emerald-500' : clamped >= 50 ? 'stroke-amber-500' : 'stroke-rose-500'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-slate-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className={`${colour} transition-all duration-700`}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-bold tabular-nums text-slate-900">{Math.round(clamped)}%</p>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{caption}</p>
      </div>
      <span className="sr-only">{Math.round(clamped)} percent accuracy</span>
    </div>
  )
}
