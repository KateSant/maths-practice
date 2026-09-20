import { describe, expect, it } from 'vitest'
import { HEARTBEAT_INTERVAL_MS, formatClock, tickClock } from './playtime'

describe('formatClock', () => {
  it('pads the seconds so the digits do not shift as the countdown shrinks', () => {
    expect(formatClock(7)).toBe('0:07')
    expect(formatClock(59)).toBe('0:59')
  })

  it('rolls over into minutes', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(60)).toBe('1:00')
    expect(formatClock(160)).toBe('2:40')
    expect(formatClock(3599)).toBe('59:59')
  })

  it('floors fractional seconds rather than rounding them up', () => {
    expect(formatClock(59.9)).toBe('0:59')
    expect(formatClock(0.4)).toBe('0:00')
  })

  it('clamps a negative balance to zero rather than printing a minus sign', () => {
    expect(formatClock(-5)).toBe('0:00')
  })
})

describe('tickClock', () => {
  it('subtracts whole seconds only', () => {
    expect(tickClock(100, 1000)).toBe(99)
    expect(tickClock(100, 1999)).toBe(99)
    expect(tickClock(100, 999)).toBe(100)
    expect(tickClock(100, 0)).toBe(100)
  })

  it('never goes below zero, however long the gap', () => {
    expect(tickClock(5, 10_000)).toBe(0)
    expect(tickClock(0, 1000)).toBe(0)
  })

  it('ignores a clock that appears to have gone backwards', () => {
    expect(tickClock(100, -1000)).toBe(100)
  })

  it('passes an untimed balance straight through', () => {
    expect(tickClock(Number.POSITIVE_INFINITY, 5000)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('HEARTBEAT_INTERVAL_MS', () => {
  // The server caps what one heartbeat gap may cost. Beating more slowly than that cap would have
  // every gap clipped, and the student would silently lose the difference.
  it('stays within the server default of 30s for a single gap', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBeLessThanOrEqual(30_000)
  })
})
