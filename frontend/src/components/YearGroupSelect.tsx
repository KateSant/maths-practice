import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { YEAR_GROUPS, readYearGroup, writeYearGroup, yearGroupLabel, type YearGroup } from '../lib/yearGroups'

interface YearGroupValue {
  /** The year group whose questions are dealt, 7 to 13. */
  yearGroup: YearGroup
  setYearGroup: (yearGroup: YearGroup) => void
}

const YearGroupContext = createContext<YearGroupValue | null>(null)

/**
 * Holds the student's chosen year group, and remembers it between visits.
 *
 * The control lives in the header but the topic list and the quiz both depend on the value, so it
 * cannot stay local to the page that shows it. Which year a student works at is a preference, not
 * a fact about them - there is nothing on their account to store it on - so `localStorage` is the
 * only thing that carries it between visits.
 */
export function YearGroupProvider({ children }: { children: ReactNode }) {
  const [yearGroup, setYearGroupState] = useState<YearGroup>(() => readYearGroup())

  const setYearGroup = useCallback((next: YearGroup) => {
    setYearGroupState(next)
    writeYearGroup(next)
  }, [])

  const value = useMemo(() => ({ yearGroup, setYearGroup }), [yearGroup, setYearGroup])

  return <YearGroupContext.Provider value={value}>{children}</YearGroupContext.Provider>
}

export function useYearGroup(): YearGroupValue {
  const value = useContext(YearGroupContext)

  if (value === null) {
    // A wiring mistake rather than a runtime condition, so it fails loudly instead of quietly
    // dealing Year 7 to everybody.
    throw new Error('useYearGroup must be used inside a YearGroupProvider')
  }
  return value
}

/**
 * The header control: which year's questions to practise.
 *
 * A plain form control rather than a link, so it sits beside the navigation rather than among it.
 * Changing it is always allowed and takes effect on the next set - a Year 7 who wants Year 10
 * picks Year 10 and is dealt Year 10 questions.
 */
export function YearGroupSelect({ className = '' }: { className?: string }) {
  const { yearGroup, setYearGroup } = useYearGroup()

  return (
    <label className={`flex items-center ${className}`}>
      <span className="sr-only">Year group</span>
      <select
        value={yearGroup}
        onChange={(event) => setYearGroup(Number(event.target.value) as YearGroup)}
        title="Which year group's questions to practise"
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      >
        {YEAR_GROUPS.map((year) => (
          <option key={year} value={year}>
            {yearGroupLabel(year)}
          </option>
        ))}
      </select>
    </label>
  )
}
