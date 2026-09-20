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
import { optionState, toggleSelection } from '../../lib/answerState'
import type { AnswerType } from '../../api/types'
import { AdminHeader, OriginBadge, StatusBadge } from './adminUi'
import { MisconceptionPicker } from './MisconceptionPicker'
import { DIFFICULTY_BANDS, difficultyLabel } from '../../lib/format'
import { DEFAULT_YEAR_GROUP, YEAR_GROUPS, yearGroupLabel } from '../../lib/yearGroups'
import { fieldClass } from './AdminQuestionListPage'

const MAX_OPTIONS = 6

interface DraftOption {
  /** Client-side only. New options have no id yet, and index keys would break on removal. */
  key: string
  text: string
  correct: boolean
  /** A code from the misconception register, or '' for "not diagnosed". */
  misconceptionCode: string
  /**
   * What the student reads when they pick this option, or '' for nothing written yet.
   *
   * Held even while the option is the correct one, and dropped when saving, so a teacher who
   * marks an answer by accident does not lose a paragraph they typed.
   */
  feedback: string
}

let optionKeySeed = 0
function newOption(): DraftOption {
  optionKeySeed += 1
  return { key: `option-${optionKeySeed}`, text: '', correct: false, misconceptionCode: '', feedback: '' }
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
  // New questions start in Year 7, which is where the starter bank lives. The teacher moves them
  // with the dropdown; nothing infers a year group from the topic or the difficulty.
  const [yearGroup, setYearGroup] = useState<number>(DEFAULT_YEAR_GROUP)
  const [answerType, setAnswerType] = useState<AnswerType>('SINGLE_CHOICE')
  const [options, setOptions] = useState<DraftOption[]>(() => [newOption(), newOption()])
  const [status, setStatus] = useState<QuestionStatus>('DRAFT')
  const [origin, setOrigin] = useState<AdminQuestionDetail['origin']>('AUTHORED')

  // What the teacher has done in the preview: which options they picked, and whether the answer has
  // been revealed yet. A preview a teacher cannot answer only shows the question, and the thing they
  // most need to check is the message a student gets after picking a wrong answer.
  const [previewPicked, setPreviewPicked] = useState<number[]>([])
  const [previewGraded, setPreviewGraded] = useState(false)

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
        setYearGroup(question.yearGroup)
        setAnswerType(question.answerType)
        setStatus(question.status)
        setOrigin(question.origin)
        setOptions(
          question.options.length > 0
            ? question.options.map((option) => ({
                ...newOption(),
                text: option.text,
                correct: option.correct,
                misconceptionCode: option.misconceptionCode ?? '',
                feedback: option.feedback ?? '',
              }))
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
        yearGroup,
        answerType,
        options: options.map((option) => ({
          text: option.text,
          correct: option.correct,
          // A correct option catches nothing, so the code is dropped even if one was left on it
          // before it was marked correct. An empty string means the same as absent.
          misconceptionCode: option.correct ? null : option.misconceptionCode || null,
          // Likewise no message for a correct option - there is nothing to explain away - but it
          // stays in the draft, so unticking the answer brings the teacher's words back.
          feedback: option.correct ? null : option.feedback.trim() || null,
        })),
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
        current.map((option, at) => {
          if (at !== index) return option
          // A correct option catches nothing, so the code goes when the option becomes the
          // answer. It is not restored if the option is later unticked; the teacher picks again.
          // The message is not dropped here, only from what is saved: it is prose, and losing it
          // to a mis-click would cost more than re-picking a code does.
          return option.correct
            ? { ...option, correct: false }
            : { ...option, correct: true, misconceptionCode: '' }
        }),
      )
      return
    }
    setOptions((current) =>
      current.map((option, at) =>
        at === index
          ? { ...option, correct: true, misconceptionCode: '' }
          : { ...option, correct: false },
      ),
    )
  }

  const setOptionMisconception = (index: number, code: string) => {
    setOptions((current) =>
      current.map((option, at) => (at === index ? { ...option, misconceptionCode: code } : option)),
    )
  }

  const setOptionFeedback = (index: number, feedback: string) => {
    setOptions((current) => current.map((option, at) => (at === index ? { ...option, feedback } : option)))
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

  const previewMulti = answerType === 'MULTI_SELECT'
  const correctPreviewIds = options.flatMap((option, index) => (option.correct ? [index] : []))

  // The same function the quiz uses, so the preview cannot drift from it in behaviour either.
  const stateForPreview = (optionId: number): OptionState =>
    optionState({
      optionId,
      selectedIds: previewPicked,
      correctOptionIds: correctPreviewIds,
      graded: previewGraded,
    })

  const previewCorrect =
    previewGraded &&
    previewPicked.length === correctPreviewIds.length &&
    previewPicked.every((id) => correctPreviewIds.includes(id))

  // The messages for the wrong answers picked, which is what a teacher is checking here.
  const previewFeedback = previewGraded
    ? previewPicked
        .flatMap((id) => {
          const option = options[id]
          return option && !option.correct && option.feedback.trim() ? [option.feedback.trim()] : []
        })
        .slice(0, 2)
    : []

  const previewChoose = (optionId: number) => {
    if (previewGraded) return
    if (previewMulti) {
      setPreviewPicked((current) => toggleSelection(current, optionId))
    } else {
      // A single choice is answered by the click itself, as it is in the quiz.
      setPreviewPicked([optionId])
      setPreviewGraded(true)
    }
  }

  const resetPreview = () => {
    setPreviewPicked([])
    setPreviewGraded(false)
  }

  // The register groups its codes by topic slug, and the question's own topic is shown first in
  // the picker. The names come from the topic list so a teacher reads "Place value & ordering"
  // rather than "place-value".
  const selectedTopic = topics.find((topic) => String(topic.id) === topicId)
  const topicNameBySlug = new Map(topics.map((topic) => [topic.slug, topic.name]))

  return (
    <div className="space-y-6">
      <AdminHeader
        title={questionId === null ? 'New question' : 'Edit question'}
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

      {/* Three fifths to the form, two to the preview. Equal halves left the diagnostic block -
          the part being written - narrower than the card showing the result. */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-3">
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
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Year group</span>
                <select
                  value={yearGroup}
                  onChange={(event) => setYearGroup(Number(event.target.value))}
                  className={fieldClass(fieldErrors['yearGroup'])}
                >
                  {YEAR_GROUPS.map((value) => (
                    <option key={value} value={value}>
                      {yearGroupLabel(value)}
                    </option>
                  ))}
                </select>
                <FieldError message={fieldErrors['yearGroup']} />
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
          </Card>

          {/* The question itself, in its own card and the biggest type on the screen. The prompt is
              the item's headline, not one input among many; the explanation lives at the bottom of
              the form, because it is what a student reads after answering rather than part of asking. */}
          <Card className="p-5 sm:p-6">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-800">Question</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={2}
                placeholder="What is 15 + 6 × 4?"
                // The same size the student sees the question at, so what the teacher writes looks
                // like what the class reads. Two rows, because the box is for a sentence, not a
                // page - it stays draggable if a longer one is needed.
                className={fieldClass(fieldErrors['prompt'], 'text-xl font-medium leading-snug')}
              />
              <FieldError message={fieldErrors['prompt']} />
            </label>
          </Card>

          {/* One card for all the answers. Each option is a row inside it rather than a card of its
              own: they are one list, and the tinted block under each wrong one already separates
              them. */}
          <Card className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-slate-800">Answers</span>
              <span className="text-xs text-slate-400">
                {answerType === 'MULTI_SELECT'
                  ? 'Tick every correct answer - the rest are the wrong answers students pick'
                  : 'Pick the correct one - the rest are the wrong answers students pick'}
              </span>
            </div>

            <FieldError message={fieldErrors['options']} />
            <FieldError message={fieldErrors['options.correct']} />

            <div className="mt-4 space-y-6">
              {options.map((option, index) => (
                <div key={option.key} className="space-y-2">
                  <div className="flex items-start gap-3">
                  <button
                    type="button"
                    // The letter is the state and the control in one: green means this is the
                    // answer. There is no separate checkbox, because the teacher is setting the
                    // key rather than answering, and no tick/cross mark to decode.
                    aria-pressed={option.correct}
                    onClick={() => toggleCorrect(index)}
                    title={option.correct ? 'The correct answer - click to unmark it' : 'Mark as the correct answer'}
                    aria-label={
                      `Option ${String.fromCharCode(65 + index)}, ` +
                      (option.correct ? 'the correct answer' : 'mark as the correct answer')
                    }
                    className={[
                      'mt-1.5 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-sm font-bold transition',
                      // Green is the answer, rose is a wrong answer. The letter is a control, not a
                      // label, so it also says what clicking will do: a rose letter turns green when
                      // it is marked correct, and a green one can be unmarked.
                      option.correct
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-600/20'
                        : 'border border-rose-200 bg-rose-50 text-rose-600 hover:border-emerald-400 hover:bg-white hover:text-emerald-600',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30',
                    ].join(' ')}
                  >
                    {String.fromCharCode(65 + index)}
                  </button>
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={option.text}
                      onChange={(event) => setOptionText(index, event.target.value)}
                      placeholder={index === 0 ? 'The correct answer' : 'A wrong answer that looks plausible'}
                      className={fieldClass(fieldErrors[`options[${index}].text`])}
                    />
                    <FieldError message={fieldErrors[`options[${index}].text`]} />
                  </div>
                  {/* Small and quiet: removing an option is housekeeping, and the block below is
                      the work. It used to be a full Button competing for the row's width. */}
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    disabled={options.length <= 1}
                    aria-label={`Remove option ${String.fromCharCode(65 + index)}`}
                    className="mt-2 shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  >
                    Remove
                  </button>
                  </div>
                  {/* Full width, indented to line up with the option text. The diagnostic block is
                      what a teacher is here to write, so it is not squeezed into a column beside
                      the row's controls. pl-11 is the letter button (w-8) plus the gap (gap-3). */}
                  {!option.correct ? (
                    <div className="pl-11">
                      <MisconceptionPicker
                        value={option.misconceptionCode}
                        onChange={(code) => setOptionMisconception(index, code)}
                        feedback={option.feedback}
                        onFeedbackChange={(message) => setOptionFeedback(index, message)}
                        error={fieldErrors[`options[${index}].feedback`]}
                        topicSlug={selectedTopic?.slug}
                        topicName={(slug) => topicNameBySlug.get(slug) ?? slug}
                      />
                    </div>
                  ) : null}
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

          {/* Last, after the answers. It is the working a student reads once they have answered, so
              it follows the options rather than sitting up with the question. */}
          <Card className="p-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Explanation <span className="font-normal text-slate-400">(what the student sees after they answer)</span>
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

        <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Preview — what a student sees
          </p>
          <QuestionCard
            prompt={prompt || 'Your question will appear here'}
            options={previewOptions}
            variant={previewMulti ? 'multi' : 'single'}
            stateFor={stateForPreview}
            onChoose={previewChoose}
            disabled={previewGraded}
          >
            {previewGraded ? (
              <div
                className={`mt-6 rounded-xl px-5 py-4 ${
                  previewCorrect ? 'bg-emerald-50 text-emerald-900' : 'bg-orange-50 text-orange-900'
                }`}
              >
                <p className="font-semibold">{previewCorrect ? 'Correct' : 'Good try'}</p>
                {previewFeedback.map((line) => (
                  <p key={line} className="mt-2 text-sm font-medium leading-relaxed">
                    {line}
                  </p>
                ))}
                {explanation ? (
                  <p className="mt-1.5 text-sm leading-relaxed opacity-90">{explanation}</p>
                ) : null}
              </div>
            ) : null}
            {previewMulti && previewPicked.length > 0 && !previewGraded ? (
              <Button size="sm" className="mt-6" onClick={() => setPreviewGraded(true)}>
                Check answer
              </Button>
            ) : null}
            {previewGraded ? (
              <button
                type="button"
                onClick={resetPreview}
                className="mt-3 text-xs font-medium text-slate-500 underline decoration-dotted underline-offset-2 hover:text-indigo-600"
              >
                Try another answer
              </button>
            ) : null}
          </QuestionCard>
        </div>
      </div>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <span className="mt-1 block text-xs text-rose-600">{message}</span>
}
