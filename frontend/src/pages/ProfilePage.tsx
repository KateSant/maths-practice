import { useEffect, useState, type FormEvent } from 'react'
import { ApiRequestError, api } from '../api/client'
import type { HistoryItem } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { AccuracyRing } from '../components/AccuracyRing'
import { Button, Card, EmptyState, ProgressBar, Spinner, StatTile } from '../components/ui'
import { accuracyTone, formatDate, formatDateTime, initials, percent } from '../lib/format'
import { Link } from 'react-router-dom'

export function ProfilePage() {
  const { profile, refresh } = useAuth()

  const [history, setHistory] = useState<HistoryItem[] | null>(null)
  const [name, setName] = useState(profile?.user.displayName ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const loaded = await api.history()
        if (!cancelled) setHistory(loaded)
      } catch {
        if (!cancelled) setHistory([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!profile) {
    return <Spinner label="Loading your profile…" />
  }

  const { user, stats } = profile

  const saveName = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await api.updateDisplayName(name)
      await refresh()
      setEditing(false)
      setMessage('Saved.')
    } catch (caught) {
      setMessage(caught instanceof ApiRequestError ? caught.message : 'Could not save your name.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <Card className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xl font-bold text-white">
          {initials(user.displayName)}
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={saveName} className="flex flex-wrap items-center gap-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                aria-label="Display name"
              />
              <Button type="submit" size="sm" disabled={saving || name.trim().length === 0}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false)
                  setName(user.displayName)
                }}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{user.displayName}</h1>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Edit name
              </Button>
            </div>
          )}
          <p className="mt-0.5 truncate text-sm text-slate-500">{user.email}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Joined {formatDate(user.createdAt)} · {user.role.toLowerCase()}
          </p>
          {message ? <p className="mt-1 text-xs text-slate-500">{message}</p> : null}
        </div>

        <div className="hidden sm:block">
          <AccuracyRing accuracy={stats.accuracyPercent} size={112} stroke={10} />
        </div>
      </Card>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Points" value={user.points} accent="text-amber-600" />
        <StatTile label="Current streak" value={user.currentStreak} hint={`Best ${user.bestStreak}`} accent="text-orange-600" />
        <StatTile label="Questions answered" value={stats.totalAnswered} hint={`${stats.totalCorrect} correct`} />
        <StatTile label="Rounds completed" value={stats.sessionsCompleted} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Progress by topic</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Accuracy across everything you have answered so far.
        </p>

        <div className="mt-4">
          {stats.byTopic.length === 0 ? (
            <EmptyState
              title="Nothing to show yet"
              body="Answer some questions and your per-topic accuracy will appear here."
              action={
                <Link to="/">
                  <Button>Start practising</Button>
                </Link>
              }
            />
          ) : (
            <Card className="divide-y divide-slate-100">
              {stats.byTopic.map((topic) => {
                const topicTone = accuracyTone(topic.accuracyPercent)
                return (
                  <div key={topic.topicId} className="flex items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate font-medium text-slate-800">{topic.topicName}</p>
                        <p className={`text-sm font-bold tabular-nums ${topicTone.text}`}>
                          {percent(topic.accuracyPercent)}
                        </p>
                      </div>
                      <div className="mt-2">
                        <ProgressBar
                          value={topic.correct}
                          max={topic.answered}
                          tone={topicTone.bar}
                          label={`${topic.topicName} accuracy`}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">
                        {topic.correct} of {topic.answered} correct · {topicTone.label}
                      </p>
                    </div>
                  </div>
                )
              })}
            </Card>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Practice history</h2>
        <div className="mt-4">
          {history === null ? (
            <Spinner label="Loading history…" />
          ) : history.length === 0 ? (
            <EmptyState title="Nothing practised yet" body="Finish a round and it will be listed here." />
          ) : (
            <Card className="divide-y divide-slate-100">
              {history.map((item) => {
                const itemTone = accuracyTone(item.accuracyPercent)
                return (
                  <Link
                    key={item.sessionId}
                    to={`/results/${item.sessionId}`}
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">{item.topicName}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(item.completedAt)}</p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${itemTone.text}`}>
                      {item.correctCount}/{item.questionCount}
                    </span>
                    <span className="hidden text-xs text-amber-600 sm:block">+{item.pointsAwarded}</span>
                    <span className="text-slate-300" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                )
              })}
            </Card>
          )}
        </div>
      </section>
    </div>
  )
}
