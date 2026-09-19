/** Small presentation helpers, kept out of components so they can be unit tested. */

export function percent(value: number): string {
  return `${Math.round(value)}%`
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Colour banding used for accuracy figures, so good and bad results read at a glance. */
export function accuracyTone(accuracy: number): { text: string; bar: string; label: string } {
  if (accuracy >= 80) {
    return { text: 'text-emerald-600', bar: 'bg-emerald-500', label: 'Strong' }
  }
  if (accuracy >= 50) {
    return { text: 'text-amber-600', bar: 'bg-amber-500', label: 'Getting there' }
  }
  return { text: 'text-rose-600', bar: 'bg-rose-500', label: 'Needs practice' }
}

export function encouragement(accuracy: number, correct: number, total: number): string {
  if (total > 0 && correct === total) return 'Perfect score!'
  if (accuracy >= 80) return 'Excellent work.'
  if (accuracy >= 50) return 'Good effort — keep going.'
  if (correct === 0 && total > 0) return 'Tricky one. Have a look at the answers below.'
  return 'Every attempt helps. Review the answers below.'
}

export function difficultyLabel(difficulty: number): string {
  switch (difficulty) {
    case 1:
      return 'Easy'
    case 2:
      return 'Medium'
    case 3:
      return 'Challenging'
    default:
      return `Level ${difficulty}`
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
