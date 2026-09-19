import { describe, expect, it } from 'vitest'
import {
  accuracyTone,
  encouragement,
  formatDateTime,
  formatDuration,
  initials,
  levelProgress,
  oreTier,
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

  it('acknowledges a zero score kindly', () => {
    expect(encouragement(0, 0, 5)).toBe('Tricky one. Have a look at the answers below.')
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

describe('levelProgress', () => {
  it('starts at level 1 with no points', () => {
    expect(levelProgress(0)).toEqual({ level: 1, intoLevel: 0, needed: 100, percent: 0 })
  })

  it('levels up exactly on the boundary, not just after it', () => {
    expect(levelProgress(99).level).toBe(1)
    expect(levelProgress(99).percent).toBe(99)
    expect(levelProgress(100)).toEqual({ level: 2, intoLevel: 0, needed: 100, percent: 0 })
  })

  it('reports progress within a level', () => {
    expect(levelProgress(250)).toEqual({ level: 3, intoLevel: 50, needed: 100, percent: 50 })
  })

  it('copes with values that cannot happen without throwing', () => {
    expect(levelProgress(-10).level).toBe(1)
    expect(levelProgress(Number.NaN).level).toBe(1)
    expect(levelProgress(10.7).intoLevel).toBe(10)
  })
})

describe('oreTier', () => {
  it('maps difficulty 1 to 5 onto ascending ores', () => {
    expect([1, 2, 3, 4, 5].map((d) => oreTier(d).name)).toEqual([
      'Coal',
      'Iron',
      'Gold',
      'Emerald',
      'Diamond',
    ])
  })

  it('gives each tier a distinct colour', () => {
    const swatches = [1, 2, 3, 4, 5].map((d) => oreTier(d).swatch)
    expect(new Set(swatches).size).toBe(5)
  })

  it('falls back rather than failing for a difficulty outside the range', () => {
    expect(oreTier(9).name).toBe('Level 9')
    expect(oreTier(0).swatch).toBeTruthy()
  })
})
