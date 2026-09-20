import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiRequestError } from '../../api/client'
import {
  adminApi,
  type AdminQuestionDetail,
  type AdminTopic,
  type QuestionStatus,
  type SaveQuestionRequest,
} from '../../api/admin'
import { Button, Card, Spinner, buttonClasses } from '../../components/ui'
import { QuestionCard, type OptionState } from '../../components/QuestionCard'
import type { AnswerType } from '../../api/types'
import { AdminHeader, OriginBadge, StatusBadge } from './adminUi'
import { DIFFICULTY_BANDS, difficultyLabel } from '../../lib/format'
import { fieldClass } from './AdminQuestionListPage'

const MAX_OPTIONS = 6

const ANSWER_TYPES: { value: AnswerType; label: string; help: string }[] = [
  { value: 'SINGLE_CHOICE', label: 'One correct answer', help: 'The student picks one option.' },
  {
    value: 'MULTI_SELECT',
    label: 'Tick all that apply',
    help: 'The student ticks any number of options and submits them together.',
  },
]

interface DraftOption {
  /** Client-side only. New options have no id yet, and index keys would break on removal. */
  key: string
  text: string
  correct: boolean
}

let optionKeySeed = 0
function newOption(): DraftOption {
  optionKeySeed += 1
  return { key: `option-${optionKeySeed}`, text: '', correct: false }
}

/**
 * Writing a question, with a preview rendered by the same component the quiz uses.
 *
 * The two ways of leaving this screen are deliberate. **Save** keeps whatever status the question
 * has, so a half-written question stays a draft. **Publish** saves first and then publishes, so
 * what goes live is what is on screen rather than the last saved version — and if the save fails
 * validation, nothing is published.
 */
