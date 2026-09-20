import { describe, expect, it } from 'vitest'
import { MISCONCEPTIONS, describeMisconception, misconception, misconceptionsByTopic } from './misconceptions'

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
