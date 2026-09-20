/**
 * The year groups the question bank is organised into, and where a student's choice of one is
 * kept.
 *
 * The choice is deliberately not part of the account. There is no year group on a user and no age
 * asked for at sign-up: a Year 7 who wants to work at Year 10 level picks Year 10, and the next
 * set is drawn from Year 10. Remembering it here rather than on the profile is what keeps it a
 * preference rather than a fact about the person, and it means the dropdown works for guest
 * accounts too, which have no profile to store anything on.
 */

export const YEAR_GROUPS = [7, 8, 9, 10, 11, 12, 13] as const

export type YearGroup = (typeof YEAR_GROUPS)[number]

/** Year 7, which is where all the starter content lives. */
export const DEFAULT_YEAR_GROUP: YearGroup = 7

const STORAGE_KEY = 'realmaths.yearGroup'

export function yearGroupLabel(yearGroup: number): string {
  return `Year ${yearGroup}`
}

export function isYearGroup(value: unknown): value is YearGroup {
  return typeof value === 'number' && (YEAR_GROUPS as readonly number[]).includes(value)
}

/**
 * The last year group the student chose, or Year 7.
 *
 * Never throws. Private browsing modes can make `localStorage` itself throw on access, and a
 * stored value can be anything at all, so both are treated as "nothing remembered yet". A
 * preference is not worth a blank page over.
 */
export function readYearGroup(storage?: Storage): YearGroup {
  try {
    const store = storage ?? window.localStorage
    const stored = Number(store.getItem(STORAGE_KEY))
    return isYearGroup(stored) ? stored : DEFAULT_YEAR_GROUP
  } catch {
    return DEFAULT_YEAR_GROUP
  }
}

/**
 * Remembers the choice for next time.
 *
 * A failure here is ignored: the choice still applies to the visit that made it, and there is
 * nothing useful to tell the student about their browser refusing to store a preference.
 */
export function writeYearGroup(yearGroup: YearGroup, storage?: Storage): void {
  try {
    const store = storage ?? window.localStorage
    store.setItem(STORAGE_KEY, String(yearGroup))
  } catch {
    // Deliberately nothing.
  }
}
