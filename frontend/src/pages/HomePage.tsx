import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiRequestError, api } from '../api/client'
import type { HistoryItem, Topic } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { TopicCard } from '../components/TopicCard'
import { Button, Card, EmptyState, ProgressBar, Spinner, StatTile, buttonClasses } from '../components/ui'
import { accuracyTone, encouragement, formatDateTime, percent, pluralise } from '../lib/format'

const COUNT_OPTIONS = [5, 10, 15]

export function HomePage() {
  const { profile, refresh } = useAuth()
  const navigate = useNavigate()

  const [topics, setTopics] = useState<Topic[] | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [questionCount, setQuestionCount] = useState(5)
  const [error, setError] = useState('')

  // Pull fresh stats too, so points and streaks are right after finishing a quiz.
  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [loadedTopics, loadedHistory] = await Promise.all([api.topics(), api.history()])
        if (cancelled) return
        setTopics(loadedTopics)
        setHistory(loadedHistory.slice(0, 4))
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiRequestError ? caught.message : 'Could not load your practice topics.')
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

      {stats ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <StatTile label="Quizzes" value={stats.sessionsCompleted} hint="completed" />
        </section>
      ) : null}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Choose a topic</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Questions</span>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {COUNT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setQuestionCount(option)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums transition ${
                    questionCount === option
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        ) : null}

        {!topics && !error ? <Spinner label="Loading topics…" /> : null}

        {topics ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="flex flex-col justify-between bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white ring-0">
              <div>
                <h3 className="font-semibold">Mixed practice</h3>
                <p className="mt-1.5 text-sm text-indigo-100">
                  A random selection drawn from every topic — good for a quick warm-up.
                </p>
              </div>
              <div className="pt-5">
                <Link
                  to={`/quiz?count=${questionCount}`}
                  className={buttonClasses('secondary', 'sm', 'w-full justify-center')}
                >
                  Start mixed quiz
                </Link>
              </div>
            </Card>

            {topics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                questionCount={questionCount}
                accuracy={accuracyById.get(topic.id)}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
          {history.length > 0 ? (
            <Link to="/profile" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              View all
            </Link>
          ) : null}
        </div>

        <div className="mt-4">
          {history.length === 0 ? (
            <EmptyState
              title="No quizzes yet"
              body="Your completed quizzes will appear here with your score for each one."
              action={
                <Button onClick={() => navigate(`/quiz?count=${questionCount}`)}>Start your first quiz</Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {history.map((item) => {
                const itemTone = accuracyTone(item.accuracyPercent)
                return (
                  <Card key={item.sessionId} className="flex items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{item.topicName}</p>
                      <p className="text-xs text-slate-400">
                        {formatDateTime(item.completedAt)} · {pluralise(item.questionCount, 'question')}
                      </p>
                    </div>
                    <div className="hidden w-32 sm:block">
                      <ProgressBar
                        value={item.correctCount}
                        max={item.questionCount}
                        tone={itemTone.bar}
                        label={`${item.topicName} score`}
                      />
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold tabular-nums ${itemTone.text}`}>
                        {item.correctCount}/{item.questionCount}
                      </p>
                      <p className="text-xs text-slate-400">+{item.pointsAwarded} pts</p>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
