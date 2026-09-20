import { useEffect, useState } from 'react'
import { ApiRequestError } from '../../api/client'
import { adminApi, type AdminTopic, type SaveTopicRequest, type TopicCoverage } from '../../api/admin'
import { Button, Card, Spinner } from '../../components/ui'
import { AdminHeader } from './adminUi'
import { difficultyLabel } from '../../lib/format'
import { fieldClass } from './AdminQuestionListPage'

interface TopicRow extends SaveTopicRequest {
  id: number
}

const EMPTY_NEW_TOPIC: SaveTopicRequest = { slug: '', name: '', description: '', sortOrder: 0 }

/**
 * Renaming and reordering topics.
 *
 * Small, but it is the first thing a teacher wants: the prototype's topic names are ours, not
 * hers, and every question she writes has to be filed under one.
 */
export function AdminTopicsPage() {
  const [rows, setRows] = useState<TopicRow[]>([])
  const [coverage, setCoverage] = useState<TopicCoverage[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})
  const [newTopic, setNewTopic] = useState<SaveTopicRequest>(EMPTY_NEW_TOPIC)
  const [newError, setNewError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([adminApi.topics(), adminApi.coverage()])
      .then(([loaded, loadedCoverage]) => {
        if (cancelled) return
        setRows(loaded.map(toRow))
        setCoverage(loadedCoverage)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof ApiRequestError ? caught.message : 'Could not load topics.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const coverageFor = (topicId: number) => coverage.find((entry) => entry.topicId === topicId)

  /** The server's field errors name the input; a conflict has only a message. */
  const reasonFor = (caught: unknown, fallback: string): string => {
    if (caught instanceof ApiRequestError) {
      return caught.fieldErrors['slug'] ?? caught.fieldErrors['name'] ?? caught.message
    }
    return fallback
  }

  const update = (id: number, patch: Partial<SaveTopicRequest>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const saveRow = async (row: TopicRow) => {
    setBusyId(row.id)
    setError('')
    setMessage('')
    setRowErrors((current) => ({ ...current, [row.id]: '' }))
    try {
      const saved = await adminApi.updateTopic(row.id, {
        slug: row.slug,
        name: row.name,
        description: row.description,
        sortOrder: row.sortOrder,
      })
      setRows((current) => current.map((existing) => (existing.id === saved.id ? toRow(saved) : existing)))
      setMessage(`Saved “${saved.name}”.`)
    } catch (caught) {
      setRowErrors((current) => ({ ...current, [row.id]: reasonFor(caught, 'Could not save that topic.') }))
    } finally {
      setBusyId(null)
    }
  }

  const create = async () => {
    setCreating(true)
    setNewError('')
    setMessage('')
    try {
      const created = await adminApi.createTopic(newTopic)
      setRows((current) => [...current, toRow(created)])
      setNewTopic({ ...EMPTY_NEW_TOPIC, sortOrder: created.sortOrder + 1 })
      setMessage(`Added “${created.name}”.`)
    } catch (caught) {
      setNewError(reasonFor(caught, 'Could not create that topic.'))
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <Spinner label="Loading topics…" />
  }

  return (
    <div className="space-y-6">
      <AdminHeader title="Topics" />

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

      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block lg:col-span-2">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Name</span>
                <input
                  type="text"
                  value={row.name}
                  onChange={(event) => update(row.id, { name: event.target.value })}
                  className={fieldClass()}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Slug</span>
                <input
                  type="text"
                  value={row.slug}
                  onChange={(event) => update(row.id, { slug: event.target.value })}
                  className={fieldClass()}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Show order
                </span>
                <input
                  type="number"
                  value={row.sortOrder}
                  onChange={(event) => update(row.id, { sortOrder: Number(event.target.value) })}
                  className={fieldClass()}
                />
              </label>

              <label className="block sm:col-span-2 lg:col-span-3">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Description
                </span>
                <input
                  type="text"
                  value={row.description ?? ''}
                  onChange={(event) => update(row.id, { description: event.target.value })}
                  className={fieldClass()}
                />
              </label>

              <div className="flex items-end">
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={busyId === row.id}
                  onClick={() => void saveRow(row)}
                >
                  {busyId === row.id ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>

            {rowErrors[row.id] ? (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                {rowErrors[row.id]}
              </p>
            ) : null}

            {coverageFor(row.id) ? <TopicCoverageRow coverage={coverageFor(row.id)!} /> : null}
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <p className="text-sm font-medium text-slate-700">Add a topic</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Name</span>
            <input
              type="text"
              value={newTopic.name}
              onChange={(event) => setNewTopic((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ratio & Proportion"
              className={fieldClass()}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Slug</span>
            <input
              type="text"
              value={newTopic.slug}
              onChange={(event) => setNewTopic((current) => ({ ...current, slug: event.target.value }))}
              placeholder="ratio"
              className={fieldClass()}
            />
          </label>
          <label className="block lg:col-span-2">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Description
            </span>
            <input
              type="text"
              value={newTopic.description ?? ''}
              onChange={(event) => setNewTopic((current) => ({ ...current, description: event.target.value }))}
              className={fieldClass()}
            />
          </label>
        </div>

        {newError ? (
          <p role="alert" className="mt-3 text-sm text-rose-600">
            {newError}
          </p>
        ) : null}

        <Button className="mt-3" disabled={creating} onClick={() => void create()}>
          {creating ? 'Creating…' : 'Create topic'}
        </Button>
        <p className="mt-2 text-xs text-slate-400">
          Slugs use lower-case letters, numbers and hyphens — <code className="font-mono">ratio-proportion</code>.
        </p>
      </Card>
    </div>
  )
}

function toRow(topic: AdminTopic): TopicRow {
  return {
    id: topic.id,
    slug: topic.slug,
    name: topic.name,
    description: topic.description ?? '',
    sortOrder: topic.sortOrder,
  }
}

/**
 * The bands this topic can actually serve, and the gaps.
 *
 * A zero is shown in red rather than omitted, because a band with no questions is a level the
 * adaptive sets cannot aim at: a student working at it silently gets something else. That is the
 * one thing this panel exists to make obvious.
 */
function TopicCoverageRow({ coverage }: { coverage: TopicCoverage }) {
  const emptyBands = coverage.bands.filter((band) => band.questions === 0)

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {coverage.bands.map((band) => (
          <span key={band.band} className="flex items-baseline gap-1.5 text-xs">
            <span className={band.questions === 0 ? 'text-rose-400' : 'text-slate-500'}>
              {difficultyLabel(band.band)}
            </span>
            <span
              className={`font-semibold tabular-nums ${
                band.questions === 0 ? 'text-rose-500' : 'text-slate-700'
              }`}
            >
              {band.questions}
            </span>
          </span>
        ))}
        <span className="ml-auto text-xs text-slate-400">{coverage.published} published</span>
      </div>

      {!coverage.canFillASet ? (
        <p className="mt-2 text-xs font-medium text-amber-700">
          Not enough published questions here to fill a full set.
        </p>
      ) : null}

      {coverage.canFillASet && emptyBands.length > 0 ? (
        <p className="mt-2 text-xs text-slate-400">
          No {emptyBands.map((band) => difficultyLabel(band.band)).join(' or ')} questions, so sets
          cannot be aimed there.
        </p>
      ) : null}
    </div>
  )
}
