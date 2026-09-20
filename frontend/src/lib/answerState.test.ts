import { describe, expect, it } from 'vitest'
import { optionState, toggleSelection } from './answerState'

describe('optionState', () => {
  const base = { optionId: 2, selectedIds: [] as number[], correctOptionIds: [] as number[] }

  it('shows an untouched option as idle before marking', () => {
    expect(optionState({ ...base, graded: false })).toBe('idle')
  })

  it('shows a chosen option as selected before marking', () => {
    expect(optionState({ ...base, selectedIds: [2], graded: false })).toBe('selected')
  })

  it('shows the right answer as correct once marked, chosen or not', () => {
    expect(optionState({ ...base, correctOptionIds: [2], graded: true })).toBe('correct')
    expect(optionState({ ...base, selectedIds: [2], correctOptionIds: [2], graded: true })).toBe('correct')
  })

  it('shows a wrongly chosen option as wrong', () => {
    expect(optionState({ ...base, selectedIds: [2], correctOptionIds: [1], graded: true })).toBe('wrong')
  })

  it('mutes everything else once marked', () => {
    expect(optionState({ ...base, correctOptionIds: [1], graded: true })).toBe('muted')
  })

  /*
   * The tick-all case that matters: every correct option is revealed, not just the ones the student
   * ticked. On a question they got wrong, a right tick they made still shows as correct, because
   * pointing at the mistake is more useful than colouring the whole thing red.
   */
  it('reveals every correct option on a tick-all answer, and the extra tick as the mistake', () => {
    const marked = { selectedIds: [1, 4], correctOptionIds: [1, 2, 4], graded: true }

    expect(optionState({ ...base, optionId: 1, ...marked })).toBe('correct')
    expect(optionState({ ...base, optionId: 2, ...marked })).toBe('correct')
    expect(optionState({ ...base, optionId: 4, ...marked })).toBe('correct')
    expect(optionState({ ...base, optionId: 3, ...marked })).toBe('muted')

    // ...and the one they added that is not in the key is the wrong one.
    const withExtra = { selectedIds: [1, 2, 4, 5], correctOptionIds: [1, 2, 4], graded: true }
    expect(optionState({ ...base, optionId: 5, ...withExtra })).toBe('wrong')
  })
})

describe('toggleSelection', () => {
  it('adds an option that is not selected', () => {
    expect(toggleSelection([1, 3], 2)).toEqual([1, 3, 2])
  })

  it('removes an option that is already selected', () => {
    expect(toggleSelection([1, 2, 3], 2)).toEqual([1, 3])
  })

  it('returns a new array rather than mutating, so it is safe to hand to a state setter', () => {
    const original = [1]
    const next = toggleSelection(original, 2)
    expect(original).toEqual([1])
    expect(next).not.toBe(original)
  })

  it('copes with an empty selection', () => {
    expect(toggleSelection([], 1)).toEqual([1])
  })
})
