import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiRequestError, api, type AnswerSelection } from '../api/client'
import type { AnswerResult, QuizSession } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Badge, Button, Card, ProgressBar, Spinner, buttonClasses } from '../components/ui'
import { QuestionCard, type OptionState, type QuestionVariant } from '../components/QuestionCard'
import { difficultyLabel } from '../lib/format'
import { optionState, toggleSelection } from '../lib/answerState'

const DEFAULT_QUESTIONS = 5
const MAX_QUESTIONS = 20

export function QuizPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refresh } = useAuth()

  const topicSlug = searchParams.get('topic')
  const requestedCount = Number(searchParams.get('count') ?? DEFAULT_QUESTIONS)
  const count =
    Number.isFinite(requestedCount) && requestedCount > 0
      ? Math.min(Math.floor(requestedCount), MAX_QUESTIONS)
      : DEFAULT_QUESTIONS
  const startKey = `${topicSlug ?? 'mixed'}:${count}`

  const [session, setSession] = useState<QuizSession | null>(null)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [index, setIndex] = useState(0)
  /**
   * What the student has ticked. One entry for a single choice, several for a tick-all, and it is
   * the same state either way because the only difference is how many entries are ever allowed in
   * it - which is decided by the question, not by a second piece of state here.
   */
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [askedAt, setAskedAt] = useState(() => Date.now())

  const nextButtonRef = useRef<HTMLButtonElement | null>(null)

  /**
   * Held in a ref rather than state so React 19's StrictMode double-effect in
   * development reuses one session instead of dealing two.
   */
  const startedRef = useRef<{ key: string; promise: Promise<QuizSession> } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (startedRef.current?.key !== startKey) {
      startedRef.current = { key: startKey, promise: api.startQuiz(topicSlug, count) }
    }
    startedRef.current.promise
      .then((loaded) => {
        if (cancelled) return
        setSession(loaded)
        setAskedAt(Date.now())
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(caught instanceof ApiRequestError ? caught.message : 'Could not start practice.')
      })
    return () => {
      cancelled = true
    }
  }, [startKey, topicSlug, count])

  const question = session?.questions[index]
  const total = session?.questions.length ?? 0
  const isLast = index + 1 >= total
  const multi = question?.answerType === 'MULTI_SELECT'
  const variant: QuestionVariant = multi ? 'multi' : 'single'

  /**
   * Marks one answer. Used for both types: a single choice calls it on the click, a tick-all calls
   * it when the student presses Check.
   */
  const submit = useCallback(
    async (optionIds: number[]) => {
      if (!session || !question || result || submitting) return
      setSubmitting(true)
      setSubmitError('')
      setSelectedIds(optionIds)
      try {
        const selection: AnswerSelection = multi ? { optionIds } : { optionId: optionIds[0]! }
        const answered = await api.submitAnswer(session.sessionId, question.id, selection, Date.now() - askedAt)
        setResult(answered)
      } catch (caught) {
        // A single choice clears, because the student is choosing again. A tick-all keeps its
        // ticks, because losing them to a flaky connection would mean re-doing the whole question.
        if (!multi) setSelectedIds([])
        setSubmitError(caught instanceof ApiRequestError ? caught.message : 'Could not submit that answer.')
      } finally {
        setSubmitting(false)
      }
    },
    [session, question, result, submitting, multi, askedAt],
  )

  const choose = useCallback(
    (optionId: number) => {
      if (multi) {
        setSelectedIds((current) => toggleSelection(current, optionId))
        return
      }
      void submit([optionId])
    },
    [multi, submit],
  )

  const next = useCallback(async () => {
    if (!session) return
    if (!isLast) {
      setIndex((current) => current + 1)
      setSelectedIds([])
      setResult(null)
      setSubmitError('')
      setAskedAt(Date.now())
      return
    }

    setFinishing(true)
    try {
      const summary = await api.completeQuiz(session.sessionId)
      await refresh()
      navigate(`/results/${session.sessionId}`, { replace: true, state: { summary } })
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : 'Could not mark your answers.')
      setFinishing(false)
    }
  }, [session, isLast, navigate, refresh])

  // Move focus to the primary action once an answer is graded, so the whole quiz
  // can be completed from the keyboard.
  useEffect(() => {
    if (result) nextButtonRef.current?.focus()
  }, [result])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!question) return
      if (result) {
        if (event.key === 'Enter') {
          event.preventDefault()
          void next()
        }
        return
      }
      // A tick-all answer is committed with Enter, which has to come before the per-option keys
      // so it is not swallowed as "no option matched".
      if (multi && event.key === 'Enter') {
        event.preventDefault()
        if (selectedIds.length > 0) void submit(selectedIds)
        return
      }
      const byNumber = '123456'.indexOf(event.key)
      const byLetter = 'abcdef'.indexOf(event.key.toLowerCase())
      const optionIndex = byNumber >= 0 ? byNumber : byLetter
      if (optionIndex < 0) return
      const option = question.options[optionIndex]
      if (!option) return
      event.preventDefault()
      choose(option.id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [question, result, multi, selectedIds, next, submit, choose])

  if (error) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <p className="font-semibold text-slate-900">Can't start practice</p>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link to="/" className={buttonClasses('primary', 'md')}>
            Back to topics
          </Link>
        </div>
      </Card>
    )
  }

  if (!session) {
    return <Spinner label="Dealing your questions…" />
  }

  if (finishing) {
    return <Spinner label="Marking your answers…" />
  }

  if (!question) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <p className="font-semibold text-slate-900">Nothing to practise yet</p>
        <p className="mt-1 text-sm text-slate-500">
          There may be no active questions for this topic yet.
        </p>
        <Link to="/" className={`${buttonClasses('primary', 'md')} mt-5`}>
          Choose another topic
        </Link>
      </Card>
    )
  }

  const stateFor = (optionId: number): OptionState =>
    optionState({
      optionId,
      selectedIds,
      correctOptionIds: result?.correctOptionIds ?? [],
      graded: Boolean(result),
    })

  const hint = result
    ? 'Press Enter to continue'
    : multi
      ? 'Press 1–6 or A–F to tick, then Enter to check'
      : 'Press 1–6 or A–F to answer'

  return (
    <div className="mx-auto max-w-3xl animate-rise">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{session.topicName}</p>
          <p className="font-semibold text-slate-900">
            Question {index + 1} <span className="text-slate-400">of {total}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="indigo">{difficultyLabel(question.difficulty)}</Badge>
          {multi ? <Badge tone="slate">Tick all that apply</Badge> : null}
          {result ? <Badge tone="emerald">{result.correctSoFar}/{result.answeredSoFar} correct</Badge> : null}
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar
          value={index}
          max={total}
          label={`Progress: question ${index + 1} of ${total}`}
        />
      </div>

      <QuestionCard
        className="mt-6"
        prompt={question.prompt}
        options={question.options}
        variant={variant}
        stateFor={stateFor}
        onChoose={choose}
        disabled={Boolean(result) || submitting}
      >
        {result ? (
          <div
            className={`mt-6 animate-pop rounded-xl px-5 py-4 ${
              result.correct ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'
            }`}
          >
            <p className="flex items-center gap-2 font-semibold">
              <span aria-hidden="true">{result.correct ? '🎉' : '💡'}</span>
              {result.correct ? `Correct! +${result.pointsAwarded} points` : 'Not quite'}
            </p>
            {result.explanation ? (
              <p className="mt-1.5 text-sm leading-relaxed opacity-90">{result.explanation}</p>
            ) : null}
            {result.correct && result.currentStreak > 1 ? (
              <p className="mt-2 text-sm font-medium opacity-90">
                🔥 {result.currentStreak} in a row
              </p>
            ) : null}
          </div>
        ) : null}

        {submitError ? (
          <p role="alert" className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {submitError}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="hidden text-xs text-slate-400 sm:block">{hint}</p>
          <div className="flex items-center gap-3">
            {multi && !result ? (
              <Button
                onClick={() => void submit(selectedIds)}
                disabled={selectedIds.length === 0 || submitting}
                size="lg"
              >
                {submitting ? 'Checking…' : 'Check answer'}
              </Button>
            ) : null}
            <Button
              ref={nextButtonRef}
              onClick={() => void next()}
              disabled={!result}
              size="lg"
              className={result ? '' : 'invisible'}
            >
              {isLast ? 'See my results' : 'Next question'}
            </Button>
          </div>
        </div>
      </QuestionCard>

      <div className="mt-4 text-center">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-600">
          Abandon and return to topics
        </Link>
      </div>
    </div>
  )
}
