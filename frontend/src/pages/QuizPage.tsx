import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiRequestError, api } from '../api/client'
import type { AnswerResult, QuizSession } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Badge, Button, Card, ProgressBar, Spinner, buttonClasses } from '../components/ui'
import { OreBadge } from '../components/OreBadge'
import { difficultyLabel } from '../lib/format'
import { useTheme } from '../theme/ThemeContext'

const DEFAULT_QUESTIONS = 5
const MAX_QUESTIONS = 20

type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted'

const OPTION_STYLES: Record<OptionState, string> = {
  idle: 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40',
  selected: 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-500/20',
  correct: 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-500/20',
  wrong: 'border-rose-400 bg-rose-50 ring-2 ring-rose-500/20',
  muted: 'border-slate-200 bg-white opacity-55',
}

const BADGE_STYLES: Record<OptionState, string> = {
  idle: 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700',
  selected: 'bg-indigo-600 text-white',
  correct: 'bg-emerald-600 text-white',
  wrong: 'bg-rose-600 text-white',
  muted: 'bg-slate-100 text-slate-500',
}

export function QuizPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const { isMinecraft } = useTheme()

  const topicSlug = searchParams.get('topic')
  const requestedCount = Number(searchParams.get('count') ?? DEFAULT_QUESTIONS)
  const count =
    Number.isFinite(requestedCount) && requestedCount > 0
      ? Math.min(Math.floor(requestedCount), MAX_QUESTIONS)
      : DEFAULT_QUESTIONS
  const startKey = `${topicSlug ?? 'mixed'}:${count}`

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
        setError(caught instanceof ApiRequestError ? caught.message : 'Could not start the quiz.')
      })
    return () => {
      cancelled = true
    }
  }, [startKey, topicSlug, count])

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
      setError(caught instanceof ApiRequestError ? caught.message : 'Could not finish the quiz.')
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
        <p className="font-semibold text-slate-900">Quiz unavailable</p>
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
        <p className="font-semibold text-slate-900">This quiz has no questions</p>
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
          {isMinecraft ? (
            <OreBadge difficulty={question.difficulty} />
          ) : (
            <Badge tone="indigo">{difficultyLabel(question.difficulty)}</Badge>
          )}
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

      <Card className="mt-6 p-6 sm:p-8">
        <h1 className="text-xl font-semibold leading-snug text-slate-900 sm:text-2xl">{question.prompt}</h1>

        <div className="mt-6 space-y-3" role="group" aria-label="Answer options">
          {question.options.map((option, optionIndex) => {
            const state = stateFor(option.id)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => void choose(option.id)}
                disabled={Boolean(result) || submitting}
                aria-label={`Option ${option.label}: ${option.text}`}
                className={`group flex w-full items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition disabled:cursor-default ${OPTION_STYLES[state]}`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold transition ${BADGE_STYLES[state]}`}
                >
                  {state === 'correct' ? '✓' : state === 'wrong' ? '✕' : option.label}
                </span>
                <span className="text-slate-800">{option.text}</span>
                <span className="ml-auto hidden text-xs text-slate-400 sm:block">{optionIndex + 1}</span>
              </button>
            )
          })}
        </div>

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
            {isLast ? 'Finish quiz' : 'Next question'}
          </Button>
        </div>
      </Card>

      <div className="mt-4 text-center">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-600">
          Abandon and return to topics
        </Link>
      </div>
    </div>
  )
}
