import type { ReactNode } from 'react'
import { Card } from './ui'

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted'

export interface QuestionOption {
  id: number
  label: string
  text: string
}

/**
 * The prompt and its options, exactly as a student sees them.
 *
 * This exists so the admin editor's preview and the quiz itself render through the *same*
 * component. A preview assembled from its own markup drifts the first time either side is
 * restyled, and the whole value of a preview is that it tells the truth. It also means the theme
 * flows into the admin screens for free.
 *
 * The option rows stay <button> elements even when nothing is clickable, so the preview is the
 * same markup rather than a lookalike.
 */
const OPTION_STYLES: Record<OptionState, string> = {
  idle: 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40',
  selected: 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-500/20',
  correct: 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-500/20',
  wrong: 'border-rose-400 bg-rose-50 ring-2 ring-rose-500/20',
  muted: 'border-slate-200 bg-white opacity-55',
}

const BADGE_STYLES: Record<OptionState, string> = {
  idle: 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700',
  selected: 'bg-indigo-600 text-white',
  correct: 'bg-emerald-600 text-white',
  wrong: 'bg-rose-600 text-white',
  muted: 'bg-slate-100 text-slate-500',
}

export function QuestionCard({
  prompt,
  options,
  stateFor,
  onChoose,
  disabled = false,
  className = '',
  children,
}: {
  prompt: string
  options: QuestionOption[]
  stateFor: (optionId: number) => OptionState
  /** Omit for a non-interactive rendering, such as the editor's preview. */
  onChoose?: (optionId: number) => void
  disabled?: boolean
  className?: string
  /** Rendered after the options: grading feedback in the quiz, explanation in the preview. */
  children?: ReactNode
}) {
  const interactive = Boolean(onChoose)

  return (
    <Card className={`p-6 sm:p-8 ${className}`}>
      <h1 className="text-xl font-semibold leading-snug text-slate-900 sm:text-2xl">{prompt}</h1>

      <div className="mt-6 space-y-3" role="group" aria-label="Answer options">
        {options.map((option, optionIndex) => {
          const state = stateFor(option.id)
          return (
            <button
              key={option.id}
              type="button"
              onClick={onChoose ? () => onChoose(option.id) : undefined}
              disabled={!interactive || disabled}
              aria-label={`Option ${option.label}: ${option.text}`}
              className={`group flex w-full items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition disabled:cursor-default ${OPTION_STYLES[state]}`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold transition ${BADGE_STYLES[state]}`}
              >
                {state === 'correct' ? '✓' : state === 'wrong' ? '✕' : option.label}
              </span>
              <span className="text-slate-800">{option.text}</span>
              <span className="ml-auto hidden text-xs text-slate-400 sm:block">{optionIndex + 1}</span>
            </button>
          )
        })}
      </div>

      {children}
    </Card>
  )
}
