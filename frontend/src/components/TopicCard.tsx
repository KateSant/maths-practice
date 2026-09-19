import type { Topic } from '../api/types'
import { Badge, Card, buttonClasses } from './ui'
import { Link } from 'react-router-dom'
import { percent, pluralise } from '../lib/format'

/** One topic tile. Practising a topic works through its whole set of questions. */
export function TopicCard({ topic, accuracy }: { topic: Topic; accuracy?: number }) {
  const href = `/quiz?topic=${encodeURIComponent(topic.slug)}&count=${topic.questionCount}`
  const tone = accuracy === undefined ? null : accuracy >= 80 ? 'emerald' : accuracy >= 50 ? 'amber' : 'rose'

  return (
    <Card className="flex flex-col p-5 transition hover:shadow-md hover:ring-indigo-200">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{topic.name}</h3>
        {tone ? (
          <Badge tone={tone}>{percent(accuracy ?? 0)}</Badge>
        ) : (
          <Badge tone="indigo">New</Badge>
        )}
      </div>

      {topic.description ? (
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{topic.description}</p>
      ) : null}

      <div className="mt-auto flex items-center justify-between pt-5">
        <span className="text-xs text-slate-400">{pluralise(topic.questionCount, 'question')} available</span>
        <Link to={href} className={buttonClasses('primary', 'sm')}>
          Practise
        </Link>
      </div>
    </Card>
  )
}
