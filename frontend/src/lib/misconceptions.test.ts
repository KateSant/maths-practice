import { describe, expect, it } from 'vitest'
import { MISCONCEPTIONS, describeMisconception, misconception, misconceptionsByTopic, studentFeedback } from './misconceptions'

/**
 * The register is imported content, so these tests deliberately do not name codes: the seeder is
 * rebuilding the register topic by topic and codes may be renamed. What is asserted is the
 * contract the teacher screens rely on - every row is usable, a lookup round-trips, and the
 * question's own topic is sorted first - so a broken register fails here rather than in a picker.
 */
describe('the misconception register', () => {
  it('loads, and every row is usable as an option', () => {
    expect(MISCONCEPTIONS.length).toBeGreaterThan(0)
    for (const entry of MISCONCEPTIONS) {
      expect(entry.code).toMatch(/^[A-Z0-9-]+$/)
      expect(entry.topic.trim()).not.toBe('')
      expect(entry.misconception.trim()).not.toBe('')
    }
  })

  it('has no duplicate codes', () => {
    const codes = MISCONCEPTIONS.map((entry) => entry.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

describe('the line a student reads when they get it wrong', () => {
  it('is on every row, and is not just the teacher’s sentence again', () => {
    for (const entry of MISCONCEPTIONS) {
      expect(entry.student?.trim(), `${entry.code} has no student line`).toBeTruthy()
      // If the two ever matched there would be no point having the second one: the teacher's
      // wording ('is not recognised as the same value') is exactly what a student cannot use.
      expect(entry.student, `${entry.code} just repeats the teacher's sentence`).not.toBe(entry.misconception)
    }
  })

  it('speaks to the student rather than about them', () => {
    for (const entry of MISCONCEPTIONS) {
      expect(entry.student, `${entry.code} does not address the student`).toMatch(/\b(you|your)\b/i)
    }
  })

  it('is short enough to read in the moment', () => {
    for (const entry of MISCONCEPTIONS) {
      expect(entry.student!.length, `${entry.code} is a paragraph, not a line`).toBeLessThan(200)
    }
  })

  it('round-trips every code and says nothing for an unknown one', () => {
    for (const entry of MISCONCEPTIONS) {
      expect(studentFeedback(entry.code)).toBe(entry.student)
    }
    expect(studentFeedback('NOT-A-REAL-CODE')).toBeUndefined()
    expect(studentFeedback(null)).toBeUndefined()
    expect(studentFeedback(undefined)).toBeUndefined()
  })
})

describe('looking a code up', () => {
  const first = MISCONCEPTIONS[0]

  it('round-trips a registered code', () => {
    // A register that fails this is empty, which the first test already catches, but the point
    // is that the lookup key is the code and not, say, the sentence.
    expect(misconception(first?.code)).toEqual(first)
    expect(describeMisconception(first?.code)).toBe(first?.misconception)
  })

  it('returns nothing for a code that is absent, empty or unknown', () => {
    expect(misconception(undefined)).toBeUndefined()
    expect(misconception(null)).toBeUndefined()
    expect(misconception('')).toBeUndefined()
    expect(misconception('NOT-A-REAL-CODE')).toBeUndefined()
    expect(describeMisconception('NOT-A-REAL-CODE')).toBeUndefined()
  })
})

describe('grouping by topic', () => {
  it('puts the question\u2019s own topic first', () => {
    // A topic that is guaranteed to exist: the first row's.
    const own = MISCONCEPTIONS[0]?.topic
    const groups = misconceptionsByTopic(own)

    expect(groups.length).toBeGreaterThan(0)
    expect(groups[0]?.topic).toBe(own)
    for (const item of groups[0]?.items ?? []) {
      expect(item.topic).toBe(own)
    }
  })

  it('keeps every registered code inside exactly one group', () => {
    const groups = misconceptionsByTopic()
    const grouped = groups.flatMap((group) => group.items)
    expect(grouped).toHaveLength(MISCONCEPTIONS.length)
  })
})
