import { useEffect, useState } from 'react'
import { ApiRequestError, api } from '../api/client'
import type { Topic } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { TopicCard } from '../components/TopicCard'
import { Spinner, StatTile } from '../components/ui'
import { accuracyTone, encouragement, percent } from '../lib/format'

/**
 * The student home page is the topic list, and nothing else.
 *
 * There is no mixed practice, no question-count picker and no list of finished sittings: those
 * belonged to the idea of a "round", which sat between the student and the topics without adding
 * anything to them. A student picks a topic and works through it.
 */
export function HomePage() {
  const { profile, refresh } = useAuth()

  const [topics, setTopics] = useState<Topic[] | null>(null)
  const [error, setError] = useState('')

  // Pull fresh stats too, so points and streaks are right after practising a topic.
  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const loaded = await api.topics()
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
  }, [])

  const stats = profile?.stats
  const firstName = profile?.user.displayName.split(' ')[0] ?? 'there'
  const tone = accuracyTone(stats?.accuracyPercent ?? 0)
  const accuracyById = new Map((stats?.byTopic ?? []).map((entry) => [entry.topicId, entry.accuracyPercent]))

  return (
    <div className="animate-rise space-y-8">
      <section>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Hi {firstName} 👋</h1>
        <p className="mt-1 text-slate-500">
          {stats && stats.totalAnswered > 0
            ? encouragement(stats.accuracyPercent, stats.totalCorrect, stats.totalAnswered)
            : 'Pick a topic below and answer a few questions to get started.'}
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
        <h2 className="text-lg font-semibold text-slate-900">Topics</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Work through a topic's questions, with the working shown after each answer.
        </p>

        {error ? (
          <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        ) : null}

        {!topics && !error ? <Spinner label="Loading topics…" /> : null}

        {topics ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} accuracy={accuracyById.get(topic.id)} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}