export function AdminQuestionEditorPage() {
  const { id } = useParams()
  const questionId = id ? Number(id) : null
  const navigate = useNavigate()

  const [topics, setTopics] = useState<AdminTopic[]>([])
  const [topicId, setTopicId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [explanation, setExplanation] = useState('')
  const [difficulty, setDifficulty] = useState(2)
  const [answerType, setAnswerType] = useState<AnswerType>('SINGLE_CHOICE')
  const [options, setOptions] = useState<DraftOption[]>(() => [newOption(), newOption()])
  const [status, setStatus] = useState<QuestionStatus>('DRAFT')
  const [origin, setOrigin] = useState<AdminQuestionDetail['origin']>('AUTHORED')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const loadedTopics = await adminApi.topics()
        if (cancelled) return
        setTopics(loadedTopics)

        if (questionId === null) {
          const first = loadedTopics[0]
          if (first) setTopicId(String(first.id))
          return
        }

        const question = await adminApi.question(questionId)
        if (cancelled) return
        setTopicId(String(question.topicId))
        setPrompt(question.prompt)
        setExplanation(question.explanation ?? '')
        setDifficulty(question.difficulty)
        setAnswerType(question.answerType)
        setStatus(question.status)
        setOrigin(question.origin)
        setOptions(
          question.options.length > 0
            ? question.options.map((option) => ({ ...newOption(), text: option.text, correct: option.correct }))
            : [newOption(), newOption()],
        )
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiRequestError ? caught.message : 'Could not load that question.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [questionId])

  const describe = (caught: unknown, fallback: string) => {
    if (caught instanceof ApiRequestError) {
      setError(caught.message)
      // 422 carries per-input keys such as options[2].text, which is what lets this highlight
      // the offending option rather than just saying no.
      setFieldErrors(caught.fieldErrors)
    } else {
      setError(fallback)
    }
  }

  /** @returns the saved question, or null when nothing was saved */
  const save = async (): Promise<AdminQuestionDetail | null> => {
    setSaving(true)
    setError('')
    setMessage('')
    setFieldErrors({})
    try {
      const body: SaveQuestionRequest = {
        topicId: Number(topicId),
        prompt,
        explanation: explanation.trim() === '' ? null : explanation,
        difficulty,
        answerType,
        options: options.map((option) => ({ text: option.text, correct: option.correct })),
      }

      const saved =
        questionId === null ? await adminApi.createQuestion(body) : await adminApi.updateQuestion(questionId, body)

      if (questionId === null) {
        // Adopt the new id so a following publish targets it and a reload edits rather than
        // duplicating. replace, so Back does not land on a form that would create a second copy.
        navigate(`/admin/questions/${saved.id}`, { replace: true })
      }
      setStatus(saved.status)
      setOrigin(saved.origin)
      setMessage('Saved.')
      return saved
    } catch (caught) {
      describe(caught, 'Could not save that question.')
      return null
    } finally {
      setSaving(false)
    }
  }

  const publish = async () => {
    const saved = await save()
    if (!saved) return
    setSaving(true)
    try {
      const published = await adminApi.publishQuestion(saved.id)
      setStatus(published.status)
      setMessage('Published — students can be given this question now.')
    } catch (caught) {
      describe(caught, 'Could not publish that question.')
    } finally {
      setSaving(false)
    }
  }

  const retire = async () => {
    if (questionId === null) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const retired = await adminApi.retireQuestion(questionId)
      setStatus(retired.status)
      setMessage('Retired — it is no longer served to students.')
    } catch (caught) {
      describe(caught, 'Could not retire that question.')
    } finally {
      setSaving(false)
    }
  }

  const setOptionText = (index: number, text: string) => {
    setOptions((current) => current.map((option, at) => (at === index ? { ...option, text } : option)))
  }

  /**
   * Turns an option's correctness on or off.
   *
   * Exclusive for a single choice, a toggle for a tick-all - which is exactly the difference
   * between the two question types as far as a teacher is concerned, so it is the same control in
   * two modes rather than two controls.
   */
  const toggleCorrect = (index: number) => {
    if (answerType === 'MULTI_SELECT') {
      setOptions((current) =>
        current.map((option, at) => (at === index ? { ...option, correct: !option.correct } : option)),
      )
      return
    }
    setOptions((current) => current.map((option, at) => ({ ...option, correct: at === index })))
  }

  /**
   * Switching to a single choice has to drop any extra right answers, because the server will not
   * store two - the database trigger refuses it. Doing it here rather than letting the save come
   * back with an error keeps the editor from holding a state it cannot save.
   */
  const changeAnswerType = (next: AnswerType) => {
    setAnswerType(next)
    if (next === 'SINGLE_CHOICE') {
      setOptions((current) => {
        const firstCorrect = current.findIndex((option) => option.correct)
        return current.map((option, index) => ({ ...option, correct: index === firstCorrect }))
      })
    }
  }

  const removeOption = (index: number) => {
    setOptions((current) => current.filter((_, at) => at !== index))
  }

  if (loading) {
    return <Spinner label="Loading the question…" />
  }

  const previewOptions = options.map((option, index) => ({
    // Synthetic ids: the preview only needs them as keys and to look up a state.
    id: index,
    label: String.fromCharCode(65 + index),
    text: option.text,
  }))

  const stateForPreview = (optionId: number): OptionState => {
    const option = options[optionId]
    return option?.correct ? 'correct' : 'idle'
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        title={questionId === null ? 'New question' : 'Edit question'}
        subtitle="Write it, check the preview, then publish when it reads right."
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <OriginBadge origin={origin} />
            <Link to="/admin/questions" className={buttonClasses('secondary', 'md')}>
              Back to list
            </Link>
          </div>
        }
      />

      {error ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Topic</span>
                <select
                  value={topicId}
                  onChange={(event) => setTopicId(event.target.value)}
                  className={fieldClass(fieldErrors['topicId'])}
                >
                  <option value="">Choose a topic…</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
                <FieldError message={fieldErrors['topicId']} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Difficulty</span>
                <select
                  value={difficulty}
                  onChange={(event) => setDifficulty(Number(event.target.value))}
                  className={fieldClass(fieldErrors['difficulty'])}
                >
                  {DIFFICULTY_BANDS.map((value) => (
                    <option key={value} value={value}>
                      {difficultyLabel(value)}
                    </option>
                  ))}
                </select>
                <FieldError message={fieldErrors['difficulty']} />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">How is it answered?</span>
              <select
                value={answerType}
                onChange={(event) => changeAnswerType(event.target.value as AnswerType)}
                className={fieldClass(fieldErrors['answerType'])}
              >
                {ANSWER_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-400">
                {ANSWER_TYPES.find((type) => type.value === answerType)?.help}
              </span>
              <FieldError message={fieldErrors['answerType']} />
            </label>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Question</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={3}
                placeholder="What is 15 + 6 × 4?"
                className={fieldClass(fieldErrors['prompt'])}
              />
              <FieldError message={fieldErrors['prompt']} />
            </label>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Explanation <span className="font-normal text-slate-400">(shown after answering)</span>
              </span>
              <textarea
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                rows={3}
                placeholder="Multiplication is done before addition: 6 × 4 = 24, then 15 + 24 = 39."
                className={fieldClass(fieldErrors['explanation'])}
              />
              <FieldError message={fieldErrors['explanation']} />
            </label>
          </Card>

          <Card className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">Answers</span>
              <span className="text-xs text-slate-400">
                {answerType === 'MULTI_SELECT' ? 'Tick every correct answer' : 'Pick the correct one'}
              </span>
            </div>

            <FieldError message={fieldErrors['options']} />
            <FieldError message={fieldErrors['options.correct']} />

            <div className="mt-3 space-y-3">
              {options.map((option, index) => (
                <div key={option.key} className="flex items-start gap-3">
                  <input
                    type={answerType === 'MULTI_SELECT' ? 'checkbox' : 'radio'}
                    name="correct-option"
                    checked={option.correct}
                    onChange={() => toggleCorrect(index)}
                    aria-label={
                      answerType === 'MULTI_SELECT'
                        ? `Mark option ${String.fromCharCode(65 + index)} as correct`
                        : `Mark option ${String.fromCharCode(65 + index)} as the correct answer`
                    }
                    className="mt-3 h-4 w-4 shrink-0 accent-emerald-600"
                  />
                  <span className="mt-2.5 w-5 shrink-0 text-sm font-bold text-slate-500">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={option.text}
                      onChange={(event) => setOptionText(index, event.target.value)}
                      placeholder={index === 0 ? 'The correct answer' : 'A wrong answer that looks plausible'}
                      className={fieldClass(fieldErrors[`options[${index}].text`])}
                    />
                    <FieldError message={fieldErrors[`options[${index}].text`]} />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeOption(index)}
                    disabled={options.length <= 1}
                    aria-label={`Remove option ${String.fromCharCode(65 + index)}`}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <Button
              size="sm"
              variant="secondary"
              className="mt-4"
              onClick={() => setOptions((current) => [...current, newOption()])}
              disabled={options.length >= MAX_OPTIONS}
            >
              Add answer {options.length >= MAX_OPTIONS ? `(max ${MAX_OPTIONS})` : ''}
            </Button>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Working…' : 'Save draft'}
            </Button>
            <Button variant="secondary" onClick={() => void publish()} disabled={saving}>
              Publish
            </Button>
            {questionId !== null && status !== 'RETIRED' ? (
              <Button variant="ghost" onClick={() => void retire()} disabled={saving}>
                Retire
              </Button>
            ) : null}
          </div>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Preview — what a student sees
          </p>
          <QuestionCard
            prompt={prompt || 'Your question will appear here'}
            options={previewOptions}
            variant={answerType === 'MULTI_SELECT' ? 'multi' : 'single'}
            stateFor={stateForPreview}
          >
            {explanation ? (
              <div className="mt-6 rounded-xl bg-emerald-50 px-5 py-4 text-emerald-900">
                <p className="font-semibold">Explanation</p>
                <p className="mt-1.5 text-sm leading-relaxed opacity-90">{explanation}</p>
              </div>
            ) : null}
          </QuestionCard>
          <p className="mt-3 text-xs text-slate-400">
            This preview is the same component the practice questions use, so it cannot drift from what
            students actually see.
          </p>
        </div>
      </div>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <span className="mt-1 block text-xs text-rose-600">{message}</span>
}
