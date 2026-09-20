import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiRequestError, api } from '../api/client'
import type { AnswerResult, QuizSession } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Badge, Button, Card, ProgressBar, Spinner, buttonClasses } from '../components/ui'
import { QuestionCard, type OptionState } from '../components/QuestionCard'
import { difficultyLabel } from '../lib/format'
import { isYearGroup, readYearGroup, yearGroupLabel, type YearGroup } from '../lib/yearGroups'

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
  // The year group travels in the link so the choice on the topic list is the one that deals the
  // set; the remembered preference is the fallback for a link opened directly or a refresh.
  const requestedYear = Number(searchParams.get('year'))
  const yearGroup: YearGroup = isYearGroup(requestedYear) ? requestedYear : readYearGroup()
  const startKey = `${topicSlug ?? 'mixed'}:${count}:${yearGroup}`

  const [session, setSession] = useState<QuizSession | null>(null)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
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
      startedRef.current = { key: startKey, promise: api.startQuiz(topicSlug, count, yearGroup) }
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
  }, [startKey, topicSlug, count, yearGroup])

  const question = session?.questions[index]
  const total = session?.questions.length ?? 0
  const isLast = index + 1 >= total

  const choose = useCallback(
    async (optionId: number) => {
      if (!session || !question || result || submitting) return
      setSubmitting(true)
      setSelectedId(optionId)
      try {
        const answered = await api.submitAnswer(session.sessionId, question.id, optionId, Date.now() - askedAt)
        setResult(answered)
      } catch (caught) {
        setSelectedId(null)
        setError(caught instanceof ApiRequestError ? caught.message : 'Could not submit that answer.')
      } finally {
        setSubmitting(false)
      }
    },
    [session, question, result, submitting, askedAt],
  )

  const next = useCallback(async () => {
    if (!session) return
    if (!isLast) {
      setIndex((current) => current + 1)
      setSelectedId(null)
      setResult(null)
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
      const byNumber = '1234'.indexOf(event.key)
      const byLetter = 'abcd'.indexOf(event.key.toLowerCase())
      const optionIndex = byNumber >= 0 ? byNumber : byLetter
      if (optionIndex >= 0) {
        const option = question.options[optionIndex]
        if (option) {
          event.preventDefault()
          void choose(option.id)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [question, result, next, choose])

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

  const stateFor = (optionId: number): OptionState => {
    if (!result) return optionId === selectedId ? 'selected' : 'idle'
    if (optionId === result.correctOptionId) return 'correct'
    if (optionId === selectedId) return 'wrong'
    return 'muted'
  }

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
          {/* Which year's questions these are, so a student who picked Year 10 can see they got
              Year 10 and not a silently different set. */}
          <Badge tone="slate">{yearGroupLabel(session.yearGroup ?? yearGroup)}</Badge>
          <Badge tone="indigo">{difficultyLabel(question.difficulty)}</Badge>
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
        stateFor={stateFor}
        onChoose={(optionId) => void choose(optionId)}
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

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="hidden text-xs text-slate-400 sm:block">
            {result ? 'Press Enter to continue' : 'Press 1–4 or A–D to answer'}
          </p>
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
      </QuestionCard>

      <div className="mt-4 text-center">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-600">
          Abandon and return to topics
        </Link>
      </div>
    </div>
  )
}
