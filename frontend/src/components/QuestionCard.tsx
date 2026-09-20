import type { ReactNode } from 'react'
import { Card } from './ui'
import type { OptionState } from '../lib/answerState'

export type { OptionState }

export interface QuestionOption {
  id: number
  label: string
  text: string
}

/**
 * How the options behave: pick one, or tick any number.
 *
 * Not the server's AnswerType. A preview in the editor, which may not have been saved yet, still
 * has to render one or the other, and naming this after the interaction keeps the component from
 * taking a dependency on the API's vocabulary.
 */
export type QuestionVariant = 'single' | 'multi'

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

/**
 * The tick-all badge is a checkbox rather than a letter, because that is the affordance - it has to
 * read as "tick any of these" at a glance. The letters are still in each row's accessible name, so
 * nothing is lost to a screen reader.
 */
const MULTI_BADGE_STYLES: Record<OptionState, string> = {
  idle: 'border-2 border-slate-300 bg-white group-hover:border-indigo-400',
  selected: 'border-2 border-indigo-600 bg-indigo-600 text-white',
  correct: 'border-2 border-emerald-600 bg-emerald-600 text-white',
  wrong: 'border-2 border-rose-600 bg-rose-600 text-white',
  muted: 'border-2 border-slate-200 bg-white',
}

function badgeMark(state: OptionState, label: string, variant: QuestionVariant): string {
  if (state === 'correct') return '✓'
  if (state === 'wrong') return '✕'
  return variant === 'multi' ? '' : label
}

export function QuestionCard({
  prompt,
  options,
  stateFor,
  onChoose,
  variant = 'single',
  disabled = false,
  className = '',
  children,
}: {
  prompt: string
  options: QuestionOption[]
  stateFor: (optionId: number) => OptionState
  /** Omit for a non-interactive rendering, such as the editor's preview. */
  onChoose?: (optionId: number) => void
  variant?: QuestionVariant
  disabled?: boolean
  className?: string
  /** Rendered after the options: grading feedback in the quiz, explanation in the preview. */
  children?: ReactNode
}) {
  const interactive = Boolean(onChoose)
  const multi = variant === 'multi'

  return (
    <Card className={`p-6 sm:p-8 ${className}`}>
      <h1 className="text-xl font-semibold leading-snug text-slate-900 sm:text-2xl">{prompt}</h1>

      {/* Part of the question, not the page, so the editor's preview says it too. */}
      {multi ? (
        <p className="mt-2 text-sm font-medium text-indigo-600">Tick every answer that applies.</p>
      ) : null}

      <div className="mt-6 space-y-3" role="group" aria-label="Answer options">
        {options.map((option) => {
          const state = stateFor(option.id)
          return (
            <button
              key={option.id}
              type="button"
              onClick={onChoose ? () => onChoose(option.id) : undefined}
              disabled={!interactive || disabled}
              aria-label={`Option ${option.label}: ${option.text}`}
              // The rows really are toggles in this variant, so they say so - but only while they
              // are still a control. Once marked they are a result: an option in the answer key
              // that the student never ticked is drawn as correct, and claiming it is "pressed"
              // would be a lie about what they did. The tick or cross and the banner carry the
              // verdict instead.
              aria-pressed={multi ? state === 'selected' : undefined}
              className={`group flex w-full items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition disabled:cursor-default ${OPTION_STYLES[state]}`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold transition ${
                  multi ? MULTI_BADGE_STYLES[state] : BADGE_STYLES[state]
                }`}
                aria-hidden="true"
              >
                {badgeMark(state, option.label, variant)}
              </span>
              <span className="text-slate-800">{option.text}</span>
            </button>
          )
        })}
      </div>

      {children}
    </Card>
  )
}
