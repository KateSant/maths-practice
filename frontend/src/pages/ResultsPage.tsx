import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ApiRequestError, api } from '../api/client'
import type { SessionSummary } from '../api/types'
import { AccuracyRing } from '../components/AccuracyRing'
import { LevelMeter } from '../components/LevelMeter'
import { MiningReward } from '../components/MiningReward'
import { Card, Spinner, StatTile, buttonClasses } from '../components/ui'
import { difficultyLabel, formatDuration, percent, pluralise } from '../lib/format'

interface ResultsLocationState {
  summary?: SessionSummary
}

export function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const handedOver = (location.state as ResultsLocationState | null)?.summary
  const id = Number(sessionId)

  const [summary, setSummary] = useState<SessionSummary | null>(handedOver ?? null)
  const [error, setError] = useState('')

  // The finishing screen passes the summary through navigation state, but loading it
  // from the API means a shared or refreshed /results/:id link still works.
  useEffect(() => {
    if (summary || !Number.isFinite(id)) return
    let cancelled = false
    api
      .session(id)
      .then((loaded) => {
        if (!cancelled) setSummary(loaded)
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiRequestError ? caught.message : 'Could not load those results.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [id, summary])

  if (error) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <p className="font-semibold text-slate-900">Results unavailable</p>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
        <Link to="/" className={`${buttonClasses('primary', 'md')} mt-5`}>
          Back to topics
        </Link>
      </Card>
    )
  }

  if (!summary) {
    return <Spinner label="Loading your results…" />
  }

  const retryHref = summary.topicSlug
    ? `/quiz?topic=${encodeURIComponent(summary.topicSlug)}&count=${summary.questionCount}`
    : `/quiz?count=${summary.questionCount}`

  return (
    <div className="mx-auto max-w-3xl animate-rise space-y-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-8 text-center text-white sm:px-10">
          {/* The topic is the heading. There used to be an encouraging line under it, but a
              sentence about a low score is worse than saying nothing. */}
          <h1 className="text-2xl font-bold">{summary.topicName}</h1>
        </div>

        <div className="flex flex-col items-center gap-6 px-6 py-8 sm:flex-row sm:justify-center sm:gap-12">
          <AccuracyRing accuracy={summary.accuracyPercent} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-1 lg:grid-cols-2">
            <StatTile
              label="Score"
              value={`${summary.correctCount}/${summary.questionCount}`}
              hint="correct answers"
            />
            <StatTile label="Points earned" value={`+${summary.pointsAwarded}`} accent="text-amber-600" />
            <StatTile label="Accuracy" value={percent(summary.accuracyPercent)} />
            <StatTile
              label="Answered"
              value={pluralise(summary.answeredCount, 'question')}
              hint={summary.answeredCount < summary.questionCount ? 'left blank' : 'all attempted'}
            />
          </div>
        </div>
      </Card>

      {/* The graduation moment. `level` is where the next set will be aimed, `setLevel` is where
          this one was, so a difference means the last few answers moved the student. */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {summary.level > summary.setLevel
                ? 'Moving up'
                : summary.level < summary.setLevel
                  ? 'Easing off'
                  : 'Next set'}
            </p>
            <p className="mt-0.5 font-semibold text-slate-900">
              {summary.level > summary.setLevel
                ? `Nice work — your next ${summary.topicName} set will be ${difficultyLabel(summary.level)}.`
                : summary.level < summary.setLevel
                  ? `Your next set steps back to ${difficultyLabel(summary.level)} while you rebuild.`
                  : `Your next set will stay at ${difficultyLabel(summary.level)}.`}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Sets are aimed at how your last few answers went, so they move up as you do.
            </p>
          </div>
          <LevelMeter level={summary.level} />
        </div>
      </Card>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Question review</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Every question with the answer you chose and the correct one.
        </p>

        <div className="mt-4 space-y-3">
          {summary.review.map((item, position) => (
            <Card
              key={item.questionId}
              className={`border-l-4 p-5 ${item.correct ? 'border-l-emerald-500' : 'border-l-rose-500'}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${
                    item.correct ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                  aria-hidden="true"
                >
                  {item.correct ? '✓' : '✕'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    <span className="text-slate-400">{position + 1}.</span> {item.prompt}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span className={item.correct ? 'text-emerald-700' : 'text-rose-700'}>
                      Your answer: {item.selectedLabel ? `${item.selectedLabel}) ` : ''}
                      {item.selectedText ?? 'not answered'}
                    </span>
                    {!item.correct && item.correctText ? (
                      <span className="text-emerald-700">
                        Correct: {item.correctLabel}) {item.correctText}
                      </span>
                    ) : null}
                  </div>

                  {item.explanation ? (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">
                      {item.explanation}
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* The reward for finishing: one ore per correct answer, to walk to and mine. Shown even
          for a zero score, where the patch has a single ore - a reward that only appears to
          the successful is not much of a reward, and for a demo it should always be visible. */}
      <MiningReward correctCount={summary.correctCount} questionCount={summary.questionCount} />

      <div className="flex flex-wrap justify-center gap-3 pb-4">
        <Link to={retryHref} className={buttonClasses('primary', 'lg')}>
          Practise this topic again
        </Link>
        <Link to="/" className={buttonClasses('secondary', 'lg')}>
          Back to topics
        </Link>
        <Link to="/profile" className={buttonClasses('ghost', 'lg')}>
          View my progress
        </Link>
      </div>

      {estimateDuration(summary) > 0 ? (
        <p className="pb-6 text-center text-xs text-slate-400">
          You spent about {formatDuration(estimateDuration(summary))} on this topic, including reading
          the explanations.
        </p>
      ) : null}
    </div>
  )
}

/** Wall-clock length of the session, from the timestamps the API records. */
function estimateDuration(summary: SessionSummary): number {
  const started = new Date(summary.startedAt).getTime()
  const finished = summary.completedAt ? new Date(summary.completedAt).getTime() : Number.NaN
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished <= started) {
    return 0
  }
  return finished - started
}
