/** Small presentation helpers, kept out of components so they can be unit tested. */

export function percent(value: number): string {
  return `${Math.round(value)}%`
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Colour banding used for accuracy figures, so good and bad results read at a glance. */
/** The colours a student's progress is shown in: their accuracy, and the band they work at. */
export type ProgressTone = 'emerald' | 'amber' | 'rose'

/** Four bands, four colours: the scale the level meter and the topic badge share. */
export type BandTone = 'rose' | 'amber' | 'emerald' | 'green'

/**
 * The colour for the band a student is working at: red, yellow, green, deeper green.
 *
 * Taken from the band rather than from the accuracy printed beside it. A band comes from recent
 * form (Secure from 60%) while the percentage is an all-time figure, and the two disagree often
 * enough that colouring one by the other's rule would put green next to "Developing".
 */
export function bandTone(level: number): BandTone {
  if (level >= 4) return 'green'
  if (level === 3) return 'emerald'
  if (level === 2) return 'amber'
  return 'rose'
}

/**
 * The one place the accuracy thresholds live, so the percentage badge and the results ring cannot
 * disagree about what "80%" looks like.
 */
export function accuracyToneName(accuracy: number): ProgressTone {
  if (accuracy >= 80) return 'emerald'
  if (accuracy >= 50) return 'amber'
  return 'rose'
}

const PROGRESS_TONES: Record<ProgressTone, { text: string; bar: string; label: string }> = {
  emerald: { text: 'text-emerald-600', bar: 'bg-emerald-500', label: 'Strong' },
  amber: { text: 'text-amber-600', bar: 'bg-amber-500', label: 'Getting there' },
  rose: { text: 'text-rose-600', bar: 'bg-rose-500', label: 'Needs practice' },
}

export function accuracyTone(accuracy: number): { text: string; bar: string; label: string } {
  return PROGRESS_TONES[accuracyToneName(accuracy)]
}

/**
 * A short line for a set that went well, and nothing at all for one that did not.
 *
 * A student who has just had a hard time does not need to be told about it - the score, the ring
 * and the review already say everything, and a sympathetic sentence next to a low score reads as
 * pity. Empty lets the caller show its own wording instead.
 */
export function encouragement(accuracy: number, correct: number, total: number): string {
  if (total > 0 && correct === total) return 'Perfect score!'
  if (accuracy >= 80) return 'Excellent work.'
  if (accuracy >= 50) return 'Good effort — keep going.'
  return ''
}

/**
 * The bands a question can sit in, in order. The schema allows a fifth; the app deals in four, and
 * naming them once here keeps the meter, the editor and the list filter from drifting apart.
 */
export const DIFFICULTY_BANDS = [1, 2, 3, 4] as const

/**
 * The band a question sits in, in the words a school would use rather than easy/medium/hard.
 * These four words are the only place the vocabulary lives; the API sends numbers.
 */
export function difficultyLabel(difficulty: number): string {
  switch (difficulty) {
    case 1:
      return 'Emerging'
    case 2:
      return 'Developing'
    case 3:
      return 'Secure'
    case 4:
      return 'Mastery'
    default:
      return `Band ${difficulty}`
  }
}

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Turns elapsed milliseconds into a compact "12.4s" / "1m 05s" label. */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
