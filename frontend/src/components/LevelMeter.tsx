import { DIFFICULTY_BANDS, difficultyLabel, type BandTone } from '../lib/format'

/**
 * The band the student is working at in a topic: four pips and the word for the band.
 *
 * The pips are the point. A word alone ("Secure") is a label, but a filled run of four shows that
 * there is somewhere further to get to and roughly how far away it is, which is what makes progress
 * legible over weeks rather than just "this felt hard today".
 *
 * `tone` lets it borrow the accuracy colours, so on a topic card the meter and the percentage badge
 * beside it read as the same statement. It uses the pale end of each hue and keeps the band word
 * neutral: a band is a place you are working, not a telling-off, and five topics' worth of strong
 * red pips and red words makes a hard week look like a failure. The saturated colours stay on the
 * percentage, which is the thing that is actually a score.
 */
const PIP_TONE: Record<BandTone, string> = {
  rose: 'bg-rose-400',
  amber: 'bg-amber-400',
  emerald: 'bg-emerald-400',
  // Deeper green, so Mastery reads as further on than Secure rather than the same thing again.
  green: 'bg-green-600',
}

export function LevelMeter({
  level,
  tone,
  className = '',
}: {
  level: number
  tone?: BandTone
  className?: string
}) {
  const clamped = Math.min(Math.max(Math.round(level), 1), DIFFICULTY_BANDS.length)
  const filled = tone ? PIP_TONE[tone] : 'bg-indigo-400'

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      title={`Working at ${difficultyLabel(clamped)} (band ${clamped} of 4)`}
    >
      <div className="flex gap-0.5" aria-hidden="true">
        {DIFFICULTY_BANDS.map((step) => (
          <span
            key={step}
            className={`h-3.5 w-1.5 rounded-sm ${step <= clamped ? filled : 'bg-slate-200'}`}
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-slate-600">{difficultyLabel(clamped)}</span>
      <span className="sr-only">Working at band {clamped} of 4, {difficultyLabel(clamped)}</span>
    </div>
  )
}
