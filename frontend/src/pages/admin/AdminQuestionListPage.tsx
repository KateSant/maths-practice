import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiRequestError } from '../../api/client'
import {
  adminApi,
  type AdminQuestionSummary,
  type AdminTopic,
  type PageResponse,
  type QuestionStatus,
} from '../../api/admin'
import { Button, Card, EmptyState, Spinner, buttonClasses } from '../../components/ui'
import { AdminHeader, DifficultyBadge, OriginBadge, StatusBadge } from './adminUi'
import { DIFFICULTY_BANDS, difficultyLabel } from '../../lib/format'

const PAGE_SIZE = 20

const STATUSES: QuestionStatus[] = ['DRAFT', 'PUBLISHED', 'RETIRED']

/**
 * The screen she would live in: find a question, see what state it is in, publish or retire it.
 *
 * Filtering happens on the server, so this stays usable when the bank is thousands of questions
 * rather than 32. The search box is debounced because firing a request per keystroke would be
 * wasteful and would make the list flicker under the cursor.
 */
export function AdminQuestionListPage() {
  const [topics, setTopics] = useState<AdminTopic[]>([])

  const [topicId, setTopicId] = useState('')
  const [status, setStatus] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)

  const [data, setData] = useState<PageResponse<AdminQuestionSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // A failure here only costs the filter dropdown, so it should not block the screen.
    adminApi
      .topics()
      .then(setTopics)
      .catch(() => setTopics([]))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(
        await adminApi.questions({
          // Empty strings mean "no filter" and are dropped by the query builder.
          topicId: topicId ? Number(topicId) : undefined,
          status: (status || undefined) as QuestionStatus | undefined,
          difficulty: difficulty ? Number(difficulty) : undefined,
          q: debouncedSearch || undefined,
          page,
          size: PAGE_SIZE,
        }),
      )
      setError('')
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : 'Could not load the questions.')
    } finally {
      setLoading(false)
    }
    // reloadKey is a manual trigger rather than data, which is why it is only in the deps.
  }, [topicId, status, difficulty, debouncedSearch, page, reloadKey])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (id: number, action: 'publish' | 'retire') => {
    setBusyId(id)
    setActionError('')
    try {
      if (action === 'publish') {
        await adminApi.publishQuestion(id)
      } else {
        await adminApi.retireQuestion(id)
      }
      setReloadKey((key) => key + 1)
    } catch (caught) {
      // Publishing from the list can fail validation — a question with no correct option, say.
      // The editor is where that gets fixed, so the message only has to be honest.
      setActionError(caught instanceof ApiRequestError ? caught.message : 'That did not work.')
      setReloadKey((key) => key + 1)
    } finally {
      setBusyId(null)
    }
  }

  const resetTo = (change: () => void) => {
    change()
    setPage(0)
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Questions"
        subtitle="Everything in the bank, drafts included."
        action={
          <Link to="/admin/questions/new" className={buttonClasses('primary', 'md')}>
            New question
          </Link>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Search</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Words in the prompt"
              className={fieldClass()}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Topic</span>
            <select
              value={topicId}
              onChange={(event) => resetTo(() => setTopicId(event.target.value))}
              className={fieldClass()}
            >
              <option value="">All topics</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</span>
            <select
              value={status}
              onChange={(event) => resetTo(() => setStatus(event.target.value))}
              className={fieldClass()}
            >
              <option value="">Any status</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0) + value.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Difficulty</span>
            <select
              value={difficulty}
              onChange={(event) => resetTo(() => setDifficulty(event.target.value))}
              className={fieldClass()}
            >
              <option value="">Any difficulty</option>
              {DIFFICULTY_BANDS.map((value) => (
                <option key={value} value={value}>
                  {difficultyLabel(value)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {error ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {actionError ? (
        <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {actionError}
        </p>
      ) : null}

      {loading && !data ? (
        <Spinner label="Loading questions…" />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          title="No questions match those filters"
          body="Try clearing the search or choosing a different topic."
          action={
            <Link to="/admin/questions/new" className={buttonClasses('primary', 'md')}>
              Write a question
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {data?.items.map((question) => (
            <Card key={question.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/admin/questions/${question.id}`}
                    className="font-medium text-slate-900 hover:text-indigo-700"
                  >
                    {question.prompt || <span className="italic text-slate-400">Untitled draft</span>}
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">{question.topicName}</span>
                    <DifficultyBadge difficulty={question.difficulty} />
                    <StatusBadge status={question.status} />
                    <OriginBadge origin={question.origin} />
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link to={`/admin/questions/${question.id}`} className={buttonClasses('secondary', 'sm')}>
                    Edit
                  </Link>
                  {question.status !== 'PUBLISHED' ? (
                    <Button size="sm" disabled={busyId === question.id} onClick={() => void act(question.id, 'publish')}>
                      Publish
                    </Button>
                  ) : null}
                  {question.status !== 'RETIRED' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyId === question.id}
                      onClick={() => void act(question.id, 'retire')}
                    >
                      Retire
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-4 pt-2">
          <p className="text-sm text-slate-500">
            Page {data.page + 1} of {data.totalPages} · {data.totalItems}{' '}
            {data.totalItems === 1 ? 'question' : 'questions'}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={data.page === 0 || loading}
              onClick={() => setPage((current) => Math.max(current - 1, 0))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={data.page + 1 >= data.totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function fieldClass(error?: string): string {
  return [
    'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400',
    'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
    error ? 'border-rose-300' : 'border-slate-200',
  ].join(' ')
}
