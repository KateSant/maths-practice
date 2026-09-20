/**
 * What an answer option should look like, and what clicking one does.
 *
 * Kept as plain functions rather than living inside the question component, for the reason the
 * project gives about the frontend suite having no DOM environment: this is the logic worth
 * asserting, and a function is where it can be asserted.
 *
 * The two answer types share all of it. A single choice is simply the case where at most one
 * option is ever selected, so there is no branch on the answer type here that could drift from
 * the one on the server.
 */

/** The visual state of one option row. */
export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted'

export interface OptionStateInput {
  optionId: number
  /** What the student has ticked: one entry for a single choice, several for a tick-all. */
  selectedIds: number[]
  /** The revealed answer key. Empty until the answer has been marked. */
  correctOptionIds: number[]
  /** Whether the answer has been marked yet. */
  graded: boolean
}

/**
 * The state to draw an option in.
 *
 * Before marking, an option is `selected` or `idle`. After marking, anything in the key is
 * `correct` and anything else the student picked is `wrong`; everything remaining is `muted`.
 *
 * Note what this does on a tick-all answer that was wrong: options the student got right still
 * show as correct, and the ones they wrongly added show as wrong. That is the useful reading - it
 * says which tick was the mistake - and the verdict on the question as a whole is carried by the
 * banner above it, not by the colour of any one row.
 */
export function optionState({
  optionId,
  selectedIds,
  correctOptionIds,
  graded,
}: OptionStateInput): OptionState {
  const chosen = selectedIds.includes(optionId)
  if (!graded) return chosen ? 'selected' : 'idle'
  if (correctOptionIds.includes(optionId)) return 'correct'
  return chosen ? 'wrong' : 'muted'
}

/**
 * Adds an option to the selection or takes it out again, which is what a click means on a tick-all
 * question. Returns a new array rather than mutating, so it can be handed straight to a state
 * setter.
 */
export function toggleSelection(selectedIds: number[], optionId: number): number[] {
  return selectedIds.includes(optionId)
    ? selectedIds.filter((id) => id !== optionId)
    : [...selectedIds, optionId]
}
