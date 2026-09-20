import { describe, expect, it } from 'vitest'
import {
  accuracyTone,
  encouragement,
  formatDateTime,
  formatDuration,
  initials,
  percent,
  pluralise,
} from './format'

describe('percent', () => {
  it('rounds to the nearest whole number', () => {
    expect(percent(33.333)).toBe('33%')
    expect(percent(66.666)).toBe('67%')
    expect(percent(0)).toBe('0%')
    expect(percent(100)).toBe('100%')
  })
})

describe('pluralise', () => {
  it('uses the singular for exactly one', () => {
    expect(pluralise(1, 'question')).toBe('1 question')
  })

  it('uses the plural for zero and many', () => {
    expect(pluralise(0, 'question')).toBe('0 questions')
    expect(pluralise(7, 'question')).toBe('7 questions')
  })

  it('accepts an irregular plural', () => {
    expect(pluralise(2, 'quiz', 'quizzes')).toBe('2 quizzes')
  })
})

describe('accuracyTone', () => {
  it('bands accuracy into strong, middling and weak', () => {
    expect(accuracyTone(80).label).toBe('Strong')
    expect(accuracyTone(100).label).toBe('Strong')
    expect(accuracyTone(79).label).toBe('Getting there')
    expect(accuracyTone(50).label).toBe('Getting there')
    expect(accuracyTone(49).label).toBe('Needs practice')
    expect(accuracyTone(0).label).toBe('Needs practice')
  })
})

describe('encouragement', () => {
  it('celebrates a perfect score', () => {
    expect(encouragement(100, 5, 5)).toBe('Perfect score!')
  })

  it('does not call 0 of 0 perfect', () => {
    expect(encouragement(0, 0, 0)).not.toBe('Perfect score!')
  })

  it('stays quiet about a low score, leaving it to the review', () => {
    expect(encouragement(0, 0, 5)).toBe('')
    expect(encouragement(33, 2, 6)).toBe('')
  })
})

describe('formatDuration', () => {
  it('shows sub-minute durations in seconds', () => {
    expect(formatDuration(12_400)).toBe('12.4s')
  })

  it('shows longer durations as minutes and padded seconds', () => {
    expect(formatDuration(65_000)).toBe('1m 05s')
    expect(formatDuration(600_000)).toBe('10m 00s')
  })
})

describe('initials', () => {
  it('takes the first and last name initials', () => {
    expect(initials('Ada Lovelace')).toBe('AL')
    expect(initials('Grace Brewster Murray Hopper')).toBe('GH')
  })

  it('handles a single name and blank input', () => {
    expect(initials('Ada')).toBe('A')
    expect(initials('   ')).toBe('?')
  })
})

describe('formatDateTime', () => {
  it('returns a dash for missing or unparseable values', () => {
    expect(formatDateTime(undefined)).toBe('—')
    expect(formatDateTime('not-a-date')).toBe('—')
  })
})
