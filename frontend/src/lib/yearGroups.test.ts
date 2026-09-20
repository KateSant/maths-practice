import { describe, expect, it } from 'vitest'
import {
  DEFAULT_YEAR_GROUP,
  YEAR_GROUPS,
  isYearGroup,
  readYearGroup,
  writeYearGroup,
  yearGroupLabel,
} from './yearGroups'

/** The smallest thing that behaves like Storage, so no DOM environment is needed. */
function fakeStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  }
}

describe('the year groups on offer', () => {
  it('runs from Year 7 to Year 13, in order', () => {
    expect(YEAR_GROUPS).toEqual([7, 8, 9, 10, 11, 12, 13])
  })

  it('labels a year group the way a school would', () => {
    expect(yearGroupLabel(7)).toBe('Year 7')
    expect(yearGroupLabel(13)).toBe('Year 13')
  })

  it('recognises only the years on the dropdown', () => {
    expect(isYearGroup(7)).toBe(true)
    expect(isYearGroup(13)).toBe(true)
    expect(isYearGroup(6)).toBe(false)
    expect(isYearGroup(14)).toBe(false)
    expect(isYearGroup('7')).toBe(false)
    expect(isYearGroup(undefined)).toBe(false)
  })
})

describe('remembering the student\u2019s choice', () => {
  it('starts at Year 7 when nothing has been chosen', () => {
    expect(readYearGroup(fakeStorage() as unknown as Storage)).toBe(DEFAULT_YEAR_GROUP)
  })

  it('reads back the last choice', () => {
    const storage = fakeStorage()
    writeYearGroup(10, storage as unknown as Storage)
    expect(readYearGroup(storage as unknown as Storage)).toBe(10)
  })

  it('falls back rather than trusting a stored value that is not a year group', () => {
    // A value from an older build, a hand-edited key, or another app on the same origin.
    for (const stored of ['banana', '6', '14', '', 'true']) {
      expect(readYearGroup(fakeStorage({ 'realmaths.yearGroup': stored }) as unknown as Storage)).toBe(
        DEFAULT_YEAR_GROUP,
      )
    }
  })

  it('survives storage that refuses to be read', () => {
    const hostile = {
      getItem: () => {
        throw new Error('private browsing')
      },
    }
    expect(readYearGroup(hostile as unknown as Storage)).toBe(DEFAULT_YEAR_GROUP)
  })

  it('does not fail the page when storage refuses to be written', () => {
    const hostile = {
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }
    expect(() => writeYearGroup(9, hostile as unknown as Storage)).not.toThrow()
  })
})
