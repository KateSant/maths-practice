import { useEffect, useState } from 'react'
import { ApiRequestError, api } from '../api/client'
import type { Topic } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { TopicCard } from '../components/TopicCard'
import { Spinner, StatTile } from '../components/ui'
import { accuracyTone, encouragement, percent } from '../lib/format'
import { YEAR_GROUPS, readYearGroup, writeYearGroup, yearGroupLabel, type YearGroup } from '../lib/yearGroups'

/**
 * The student home page is the topic list and the year group they are working at, and nothing
 * else.
 *
 * There is no mixed practice and no question-count picker: those belonged to the idea of a
 * "round", which sat between the student and the topics without adding anything to them. A
 * student picks a year group and a topic and works through it.
 *
 * The year group is a preference, not a fact about the student. Nothing is asked at sign-up and
 * nothing is stored on their account, so a Year 7 who wants Year 10 work simply chooses Year 10;
 * that is also why the choice lives in `localStorage` rather than on the profile.
 */
export function HomePage() {
  const { profile, refresh } = useAuth()

  const [topics, setTopics] = useState<Topic[] | null>(null)
  const [yearGroup, setYearGroup] = useState<YearGroup>(() => readYearGroup())
  const [error, setError] = useState('')

  // Pull fresh stats too, so points and streaks are right after practising a topic.
  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // Counted for the chosen year, and topics with nothing there are left out, so every card
        // on screen can actually deal a set.
        const loaded = await api.topics(yearGroup)
        if (!cancelled) setTopics(loaded)
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiRequestError ? caught.message : 'Could not load your topics.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [yearGroup])

  const chooseYearGroup = (next: YearGroup) => {
    setYearGroup(next)
    writeYearGroup(next)
    // Back to the loading state rather than leaving last year's topics under the new heading.
    setTopics(null)
    setError('')
  }

  const stats = profile?.stats
  const firstName = profile?.user.displayName.split(' ')[0] ?? 'there'
  // Only shown when there is something good to say; a low score gets the neutral line instead.
  const encouragementMessage =
    stats && stats.totalAnswered > 0
      ? encouragement(stats.accuracyPercent, stats.totalCorrect, stats.totalAnswered)
      : ''
  const tone = accuracyTone(stats?.accuracyPercent ?? 0)
  const accuracyById = new Map((stats?.byTopic ?? []).map((entry) => [entry.topicId, entry.accuracyPercent]))
  const levelById = new Map((stats?.byTopic ?? []).map((entry) => [entry.topicId, entry.level]))

  return (
    <div className="animate-rise space-y-8">
      <section>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Hi {firstName} 👋</h1>
        <p className="mt-1 text-slate-500">
          {encouragementMessage || 'Pick a topic below and answer a few questions to get started.'}
        </p>
      </section>

      {/*
        Deliberately nothing about teaching here. The practice side is the student side, and a
        teacher who signs in through the Student door gets a student page - no card offering the
        question bank, no reminder that there is one. The two halves are kept apart on purpose,
        even for the same person, and switching means signing in through the other door.
      */}
      {stats ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Points" value={profile?.user.points ?? 0} accent="text-amber-600" />
          <StatTile
            label="Streak"
            value={profile?.user.currentStreak ?? 0}
            hint={`Best ${profile?.user.bestStreak ?? 0}`}
            accent="text-orange-600"
          />
          <StatTile
            label="Accuracy"
            value={percent(stats.accuracyPercent)}
            hint={`${stats.totalCorrect} of ${stats.totalAnswered}`}
            accent={tone.text}
          />
        </section>
      ) : null}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Topics</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              A short set from the topic, aimed at the level you are working at.
            </p>
          </div>

          {/*
            Always visible, never hidden behind the profile: which year you work at is a choice
            for this visit, not a setting, and changing it changes the questions immediately.
          */}
          <label className="flex shrink-0 items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Year group</span>
            <select
              value={yearGroup}
              onChange={(event) => chooseYearGroup(Number(event.target.value) as YearGroup)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {YEAR_GROUPS.map((year) => (
                <option key={year} value={year}>
                  {yearGroupLabel(year)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        ) : null}

        {!topics && !error ? <Spinner label={`Loading ${yearGroupLabel(yearGroup)} topics…`} /> : null}

        {topics && topics.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Nothing is published for {yearGroupLabel(yearGroup)} yet. Try another year group — you can
            change it at any time.
          </p>
        ) : null}

        {topics && topics.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                yearGroup={yearGroup}
                accuracy={accuracyById.get(topic.id)}
                level={levelById.get(topic.id)}
              />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}
