import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ApiRequestError, api } from '../api/client'
import type { ReviewOption, SessionSummary } from '../api/types'
import { AccuracyRing } from '../components/AccuracyRing'
import { LevelMeter } from '../components/LevelMeter'
import { MiningReward } from '../components/MiningReward'
import { Card, Spinner, StatTile, buttonClasses } from '../components/ui'
import { difficultyLabel, formatDuration, percent, pluralise } from '../lib/format'
import { yearGroupLabel } from '../lib/yearGroups'

interface ResultsLocationState {
  summary?: SessionSummary
}

/** `previewSummary` is only used by the development-only preview route, which renders this
 *  page with fixture data instead of a real session. */
export function ResultsPage({ previewSummary }: { previewSummary?: SessionSummary } = {}) {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const handedOver = (location.state as ResultsLocationState | null)?.summary ?? previewSummary
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

  // Carry the year group through so "try again" repeats the set the student just worked at,
  // rather than whatever the dropdown has been changed to since. A mixed or unrecorded set has
  // none, which leaves it to the remembered preference.
  const yearQuery = summary.yearGroup === undefined ? '' : `&year=${summary.yearGroup}`
  const retryHref = summary.topicSlug
    ? `/quiz?topic=${encodeURIComponent(summary.topicSlug)}&count=${summary.questionCount}${yearQuery}`
    : `/quiz?count=${summary.questionCount}${yearQuery}`

  return (
    <div className="mx-auto max-w-3xl animate-rise space-y-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-8 text-center text-white sm:px-10">
          {/* The topic is the heading. There used to be an encouraging line under it, but a
              sentence about a low score is worse than saying nothing. */}
          <h1 className="text-2xl font-bold">{summary.topicName}</h1>
          {summary.yearGroup !== undefined ? (
            <p className="mt-1 text-sm font-medium text-indigo-100">{yearGroupLabel(summary.yearGroup)}</p>
          ) : null}
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
      {/* The reward for finishing: one ore per correct answer, to walk to and mine. Placed
          directly beneath the graduation card and above the question review, so it is among the
          first things after the score - at the bottom of a long list of answers it was easy to
          miss entirely. Shown even for a zero score, where the
          patch has a single ore - a reward that only appears to the successful is not much of a
          reward, and for a demo it should always be visible.

          This is the real thing rather than a preview, so the level is metered against the play
          time the questions paid out: `live` runs the heartbeat, and running out points back at the
          questions, which is the loop the whole mechanic is built around. The development preview
          passes fixture data instead, and plays untimed. */}
      <MiningReward
        correctCount={summary.correctCount}
        questionCount={summary.questionCount}
        playSecondsEarned={summary.playSecondsEarned}
        live={!previewSummary}
        retryHref={retryHref}
      />

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
                  {item.answerType === 'MULTI_SELECT' ? (
                    <p className="mt-0.5 text-xs font-medium text-indigo-500">Tick all that apply</p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span className={item.correct ? 'text-emerald-700' : 'text-rose-700'}>
                      Your answer: {renderAnswer(item.selectedOptions)}
                    </span>
                    {!item.correct ? (
                      <span className="text-emerald-700">Correct: {renderAnswer(item.correctOptions)}</span>
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

/**
 * An answer as one line of text: "A) 29, C) 37".
 *
 * The letters stay because they are how a student refers back to the question, and every option is
 * listed rather than the first, because a tick-all answer is a set. An empty list is a question
 * that was never answered, which is a real state on an abandoned round.
 */
function renderAnswer(options: ReviewOption[]): string {
  if (options.length === 0) return 'not answered'
  return options.map((option) => `${option.label}) ${option.text}`).join(', ')
}
